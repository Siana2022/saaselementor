/**
 * =============================================================================
 *  PILAR 5 (b) — Compiler: AST -> Elementor JSON
 * =============================================================================
 *
 * Traduce el AST validado al esquema propietario de Elementor.
 *   - GlobalSystemAst -> Kit (system_colors / system_typography).
 *   - AstNode         -> ElementorElement (container / widget).
 *   - globalRefs      -> `__globals__` (globals/colors?id=... , globals/typography?id=...).
 *   - Widgets no cubiertos / html_widget -> widget "html" (fallback seguro).
 *
 * ⚠️ Los mapeos exactos de settings por widget son PROVISIONALES hasta validar
 * contra fixtures reales de Elementor.
 * =============================================================================
 */

import type {
  AstNode,
  GlobalColor,
  GlobalSystemAst,
  GlobalTypography,
  ProjectAst,
} from "@/lib/core/ast/types";
import {
  ElementorDocumentSchema,
  ElementorKitSchema,
  type ElementorDocument,
  type ElementorElement,
  type ElementorKit,
  type ElementorSettings,
} from "./elementor-types";

const ELEMENTOR_VERSION = "3.25.0";
const SCHEMA_VERSION = "0.4";

export interface CompileOptions {
  /** Fábrica de IDs cortos de Elementor (7 chars). Inyectable para tests. */
  elIdFactory?: () => string;
}

function defaultElId(): () => string {
  return () => Math.random().toString(16).slice(2, 9).padEnd(7, "0");
}

/* -------------------------------------------------------------------------- */
/*  Kit (globales)                                                            */
/* -------------------------------------------------------------------------- */

/** Mapa: UUID interno del global -> id corto de Elementor. */
export type GlobalIdMap = Map<string, string>;

function parseCssSize(value: string | undefined): { unit: string; size: number } | undefined {
  if (!value) return undefined;
  const m = value.trim().match(/^(-?[\d.]+)\s*(px|em|rem|%|vw|vh|pt)?$/);
  if (!m || m[1] === undefined) return undefined;
  const size = Number.parseFloat(m[1]);
  if (Number.isNaN(size)) return undefined;
  return { unit: m[2] ?? "px", size };
}

function compileColor(color: GlobalColor, shortId: string) {
  return { _id: shortId, title: color.name, color: color.value };
}

function compileTypography(typo: GlobalTypography, shortId: string) {
  const family = typo.fontFamily?.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  return {
    _id: shortId,
    title: typo.name,
    typography_typography: "custom" as const,
    ...(family ? { typography_font_family: family } : {}),
    ...(typo.fontWeight ? { typography_font_weight: typo.fontWeight } : {}),
    ...(parseCssSize(typo.fontSize) ? { typography_font_size: parseCssSize(typo.fontSize) } : {}),
    ...(parseCssSize(typo.lineHeight) ? { typography_line_height: parseCssSize(typo.lineHeight) } : {}),
    ...(parseCssSize(typo.letterSpacing)
      ? { typography_letter_spacing: parseCssSize(typo.letterSpacing) }
      : {}),
  };
}

/**
 * Compila el GlobalSystemAst a un Kit de Elementor y devuelve, además, el mapa
 * UUID->idCorto para poder referenciar los globales desde los widgets.
 */
export function compileKit(
  gs: GlobalSystemAst,
  opts: CompileOptions = {},
): { kit: ElementorKit; idMap: GlobalIdMap } {
  const elId = opts.elIdFactory ?? defaultElId();
  const idMap: GlobalIdMap = new Map();

  const system_colors = gs.colors.map((c) => {
    const shortId = elId();
    idMap.set(c.id, shortId);
    return compileColor(c, shortId);
  });
  const system_typography = gs.typographies.map((t) => {
    const shortId = elId();
    idMap.set(t.id, shortId);
    return compileTypography(t, shortId);
  });

  const kit = ElementorKitSchema.parse({
    version: SCHEMA_VERSION,
    title: "Global Kit",
    type: "kit",
    settings: { system_colors, custom_colors: [], system_typography, custom_typography: [] },
  });
  return { kit, idMap };
}

/* -------------------------------------------------------------------------- */
/*  Nodos -> widgets                                                          */
/* -------------------------------------------------------------------------- */

const HEADER_SIZES = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/** Reconstruye HTML simple para el fallback `html`. */
function reconstructHtml(node: AstNode): string {
  if (node.rawHtml) return node.rawHtml;
  if (node.nodeType === "text") return node.content ?? "";
  const cls = node.classes.length ? ` class="${node.classes.join(" ")}"` : "";
  const attrs = Object.entries(node.attributes)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("");
  const inner =
    node.content ?? node.children.map(reconstructHtml).join("");
  return `<${node.tagName}${cls}${attrs}>${inner}</${node.tagName}>`;
}

/** Aplica referencias globales de color/tipografía al objeto settings. */
function applyGlobals(
  node: AstNode,
  settings: ElementorSettings,
  colorSettingKey: string | undefined,
  idMap: GlobalIdMap,
): void {
  const globals: Record<string, string> = {};
  const colorId = node.globalRefs?.color;
  if (colorSettingKey && colorId && idMap.has(colorId)) {
    globals[colorSettingKey] = `globals/colors?id=${idMap.get(colorId)}`;
  }
  const typoId = node.globalRefs?.typography;
  if (typoId && idMap.has(typoId)) {
    globals["typography_typography"] = `globals/typography?id=${idMap.get(typoId)}`;
  }
  if (Object.keys(globals).length > 0) {
    (settings as Record<string, unknown>).__globals__ = globals;
  }
}

function widget(
  id: string,
  widgetType: string,
  settings: ElementorSettings,
): ElementorElement {
  return { id, elType: "widget", widgetType, settings, elements: [] };
}

/** Compila un AstNode a un ElementorElement (o null si se omite). */
function compileNode(node: AstNode, idMap: GlobalIdMap, elId: () => string): ElementorElement | null {
  if (node.nodeType === "text") return null; // el texto se absorbe en el padre
  const id = elId();

  switch (node.elementorRole) {
    case "heading": {
      const settings: ElementorSettings = { title: node.content ?? "" };
      if (HEADER_SIZES.has(node.tagName)) settings.header_size = node.tagName;
      applyGlobals(node, settings, "title_color", idMap);
      return widget(id, "heading", settings);
    }
    case "text": {
      const settings: ElementorSettings = { editor: `<p>${node.content ?? ""}</p>` };
      applyGlobals(node, settings, "text_color", idMap);
      return widget(id, "text-editor", settings);
    }
    case "button": {
      const settings: ElementorSettings = {
        text: node.content ?? "",
        link: { url: node.attributes.href ?? "#", is_external: "", nofollow: "" },
      };
      applyGlobals(node, settings, "button_text_color", idMap);
      return widget(id, "button", settings);
    }
    case "link": {
      const settings: ElementorSettings = {
        editor: `<a href="${node.attributes.href ?? "#"}">${node.content ?? ""}</a>`,
      };
      applyGlobals(node, settings, "text_color", idMap);
      return widget(id, "text-editor", settings);
    }
    case "image": {
      const settings: ElementorSettings = {
        image: { url: node.attributes.src ?? "", alt: node.attributes.alt ?? "" },
      };
      return widget(id, "image", settings);
    }
    case "divider":
      return widget(id, "divider", {});
    case "spacer":
      return widget(id, "spacer", {});
    case "container":
    case "loop_candidate":
    case "repeater_candidate":
    case "loop_grid":
    case "repeater":
    case "loop_item_template": {
      const settings: ElementorSettings = {};
      applyGlobals(node, settings, "background_color", idMap);
      // PROVISIONAL: loop/repeater se compila como container; el mapeo real del
      // widget Loop Grid requiere fixture. Marcamos el origen para el exporter.
      if (node.elementorRole !== "container" && node.elementorRole !== "loop_item_template") {
        (settings as Record<string, unknown>)._ast_pattern = node.elementorRole;
      }
      const elements = node.children
        .map((c) => compileNode(c, idMap, elId))
        .filter((e): e is ElementorElement => e !== null);
      return { id, elType: "container", settings, elements, isInner: false };
    }
    // Fallback seguro: html_widget, list, icon, video, form, input, unknown...
    default:
      return widget(id, "html", { html: reconstructHtml(node) });
  }
}

/* -------------------------------------------------------------------------- */
/*  Documento de página                                                       */
/* -------------------------------------------------------------------------- */

/** Compila el AstNode raíz de una página a un ElementorDocument. */
export function compilePageDocument(
  root: AstNode,
  title: string,
  idMap: GlobalIdMap,
  opts: CompileOptions = {},
): ElementorDocument {
  const elId = opts.elIdFactory ?? defaultElId();
  const compiledRoot = compileNode(root, idMap, elId);
  // El contenido de nivel superior son los hijos del <body> (o el propio nodo).
  const content =
    compiledRoot?.elType === "container" ? compiledRoot.elements : compiledRoot ? [compiledRoot] : [];
  return ElementorDocumentSchema.parse({
    version: SCHEMA_VERSION,
    title,
    type: "page",
    content,
    page_settings: {},
  });
}

/** Compila un único nodo-plantilla (hijo de un loop) como documento aparte. */
function compileTemplateDocument(
  template: AstNode,
  title: string,
  type: string,
  idMap: GlobalIdMap,
  elId: () => string,
): ElementorDocument {
  const compiled = compileNode(template, idMap, elId);
  return ElementorDocumentSchema.parse({
    version: SCHEMA_VERSION,
    title,
    type,
    content: compiled ? [compiled] : [],
    page_settings: {},
  });
}

/** Recorre el árbol y devuelve los nodos plantilla de cada patrón detectado. */
function collectLoopTemplates(root: AstNode): AstNode[] {
  const templates: AstNode[] = [];
  const visit = (node: AstNode): void => {
    const templateId = node.patternMeta?.templateChildId;
    if (templateId) {
      const tpl = node.children.find((c) => c.id === templateId);
      if (tpl) templates.push(tpl);
    }
    for (const child of node.children) visit(child);
  };
  visit(root);
  return templates;
}

export interface CompiledDocument {
  name: string;
  title: string;
  type: string;
  doc: ElementorDocument;
}

/** Bundle completo listo para empaquetar en ZIP. */
export interface CompiledBundle {
  kit: ElementorKit;
  documents: CompiledDocument[];
}

/** Compila un ProjectAst completo (kit + documentos de página + sub-templates de loops). */
export function compileProject(project: ProjectAst, opts: CompileOptions = {}): CompiledBundle {
  const elId = opts.elIdFactory ?? defaultElId();
  const { kit, idMap } = compileKit(project.globalSystem, { elIdFactory: elId });

  const documents: CompiledDocument[] = [];
  for (const page of project.pages) {
    documents.push({
      name: page.name,
      title: page.name,
      type: "page",
      doc: compilePageDocument(page.root, page.name, idMap, { elIdFactory: elId }),
    });
    // Sub-templates de loops/repeaters (uno por patrón detectado).
    collectLoopTemplates(page.root).forEach((tpl, i) => {
      const name = `${page.name}-loop-item-${i + 1}`;
      documents.push({
        name,
        title: name,
        type: "loop-item",
        doc: compileTemplateDocument(tpl, name, "loop-item", idMap, elId),
      });
    });
  }
  return { kit, documents };
}
