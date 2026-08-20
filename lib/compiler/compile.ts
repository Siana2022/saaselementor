/**
 * =============================================================================
 *  PILAR 5 (b) — Compiler: AST -> Elementor JSON
 * =============================================================================
 *
 * Traduce el AST validado al esquema propietario de Elementor. Mapeos AFINADOS
 * contra fixtures reales (fixtures/pages/*.json):
 *   - heading  -> {title, header_size} + __globals__.title_color
 *   - text     -> text-editor {editor}  + __globals__.text_color
 *   - button   -> {text, link}          + __globals__.button_text_color
 *   - image    -> {image:{url,id,alt,source,size}, image_size}
 *   - container-> {} (+ __globals__.background_color)
 *   - loop_grid/repeater CONFIRMADOS -> widget loop-grid {template_id, columns}
 *     (los candidatos heurísticos se compilan como container estático)
 *   - dynamicMapping -> __dynamic__ (formato [elementor-tag ...])
 *   - resto / html_widget -> widget "html" (fallback seguro)
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
  SiteSettingsSchema,
  type ElementorDocument,
  type ElementorElement,
  type SiteSettings,
  type ElementorSettings,
} from "./elementor-types";

const SCHEMA_VERSION = "0.4";

export interface CompileOptions {
  /** Fábrica de IDs cortos de Elementor (7 chars). Inyectable para tests. */
  elIdFactory?: () => string;
}

function defaultElId(): () => string {
  return () => Math.random().toString(16).slice(2, 9).padEnd(7, "0");
}

/** Mapa: UUID interno del global -> id corto de Elementor. */
export type GlobalIdMap = Map<string, string>;

interface CompileCtx {
  idMap: GlobalIdMap;
  elId: () => string;
  /** nodeId de un loop confirmado -> datos del widget loop-grid. */
  loopTemplates: Map<string, { templateId: string; columns: string }>;
}

/* -------------------------------------------------------------------------- */
/*  Kit (globales)                                                            */
/* -------------------------------------------------------------------------- */

function parseCssSize(value: string | undefined): { unit: string; size: number; sizes: number[] } | undefined {
  if (!value) return undefined;
  const m = value.trim().match(/^(-?[\d.]+)\s*(px|em|rem|%|vw|vh|pt)?$/);
  if (!m || m[1] === undefined) return undefined;
  const size = Number.parseFloat(m[1]);
  if (Number.isNaN(size)) return undefined;
  return { unit: m[2] ?? "px", size, sizes: [] };
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
 * Slots de sistema de Elementor. Los 4 primeros globales extraídos se mapean a
 * estos slots (namespace separado para colores y tipografías); el resto van a
 * `custom_*` con ids generados. `globalRefs` referencia el `_id` asignado.
 */
const SYSTEM_SLOTS = ["primary", "secondary", "text", "accent"] as const;

/**
 * Compila el GlobalSystemAst a `site-settings.json` (Kit real) + mapa
 * UUID->_id (slug de sistema o id custom).
 */
export function compileKit(
  gs: GlobalSystemAst,
  opts: CompileOptions = {},
): { siteSettings: SiteSettings; idMap: GlobalIdMap } {
  const elId = opts.elIdFactory ?? defaultElId();
  const idMap: GlobalIdMap = new Map();

  const system_colors: ReturnType<typeof compileColor>[] = [];
  const custom_colors: ReturnType<typeof compileColor>[] = [];
  gs.colors.forEach((c, i) => {
    const slot = SYSTEM_SLOTS[i];
    const _id = slot ?? elId();
    idMap.set(c.id, _id);
    (slot ? system_colors : custom_colors).push(compileColor(c, _id));
  });

  const system_typography: ReturnType<typeof compileTypography>[] = [];
  const custom_typography: ReturnType<typeof compileTypography>[] = [];
  gs.typographies.forEach((t, i) => {
    const slot = SYSTEM_SLOTS[i];
    const _id = slot ?? elId();
    idMap.set(t.id, _id);
    (slot ? system_typography : custom_typography).push(compileTypography(t, _id));
  });

  const siteSettings = SiteSettingsSchema.parse({
    content: [],
    settings: { system_colors, custom_colors, system_typography, custom_typography },
    metadata: [],
    experiments: [],
  });
  return { siteSettings, idMap };
}

/* -------------------------------------------------------------------------- */
/*  Nodos -> widgets                                                          */
/* -------------------------------------------------------------------------- */

const HEADER_SIZES = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function reconstructHtml(node: AstNode): string {
  if (node.rawHtml) return node.rawHtml;
  if (node.nodeType === "text") return node.content ?? "";
  const cls = node.classes.length ? ` class="${node.classes.join(" ")}"` : "";
  const attrs = Object.entries(node.attributes)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("");
  const inner = node.content ?? node.children.map(reconstructHtml).join("");
  return `<${node.tagName}${cls}${attrs}>${inner}</${node.tagName}>`;
}

/** Aplica referencias globales de color/tipografía a settings (`__globals__`). */
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

/** Aplica dynamicMapping como `__dynamic__` (formato [elementor-tag ...]). */
function applyDynamic(
  node: AstNode,
  settings: ElementorSettings,
  binding: string,
  settingKey: string,
): void {
  const dm = node.dynamicMapping?.[binding];
  if (!dm) return;
  const token = dm.token ?? `[elementor-tag name="${dm.tag}"]`;
  const dyn = ((settings as Record<string, unknown>).__dynamic__ ??= {}) as Record<string, string>;
  dyn[settingKey] = token;
}

function widget(id: string, widgetType: string, settings: ElementorSettings): ElementorElement {
  return { id, elType: "widget", widgetType, settings, elements: [] };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function compileNode(node: AstNode, ctx: CompileCtx): ElementorElement | null {
  if (node.nodeType === "text") return null;
  const id = ctx.elId();

  switch (node.elementorRole) {
    case "heading": {
      const settings: ElementorSettings = { title: node.content ?? "" };
      if (HEADER_SIZES.has(node.tagName)) settings.header_size = node.tagName;
      applyGlobals(node, settings, "title_color", ctx.idMap);
      applyDynamic(node, settings, "content", "title");
      return widget(id, "heading", settings);
    }
    case "text": {
      const settings: ElementorSettings = { editor: `<p>${node.content ?? ""}</p>` };
      applyGlobals(node, settings, "text_color", ctx.idMap);
      applyDynamic(node, settings, "content", "editor");
      return widget(id, "text-editor", settings);
    }
    case "button": {
      const settings: ElementorSettings = {
        text: node.content ?? "",
        link: { url: node.attributes.href ?? "#", is_external: "", nofollow: "", custom_attributes: "" },
      };
      applyGlobals(node, settings, "button_text_color", ctx.idMap);
      applyDynamic(node, settings, "content", "text");
      return widget(id, "button", settings);
    }
    case "link": {
      const settings: ElementorSettings = {
        editor: `<a href="${node.attributes.href ?? "#"}">${node.content ?? ""}</a>`,
      };
      applyGlobals(node, settings, "text_color", ctx.idMap);
      return widget(id, "text-editor", settings);
    }
    case "image": {
      const settings: ElementorSettings = {
        image: {
          url: node.attributes.src ?? "",
          id: "",
          alt: node.attributes.alt ?? "",
          source: "library",
          size: "",
        },
        image_size: "full",
      };
      applyDynamic(node, settings, "src", "image");
      return widget(id, "image", settings);
    }
    case "divider":
      return widget(id, "divider", {});
    case "spacer":
      return widget(id, "spacer", {});

    case "loop_grid":
    case "repeater": {
      const info = ctx.loopTemplates.get(node.id);
      if (info) {
        return widget(id, "loop-grid", {
          _skin: "post",
          template_id: info.templateId,
          columns: info.columns,
          posts_per_page: 6,
        });
      }
      // Sin plantilla resuelta -> se comporta como container estático.
      return compileContainer(node, id, ctx);
    }

    case "container":
    case "loop_candidate":
    case "repeater_candidate":
    case "loop_item_template":
      return compileContainer(node, id, ctx);

    // Fallback seguro: list, icon, icon_box, video, form, input, html_widget, unknown...
    default:
      return widget(id, "html", { html: reconstructHtml(node) });
  }
}

function compileContainer(node: AstNode, id: string, ctx: CompileCtx): ElementorElement {
  const settings: ElementorSettings = {};
  applyGlobals(node, settings, "background_color", ctx.idMap);
  const elements = node.children
    .map((c) => compileNode(c, ctx))
    .filter((e): e is ElementorElement => e !== null);
  return { id, elType: "container", settings, elements, isInner: false };
}

/* -------------------------------------------------------------------------- */
/*  Documentos                                                                */
/* -------------------------------------------------------------------------- */

function compileDocument(root: AstNode, title: string, type: string, ctx: CompileCtx): ElementorDocument {
  const compiledRoot = compileNode(root, ctx);
  // El contenido de nivel superior son los hijos del <body> (o el propio nodo).
  const content =
    compiledRoot?.elType === "container" ? compiledRoot.elements : compiledRoot ? [compiledRoot] : [];
  return ElementorDocumentSchema.parse({
    version: SCHEMA_VERSION,
    title,
    type,
    content,
    page_settings: [],
  });
}

/** Compila el AstNode raíz de una página a un ElementorDocument. */
export function compilePageDocument(
  root: AstNode,
  title: string,
  idMap: GlobalIdMap,
  opts: CompileOptions = {},
): ElementorDocument {
  const elId = opts.elIdFactory ?? defaultElId();
  return compileDocument(root, title, "page", { idMap, elId, loopTemplates: new Map() });
}

/** Recorre el árbol y devuelve los nodos de loop CONFIRMADO (loop_grid/repeater). */
function collectConfirmedLoops(root: AstNode): AstNode[] {
  const loops: AstNode[] = [];
  const visit = (node: AstNode): void => {
    if (
      (node.elementorRole === "loop_grid" || node.elementorRole === "repeater") &&
      node.patternMeta?.templateChildId
    ) {
      loops.push(node);
    }
    for (const child of node.children) visit(child);
  };
  visit(root);
  return loops;
}

export interface CompiledDocument {
  name: string;
  title: string;
  type: string;
  doc: ElementorDocument;
}

export interface CompiledBundle {
  siteSettings: SiteSettings;
  documents: CompiledDocument[];
}

/** Compila un ProjectAst completo (kit + páginas + sub-templates de loops). */
export function compileProject(project: ProjectAst, opts: CompileOptions = {}): CompiledBundle {
  const elId = opts.elIdFactory ?? defaultElId();
  const { siteSettings, idMap } = compileKit(project.globalSystem, { elIdFactory: elId });
  const ctx: CompileCtx = { idMap, elId, loopTemplates: new Map() };

  const loopDocs: CompiledDocument[] = [];
  // Pass 1: por cada loop confirmado, compila su plantilla como doc "loop-item"
  // y registra el template_id para que el widget loop-grid lo referencie.
  for (const page of project.pages) {
    collectConfirmedLoops(page.root).forEach((loopNode, i) => {
      const tpl = loopNode.children.find((c) => c.id === loopNode.patternMeta?.templateChildId);
      if (!tpl) return;
      const templateId = ctx.elId();
      const columns = String(clamp(loopNode.patternMeta?.repeatedCount ?? 3, 1, 6));
      ctx.loopTemplates.set(loopNode.id, { templateId, columns });
      const name = `${page.name}-loop-item-${i + 1}`;
      loopDocs.push({ name, title: name, type: "loop-item", doc: compileDocument(tpl, name, "loop-item", ctx) });
    });
  }

  // Pass 2: compila las páginas (los loop-grid ya resuelven su template_id).
  const documents: CompiledDocument[] = [];
  for (const page of project.pages) {
    documents.push({
      name: page.name,
      title: page.name,
      type: "page",
      doc: compileDocument(page.root, page.name, "page", ctx),
    });
  }
  documents.push(...loopDocs);
  return { siteSettings, documents };
}
