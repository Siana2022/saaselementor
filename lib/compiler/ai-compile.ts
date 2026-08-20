/**
 * =============================================================================
 *  Compilador con IA — el SaaS ejecuta la "skill": Claude reconstruye una
 *  página (HTML+CSS real) como plantilla Elementor limpia.
 * =============================================================================
 *
 * Igual que la skill del equipo: se le da a Claude el DISEÑO real (HTML + CSS)
 * y devuelve el JSON de Elementor `type:"container"`, que validamos con Zod.
 * Piezas puras (prompt, limpieza, parseo); la llamada API vive en la ruta.
 * =============================================================================
 */

import { ElementorDocumentSchema, type ElementorDocument } from "./elementor-types";

/** Quita data-URIs (imágenes/fuentes embebidas) para no disparar tokens. */
export function stripDataUris(html: string): string {
  return html
    .replace(/(src|href)\s*=\s*"data:[^"]*"/gi, '$1=""')
    .replace(/url\(\s*['"]?data:[^)]*\)/gi, "url()");
}

export const AI_SYSTEM_PROMPT = `Eres un compilador experto de HTML a Elementor (sistema de Containers/flexbox de Elementor Pro). Recibes el HTML + CSS REAL de UNA página y devuelves UNA plantilla de Elementor en JSON, lista para importar por *Plantillas → Importar plantillas*.

Tu trabajo NO es traducir etiqueta por etiqueta: es RECONSTRUIR el diseño con criterio, como lo maquetaría un profesional en Elementor. Lee el diseño, entiende su estructura (secciones, filas, tarjetas, botones, títulos) y compón Containers y widgets limpios.

DEVUELVE SOLO JSON (sin markdown, sin explicaciones, sin texto antes ni después):
{"version":"0.4","title":"<título>","type":"container","content":[ <containers de nivel superior> ]}

Elemento container: {"id":"<7 hex>","elType":"container","settings":{…},"elements":[…],"isInner":true|false}
Elemento widget:    {"id":"<7 hex>","elType":"widget","widgetType":"<tipo>","settings":{…},"elements":[]}

WIDGETS: heading (settings.title = texto, admite HTML inline como <br>/<span>; header_size "h1".."h6"; align), text-editor (settings.editor = HTML del párrafo), button (settings.text, settings.link={url,is_external:"",nofollow:""}), image (settings.image={url,id:"",alt,source:"url",size:""}, image_size:"full"), icon, divider. Píldoras/etiquetas = widget button SIN link. SVG/embeds/vídeos/iconos raros = widget "html" con settings.html = el HTML original.

REGLAS (críticas para que el diseño quede CLAVADO):
- Container siempre (nunca section/column). MÁXIMO 3 niveles de anidamiento; una rejilla de tarjetas = flex row + flex_wrap:"wrap", no más niveles.
- CONSOLIDA: ignora los <div> envoltorio sin estilo. No crees containers vacíos ni cadenas div>div>div. Menos y mejores.
- Un container hijo DENTRO DE UNA FILA necesita ANCHO explícito (por defecto vale 100% y rompe la fila): proporción (50/50, 60/40) → width {unit:"%",size}; ancho fijo → width {unit:"px",size} + flex_grow:0; que mida su contenido → width {unit:"custom",size:"fit-content"}.
- Separación entre hijos con flex_gap del PADRE, no con padding en cada hijo. NADA de spacer.
- Objetos de MEDIDA: {unit,size,sizes:[]}. Objetos de CAJA (padding/margin/border_radius): {unit,top,right,bottom,left,isLinked} con los lados como STRINGS. HUECO (flex_gap): {unit,size,column,row,isLinked} con column/row STRINGS.
- Tipografía en el widget: typography_typography:"custom", typography_font_family, typography_font_size:{unit,size,sizes:[]}, typography_font_weight, typography_line_height, typography_letter_spacing, typography_text_transform. Para tamaños con clamp()/fluidos usa el tamaño de escritorio. align para heading/text.
- Color (valor hex/rgb TAL CUAL del CSS): heading→title_color; text-editor→text_color; button→button_text_color y background_color; container→background_background:"classic"+background_color.
- Imagen de fondo del container: background_background:"classic", background_image:{url,id:"",source:"url"}, background_size:"cover", background_position:"center center". Mantén la url tal cual.
- Fondo/hero con imagen: es fondo del container, no una imagen absoluta encima.
- PROHIBIDO: spacer, container_type, section, column. flex_direction por defecto es "column".
- Respeta los TEXTOS literales del HTML. No inventes contenido ni secciones.

id = 7 caracteres hexadecimales, único dentro del archivo.
Responde ÚNICAMENTE con el objeto JSON.`;

/** Mensaje de usuario para la IA: título + HTML+CSS real (sin data-URIs). */
export function buildAiUserMessage(title: string, html: string): string {
  return `Título de la página: ${title}\n\nHTML + CSS de la página (reconstrúyela como plantilla Elementor limpia siguiendo las reglas):\n\n${stripDataUris(html)}`;
}

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
