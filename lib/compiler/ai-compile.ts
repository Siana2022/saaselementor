/**
 * =============================================================================
 *  Compilador con IA — Claude reconstruye una página como Elementor limpio
 * =============================================================================
 *
 * El motor mecánico traduce 1:1 y sale a churro con HTML real. Este módulo usa
 * el criterio de Claude (guiado por la receta validada) para producir una
 * plantilla Elementor `type:"container"` LIMPIA, que luego validamos con Zod.
 *
 * Aquí van las piezas PURAS (prompt, compactación del AST, parseo/validación).
 * La llamada a la API vive en la ruta /api/ai-compile (servidor).
 * =============================================================================
 */

import type { AstNode } from "@/lib/core/ast/types";
import { ElementorDocumentSchema, type ElementorDocument } from "./elementor-types";

/** Estilos relevantes para el diseño que se envían a la IA (el resto se descarta). */
const DESIGN_STYLE_KEYS = [
  "color",
  "background-color",
  "background",
  "background-image",
  "background-size",
  "background-position",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "text-decoration",
  "display",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "gap",
  "grid-template-columns",
  "width",
  "max-width",
  "height",
  "min-height",
  "padding",
  "margin",
  "border",
  "border-radius",
  "box-shadow",
  "opacity",
];

export interface CompactNode {
  tag: string;
  role: string;
  classes?: string[];
  href?: string;
  src?: string;
  alt?: string;
  content?: string;
  styles?: Record<string, string>;
  children?: CompactNode[];
}

/** Reduce el AST a lo esencial para la IA (sin ids, sin data-URIs, sin ruido). */
export function compactAst(node: AstNode): CompactNode {
  const styles: Record<string, string> = {};
  for (const k of DESIGN_STYLE_KEYS) {
    const v = node.styles[k];
    if (v && !/data:/.test(v)) styles[k] = v; // descarta data-URIs (tokens)
  }
  const src = node.attributes["src"];
  const out: CompactNode = { tag: node.tagName, role: node.elementorRole };
  if (node.classes.length) out.classes = node.classes.slice(0, 4);
  if (node.attributes["href"]) out.href = node.attributes["href"];
  if (src) out.src = src.startsWith("data:") ? "__IMG__" : src;
  if (node.attributes["alt"]) out.alt = node.attributes["alt"];
  if (node.content) out.content = node.content;
  if (node.rawHtml && node.elementorRole === "html_widget") {
    out.content = node.rawHtml.startsWith("<svg") ? "__SVG__" : node.rawHtml.slice(0, 200);
  }
  if (Object.keys(styles).length) out.styles = styles;
  const kids = node.children.map(compactAst).filter((c) => c.role !== "text" || c.content);
  if (kids.length) out.children = kids;
  return out;
}

export const AI_SYSTEM_PROMPT = `Eres un compilador experto de HTML a Elementor (sistema de Containers/flexbox de Elementor Pro). Recibes el árbol simplificado (AST) de UNA página con sus estilos computados y devuelves UNA plantilla de Elementor en JSON, lista para importar por *Plantillas → Importar plantillas*.

DEVUELVE SOLO JSON (sin markdown, sin explicaciones):
{"version":"0.4","title":"<título>","type":"container","content":[ <elementos de nivel superior> ]}

Elemento container: {"id":"<7 hex>","elType":"container","settings":{…},"elements":[…],"isInner":true|false}
Elemento widget:    {"id":"<7 hex>","elType":"widget","widgetType":"<tipo>","settings":{…},"elements":[]}

WIDGETS disponibles: heading (settings.title = texto con HTML inline permitido, header_size "h1".."h6", align), text-editor (settings.editor = HTML), button (settings.text, settings.link={url,is_external:"",nofollow:""}), image (settings.image={url,id:"",alt,source:"url",size:""}, image_size:"full"), icon, divider. Píldoras/etiquetas = widget button SIN link. SVG/embeds raros = widget "html" con settings.html.

REGLAS (críticas para que el diseño quede CLAVADO):
- Container siempre. MÁXIMO 3 niveles de anidamiento; si hiciera falta más, es una rejilla: usa flex row + flex_wrap:"wrap".
- CONSOLIDA: ignora los <div> envoltorio vacíos o sin estilo. No crees containers sin contenido ni estilo visible.
- Un container hijo DENTRO DE UNA FILA necesita ANCHO explícito (por defecto vale 100% y rompe la fila): proporción → width {unit:"%",size}; ancho fijo → width {unit:"px",size} + flex_grow:0; que mida su contenido → width {unit:"custom",size:"fit-content"}.
- Separación entre hijos con flex_gap del PADRE, no con padding en cada hijo.
- Objetos de MEDIDA: {unit,size,sizes:[]}. Objetos de CAJA (padding/margin/border_radius): {unit,top,right,bottom,left,isLinked} con los lados como STRINGS. HUECO: {unit,size,column,row,isLinked} con column/row STRINGS.
- Tipografía en el widget: typography_typography:"custom", typography_font_family, typography_font_size:{unit,size,sizes:[]}, typography_font_weight, typography_line_height, typography_letter_spacing, typography_text_transform. Usa align para heading/text.
- Color (valor hex/rgb tal cual): heading→title_color; text-editor→text_color; button→button_text_color y background_color; container→background_background:"classic"+background_color.
- Imagen de fondo del container: background_background:"classic", background_image:{url,id:"",source:"url"}, background_size:"cover", background_position:"center center".
- Imágenes: usa la url tal cual (si es "__IMG__" deja url:"" y añade alt). "__SVG__" → widget html vacío.
- PROHIBIDO: spacer, container_type, section, column. flex_direction por defecto es "column".
- Respeta los textos LITERALES. No inventes contenido ni secciones.

id = 7 caracteres hexadecimales, único dentro del archivo.
Responde ÚNICAMENTE con el objeto JSON.`;

/** Extrae y valida el JSON que devuelve la IA. Lanza si no es válido. */
export function parseAiDocument(text: string): ElementorDocument {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const slice = start >= 0 && end >= 0 ? raw.slice(start, end + 1) : raw;
  const parsed = JSON.parse(slice);
  return ElementorDocumentSchema.parse(parsed);
}

/** Mensaje de usuario para la IA a partir del AST compacto (ya sin data-URIs). */
export function buildAiUserMessage(title: string, compact: CompactNode): string {
  return `Título de la página: ${title}\n\nAST de la página (raíz = body; reconstruye su CONTENIDO como plantilla Elementor limpia):\n${JSON.stringify(compact)}`;
}
