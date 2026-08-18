/**
 * =============================================================================
 *  AST UNIVERSAL — "idioma universal" del sistema HTML → Elementor
 * =============================================================================
 *
 * REGLA DE ORO: nadie toca directamente el HTML ni el JSON de Elementor.
 * Todo pasa por este AST. Existen dos dominios estrictamente separados:
 *
 *   1. HTML  ->  AST         (Pilar 2: Parser / Pattern Matching)
 *   2. AST   ->  Elementor   (Pilar 5: Page Compiler & Exporter)
 *
 * Este archivo define ÚNICAMENTE el modelo de datos (schemas Zod + tipos TS).
 * No contiene lógica de parsing ni de compilación.
 *
 * Compilación en dos fases (Two-Pass):
 *   - Fase 1: GlobalSystemAst  (colores + tipografías globales -> Kit)
 *   - Fase 2: ProjectAst.pages (árbol de nodos por página)
 *
 * Nota de versiones: Zod v4. `z.record` exige (keySchema, valueSchema).
 * =============================================================================
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Primitivos de estilo                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Mapa de propiedades CSS -> valor (string sin normalizar todavía).
 * Las claves se guardan tal cual llegan del parser (se recomienda kebab-case,
 * ej. "font-size", "background-color") para no perder información de origen.
 */
export const StyleMapSchema = z.record(z.string(), z.string());
export type StyleMap = z.infer<typeof StyleMapSchema>;

/**
 * Estilos responsive. Elementor es "responsive-first": mantenemos overrides
 * por breakpoint para poder mapear a los device settings del widget.
 * `styles` del nodo son los estilos base (desktop).
 */
export const ResponsiveStylesSchema = z.object({
  tablet: StyleMapSchema.optional(),
  mobile: StyleMapSchema.optional(),
});
export type ResponsiveStyles = z.infer<typeof ResponsiveStylesSchema>;

/* -------------------------------------------------------------------------- */
/*  Roles de Elementor                                                        */
/* -------------------------------------------------------------------------- */

/**
 * `elementorRole` es la INFERENCIA semántica del nodo.
 *
 * - Los sufijos `*_candidate` los asigna el parser (Fase 2, heurístico).
 * - Los roles "confirmados" (loop_grid, repeater, loop_item_template) los fija
 *   la IA o el usuario a través de una mutación del AST (Pilar 4).
 * - `html_widget` es el FALLBACK: cuando el CSS/JS es indescifrable (sliders,
 *   scripts, etc.) se envuelve el nodo y su HTML crudo se inyecta tal cual en
 *   Elementor para no romper el diseño (Regla de Manejo de Errores).
 */
export const ElementorRoleSchema = z.enum([
  // --- Estructura ---
  "container", // section / column / flex/grid container
  // --- Widgets atómicos ---
  "heading",
  "text", // párrafo / text-editor
  "image",
  "button",
  "link",
  "icon",
  "icon_box",
  "video",
  "list",
  "divider",
  "spacer",
  "form",
  "input",
  // --- Patrones dinámicos (base de datos) ---
  "repeater_candidate", // padre con N hijos idénticos -> candidato a Repeater
  "loop_candidate", // padre candidato a Loop Grid (query de CPT)
  "loop_grid", // confirmado: Loop Grid dinámico
  "repeater", // confirmado: Repeater de un widget
  "loop_item_template", // hijo canónico usado como plantilla del loop/repeater
  // --- Fallback / desconocido ---
  "html_widget", // inyección de HTML crudo (indescifrable)
  "unknown",
]);
export type ElementorRole = z.infer<typeof ElementorRoleSchema>;

/* -------------------------------------------------------------------------- */
/*  Mapeo dinámico (Dynamic Tags de Elementor)                                */
/* -------------------------------------------------------------------------- */

/**
 * Un binding a un Dynamic Tag de Elementor.
 *
 * El documento original ejemplificaba `{ content: "[post_title]" }`.
 * Enriquecemos esa forma: `token` conserva esa representación tipo shortcode,
 * y añadimos `tag` (nombre canónico del dynamic tag) + `settings` para poder
 * compilar la estructura real que espera Elementor.
 */
export const DynamicTagBindingSchema = z.object({
  /** Nombre canónico del dynamic tag de Elementor, ej. "post-title". */
  tag: z.string(),
  /** Representación tipo token/shortcode, ej. "[post_title]". */
  token: z.string().optional(),
  /** Ajustes adicionales del dynamic tag (before/after, fallback, etc.). */
  settings: z.record(z.string(), z.unknown()).optional(),
});
export type DynamicTagBinding = z.infer<typeof DynamicTagBindingSchema>;

/**
 * Mapea un "punto de anclaje" del nodo a un dynamic tag.
 * Claves habituales: "content", "url", "src", "alt", "background_image".
 */
export const DynamicMappingSchema = z.record(z.string(), DynamicTagBindingSchema);
export type DynamicMapping = z.infer<typeof DynamicMappingSchema>;

/* -------------------------------------------------------------------------- */
/*  Referencias al sistema global (Kit)                                       */
/* -------------------------------------------------------------------------- */

/**
 * Mapea propiedades de estilo del nodo hacia IDs del GlobalSystemAst.
 * Si un estilo coincide con el Kit, el compilador NO hardcodea el valor:
 * apunta al Global (ej. `globals/colors?id=<id>`).
 *
 * Claves conocidas para DX; `catchall` permite cualquier otra propiedad de
 * estilo -> ID global.
 */
export const GlobalRefsSchema = z
  .object({
    /** ID de un GlobalColor para el color de texto. */
    color: z.string().optional(),
    /** ID de un GlobalColor para el color de fondo. */
    backgroundColor: z.string().optional(),
    /** ID de un GlobalColor para el color del borde. */
    borderColor: z.string().optional(),
    /** ID de un GlobalTypography aplicado al nodo. */
    typography: z.string().optional(),
  })
  .catchall(z.string());
export type GlobalRefs = z.infer<typeof GlobalRefsSchema>;

/* -------------------------------------------------------------------------- */
/*  Pattern matching                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Metadatos que el parser adjunta al nodo PADRE cuando detecta un patrón
 * repetido (>= 3 hijos con estructura idéntica). Habilita Repeater / Loop Grid.
 */
export const PatternMetaSchema = z.object({
  /** Hash/firma estructural compartida por los hijos repetidos. */
  signature: z.string(),
  /** Número de hijos que comparten la firma. */
  repeatedCount: z.number().int().nonnegative(),
  /** ID del hijo elegido como plantilla canónica del patrón. */
  templateChildId: z.string().optional(),
});
export type PatternMeta = z.infer<typeof PatternMetaSchema>;

/* -------------------------------------------------------------------------- */
/*  Nodo del AST                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Tipo de nodo. Convención tipo DOM:
 *  - "element": nodo con `tagName` real (div, p, img...).
 *  - "text":    nodo de texto puro; `tagName` = "#text" y `content` = texto.
 */
export const NodeTypeSchema = z.enum(["element", "text"]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

/**
 * Interfaz TS del nodo. Se declara explícitamente para poder tipar el schema
 * recursivo (`children`) con `z.lazy`.
 */
export interface AstNode {
  /** UUID interno del sistema (no confundir con el atributo `id` del HTML). */
  id: string;
  /** "element" | "text". */
  nodeType: NodeType;
  /** Etiqueta HTML original ("div", "p", "img"...) o "#text". */
  tagName: string;
  /** Clases CSS del elemento. */
  classes: string[];
  /**
   * Atributos HTML relevantes (href, src, alt, id, data-*, aria-*...).
   * Necesarios para el compilador (URLs de botones/enlaces, src/alt de imágenes).
   */
  attributes: Record<string, string>;
  /** CSS base (desktop): computado + inline, sin normalizar. */
  styles: StyleMap;
  /** Overrides responsive (tablet/mobile). */
  responsive?: ResponsiveStyles;
  /** Estilos de estado :hover (botones/enlaces). */
  hoverStyles?: StyleMap;
  /** Hijos del nodo. */
  children: AstNode[];
  /** Texto (solo para nodeType "text", o texto directo de un elemento). */
  content?: string;
  /** Rol Elementor inferido/confirmado. */
  elementorRole: ElementorRole;
  /** Mapeo a dynamic tags de Elementor (opcional). */
  dynamicMapping?: DynamicMapping;
  /** Referencias a globals del Kit (opcional). */
  globalRefs?: GlobalRefs;
  /** Metadatos de patrón repetido (solo en el nodo padre). */
  patternMeta?: PatternMeta;
  /** Marca a un hijo como plantilla dentro de un patrón. */
  isTemplate?: boolean;
  /**
   * HTML crudo original. Obligatorio en la práctica cuando
   * `elementorRole === "html_widget"` (fallback de inyección).
   */
  rawHtml?: string;
}

/**
 * Schema Zod recursivo del nodo. `z.lazy` permite la auto-referencia en
 * `children`. La anotación `z.ZodType<AstNode>` fija el tipo de salida.
 */
export const AstNodeSchema: z.ZodType<AstNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    nodeType: NodeTypeSchema.default("element"),
    tagName: z.string(),
    classes: z.array(z.string()).default([]),
    attributes: z.record(z.string(), z.string()).default({}),
    styles: StyleMapSchema.default({}),
    responsive: ResponsiveStylesSchema.optional(),
    hoverStyles: StyleMapSchema.optional(),
    children: z.array(AstNodeSchema).default([]),
    content: z.string().optional(),
    elementorRole: ElementorRoleSchema.default("unknown"),
    dynamicMapping: DynamicMappingSchema.optional(),
    globalRefs: GlobalRefsSchema.optional(),
    patternMeta: PatternMetaSchema.optional(),
    isTemplate: z.boolean().optional(),
    rawHtml: z.string().optional(),
  }),
);

/* -------------------------------------------------------------------------- */
/*  GLOBAL SYSTEM AST (Pilar 1)                                               */
/* -------------------------------------------------------------------------- */

/** Origen desde el que se dedujo un global (para trazabilidad / debug). */
export const GlobalSourceSchema = z.enum([
  "root-variable", // :root { --x }
  "tag", // h1..h6, body...
  "class", // clase global reutilizada
  "inferred", // deducido por frecuencia/heurística
]);
export type GlobalSource = z.infer<typeof GlobalSourceSchema>;

/** Color global del Kit. */
export const GlobalColorSchema = z.object({
  /** UUID interno; el compilador lo referencia como globals/colors?id=<id>. */
  id: z.string().uuid(),
  /** Nombre legible ("Primary", "Secondary", "Accent", "Text"...). */
  name: z.string(),
  /** Valor CSS (hex / rgb / rgba / hsl). */
  value: z.string(),
  /** Nombre de la custom property si vino de :root (ej. "--color-primary"). */
  cssVariable: z.string().optional(),
  source: GlobalSourceSchema.optional(),
});
export type GlobalColor = z.infer<typeof GlobalColorSchema>;

/** Tipografía global del Kit. */
export const GlobalTypographySchema = z.object({
  id: z.string().uuid(),
  /** Nombre legible ("H1"..."H6", "Body", "Primary", "Secondary"...). */
  name: z.string(),
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.string().optional(),
  lineHeight: z.string().optional(),
  letterSpacing: z.string().optional(),
  textTransform: z.string().optional(),
  fontStyle: z.string().optional(),
  textDecoration: z.string().optional(),
  /** Selector CSS de origen (ej. "h1", ".lead"). */
  selector: z.string().optional(),
  source: GlobalSourceSchema.optional(),
});
export type GlobalTypography = z.infer<typeof GlobalTypographySchema>;

/**
 * GlobalSystemAst — Sistema de Diseño Global extraído en la Fase 1.
 * Es la fuente de verdad que genera `elementor-kit.json` (ajustes del sitio).
 */
export const GlobalSystemAstSchema = z.object({
  id: z.string().uuid(),
  colors: z.array(GlobalColorSchema).default([]),
  typographies: z.array(GlobalTypographySchema).default([]),
  /** Custom properties de :root capturadas verbatim (--nombre -> valor). */
  rootVariables: z.record(z.string(), z.string()).optional(),
  meta: z
    .object({
      /** Fuentes tipográficas detectadas (para el kit y @font-face). */
      fontFamilies: z.array(z.string()).optional(),
      /** Notas del extractor sobre decisiones heurísticas. */
      notes: z.array(z.string()).optional(),
    })
    .optional(),
});
export type GlobalSystemAst = z.infer<typeof GlobalSystemAstSchema>;

/* -------------------------------------------------------------------------- */
/*  PAGE & PROJECT                                                            */
/* -------------------------------------------------------------------------- */

/** Una página = un árbol de nodos + metadatos de origen. */
export const PageAstSchema = z.object({
  id: z.string().uuid(),
  /** Nombre de la página / plantilla (ej. "home", "blog-archive"). */
  name: z.string(),
  /** Nodo raíz del árbol. */
  root: AstNodeSchema,
  source: z
    .object({
      fileName: z.string().optional(),
      /** Tipo de plantilla Elementor destino. */
      templateType: z
        .enum(["page", "section", "container", "loop-item", "header", "footer"])
        .optional(),
    })
    .optional(),
});
export type PageAst = z.infer<typeof PageAstSchema>;

/**
 * ProjectAst — raíz absoluta del modelo. Combina el sistema global (Fase 1)
 * con todas las páginas (Fase 2). Es lo que vive en Zustand y lo que consume
 * el compilador para generar el ZIP de Elementor Template Kit.
 */
export const ProjectAstSchema = z.object({
  /** Versión del esquema del AST (para migraciones futuras). */
  schemaVersion: z.literal("1.0.0").default("1.0.0"),
  id: z.string().uuid(),
  name: z.string(),
  globalSystem: GlobalSystemAstSchema,
  pages: z.array(PageAstSchema).default([]),
});
export type ProjectAst = z.infer<typeof ProjectAstSchema>;

/* -------------------------------------------------------------------------- */
/*  Helpers de validación                                                     */
/* -------------------------------------------------------------------------- */

/** Valida (y aplica defaults) a un nodo suelto. Lanza ZodError si es inválido. */
export function parseAstNode(input: unknown): AstNode {
  return AstNodeSchema.parse(input);
}

/** Valida un ProjectAst completo. Lanza ZodError si es inválido. */
export function parseProjectAst(input: unknown): ProjectAst {
  return ProjectAstSchema.parse(input);
}
