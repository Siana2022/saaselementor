/**
 * =============================================================================
 *  PILAR 2 — Ingesta de páginas + Pattern Matching (Fase 2 del Two-Pass)
 * =============================================================================
 *
 * HTML -> AST base:
 *   - Construye el árbol de `AstNode` (recursivo) con cheerio.
 *   - Infiere `elementorRole` por etiqueta/heurística.
 *   - Enlaza `globalRefs` contra un `GlobalSystemAst` (var() o valor directo).
 *   - Pattern Matching: >=3 hijos con la MISMA firma estructural marcan al padre
 *     como `loop_candidate`/`repeater_candidate` y a los hijos como plantillas.
 *   - Fallback: etiquetas indescifrables (iframe, etc.) -> `html_widget` + rawHtml.
 *
 * Dominio: HTML/CSS -> AST. No conoce Elementor.
 * =============================================================================
 */

import * as cheerio from "cheerio";
import { isTag, isText, type Element, type ChildNode } from "domhandler";
import { v4 as uuidv4 } from "uuid";
import {
  AstNodeSchema,
  PageAstSchema,
  ProjectAstSchema,
  type AstNode,
  type ElementorRole,
  type GlobalRefs,
  type GlobalSystemAst,
  type PageAst,
  type ProjectAst,
  type StyleMap,
} from "@/lib/core/ast/types";
import { collectStyleCss, extractGlobalSystem } from "./global-system";
import { computeStyles } from "./css-resolver";

export interface HtmlParseOptions {
  idFactory?: () => string;
  /** Sistema global para enlazar `globalRefs`. */
  globalSystem?: GlobalSystemAst;
  /** Umbral de hijos idénticos para activar pattern matching (por defecto 3). */
  patternThreshold?: number;
  /** CSS explícito para resolver estilos computados (por defecto: los <style>). */
  css?: string;
}

/** Etiquetas que no aportan al diseño y se omiten del árbol. */
const SKIP_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "link",
  "meta",
  "head",
  "title",
  "base",
]);

/** Etiquetas que se envuelven como HTML crudo (JS/embeds indescifrables). */
const RAW_HTML_TAGS = new Set(["iframe", "object", "embed", "canvas"]);

const TEXT_TAGS = new Set([
  "p",
  "span",
  "strong",
  "em",
  "small",
  "blockquote",
  "label",
  "li",
  "figcaption",
  "cite",
  "q",
]);

const CONTAINER_TAGS = new Set([
  "section",
  "div",
  "main",
  "header",
  "footer",
  "article",
  "aside",
  "nav",
  "figure",
  "ul",
  "ol",
]);

/** Convierte un atributo `style` inline en un StyleMap. */
function parseInlineStyle(style: string | undefined): StyleMap {
  if (!style) return {};
  const out: StyleMap = {};
  for (const chunk of style.split(";")) {
    const idx = chunk.indexOf(":");
    if (idx < 0) continue;
    const prop = chunk.slice(0, idx).trim().toLowerCase();
    const value = chunk.slice(idx + 1).trim();
    if (prop && value) out[prop] = value;
  }
  return out;
}

/** Infiere el rol Elementor de un elemento. */
function inferRole(
  tagName: string,
  attribs: Record<string, string>,
  hasElementChildren: boolean,
  text: string,
): ElementorRole {
  const t = tagName.toLowerCase();
  const cls = (attribs.class ?? "").toLowerCase();

  if (RAW_HTML_TAGS.has(t)) return "html_widget";
  if (/^h[1-6]$/.test(t)) return "heading";
  if (t === "img" || t === "picture") return "image";
  if (t === "video") return "video";
  if (t === "svg") return "icon";
  if (t === "i" && /\b(fa|fas|far|fab|icon|material|bi|glyphicon)\b/.test(cls))
    return "icon";
  if (t === "button") return "button";
  if (t === "a") return /\b(btn|button|cta)\b/.test(cls) ? "button" : "link";
  if (t === "hr") return "divider";
  if (t === "form") return "form";
  if (t === "input" || t === "textarea" || t === "select") return "input";
  if (t === "ul" || t === "ol") return "list";
  if (TEXT_TAGS.has(t)) return "text";
  if (CONTAINER_TAGS.has(t)) return "container";
  if (hasElementChildren) return "container";
  if (text.trim()) return "text";
  return "unknown";
}

/** Firma estructural (ignora texto, clases e IDs): detecta repetición. */
function structuralSignature(node: AstNode): string {
  if (node.nodeType === "text") return "#t";
  const kids = node.children.filter((c) => c.nodeType === "element");
  return kids.length
    ? `${node.tagName}(${kids.map(structuralSignature).join(",")})`
    : node.tagName;
}

/** Profundidad de elementos (para distinguir loop vs repeater). */
function nodeDepth(node: AstNode): number {
  const kids = node.children.filter((c) => c.nodeType === "element");
  if (kids.length === 0) return 1;
  return 1 + Math.max(...kids.map(nodeDepth));
}

/** Enlaza estilos de color con IDs de colores globales. */
function resolveColorId(value: string, gs: GlobalSystemAst): string | undefined {
  const varMatch = value.match(/var\(\s*(--[\w-]+)\s*\)/);
  if (varMatch) {
    const byVar = gs.colors.find((c) => c.cssVariable === varMatch[1]);
    if (byVar) return byVar.id;
  }
  const norm = value.trim().toLowerCase();
  return gs.colors.find((c) => c.value.trim().toLowerCase() === norm)?.id;
}

function linkGlobalRefs(
  styles: StyleMap,
  gs: GlobalSystemAst | undefined,
): GlobalRefs | undefined {
  if (!gs) return undefined;
  const refs: Record<string, string> = {};
  const map: Array<[string, string]> = [
    ["color", "color"],
    ["background-color", "backgroundColor"],
    ["border-color", "borderColor"],
  ];
  for (const [styleKey, refKey] of map) {
    const v = styles[styleKey];
    if (!v) continue;
    const id = resolveColorId(v, gs);
    if (id) refs[refKey] = id;
  }
  return Object.keys(refs).length > 0 ? refs : undefined;
}

/** Detecta un patrón repetido entre los hijos y anota padre + plantillas. */
function applyPatternMatching(parent: AstNode, threshold: number): void {
  const elementChildren = parent.children.filter(
    (c) => c.nodeType === "element",
  );
  if (elementChildren.length < threshold) return;

  const groups = new Map<string, AstNode[]>();
  for (const child of elementChildren) {
    const sig = structuralSignature(child);
    const arr = groups.get(sig);
    if (arr) arr.push(child);
    else groups.set(sig, [child]);
  }

  let best: { sig: string; arr: AstNode[] } | undefined;
  for (const [sig, arr] of groups) {
    if (arr.length >= threshold && (!best || arr.length > best.arr.length)) {
      best = { sig, arr };
    }
  }
  if (!best) return;

  const template = best.arr[0];
  if (!template) return;
  const isLoop = nodeDepth(template) >= 2;
  parent.elementorRole = isLoop ? "loop_candidate" : "repeater_candidate";
  parent.patternMeta = {
    signature: best.sig,
    repeatedCount: best.arr.length,
    templateChildId: template.id,
  };
  for (const child of best.arr) {
    child.elementorRole = "loop_item_template";
    child.isTemplate = true;
  }
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Construye un AstNode desde un elemento cheerio (o null si se omite). */
function buildElementNode(
  el: Element,
  $: cheerio.CheerioAPI,
  opts: Required<Pick<HtmlParseOptions, "idFactory" | "patternThreshold">> &
    Pick<HtmlParseOptions, "globalSystem"> & { computed?: Map<Element, StyleMap> },
): AstNode | null {
  const tagName = el.name.toLowerCase();
  if (SKIP_TAGS.has(tagName)) return null;

  const attribs: Record<string, string> = { ...el.attribs };
  const classes = (attribs.class ?? "").split(/\s+/).filter(Boolean);
  // Estilos computados (cascada de clases) + inline por encima.
  const styles: StyleMap = { ...(opts.computed?.get(el) ?? {}), ...parseInlineStyle(attribs.style) };
  delete attribs.class;
  delete attribs.style;

  // Fallback de HTML crudo: no descendemos, inyectamos el outerHTML.
  if (RAW_HTML_TAGS.has(tagName)) {
    return AstNodeSchema.parse({
      id: opts.idFactory(),
      nodeType: "element",
      tagName,
      classes,
      attributes: attribs,
      styles,
      elementorRole: "html_widget",
      rawHtml: $.html(el),
      globalRefs: linkGlobalRefs(styles, opts.globalSystem),
    });
  }

  const children: AstNode[] = [];
  let combinedText = "";
  const elementChildren = el.children.filter(isTag);
  const hasElementChildren = elementChildren.length > 0;

  for (const child of el.children as ChildNode[]) {
    if (isText(child)) {
      const raw = child.data ?? "";
      if (!collapseWhitespace(raw)) continue;
      combinedText += raw;
      if (hasElementChildren) {
        children.push(
          AstNodeSchema.parse({
            id: opts.idFactory(),
            nodeType: "text",
            tagName: "#text",
            content: collapseWhitespace(raw),
            elementorRole: "text",
          }),
        );
      }
    } else if (isTag(child)) {
      const built = buildElementNode(child, $, opts);
      if (built) children.push(built);
    }
  }

  const text = collapseWhitespace(combinedText);
  const role = inferRole(tagName, { ...el.attribs }, hasElementChildren, text);

  const node: AstNode = AstNodeSchema.parse({
    id: opts.idFactory(),
    nodeType: "element",
    tagName,
    classes,
    attributes: attribs,
    styles,
    children,
    content: hasElementChildren ? undefined : text || undefined,
    elementorRole: role,
    globalRefs: linkGlobalRefs(styles, opts.globalSystem),
  });

  applyPatternMatching(node, opts.patternThreshold);
  return node;
}

/** Parsea HTML y devuelve el AstNode raíz (por defecto, `<body>`). */
export function htmlToAst(html: string, options: HtmlParseOptions = {}): AstNode {
  const $ = cheerio.load(html);
  const css =
    options.css ?? $("style").map((_, e) => $(e).text()).get().join("\n");
  const opts = {
    idFactory: options.idFactory ?? uuidv4,
    patternThreshold: options.patternThreshold ?? 3,
    globalSystem: options.globalSystem,
    computed: css ? computeStyles($, css) : new Map<Element, StyleMap>(),
  };
  const bodyEl = $("body")[0];
  if (bodyEl && isTag(bodyEl)) {
    const node = buildElementNode(bodyEl, $, opts);
    if (node) return node;
  }
  // Fallback: raíz sintética que envuelve el contenido de nivel superior.
  return AstNodeSchema.parse({
    id: opts.idFactory(),
    tagName: "body",
    elementorRole: "container",
  });
}

/** Envuelve el árbol en un PageAst. */
export function htmlToPageAst(
  html: string,
  meta: { name: string; fileName?: string },
  options: HtmlParseOptions = {},
): PageAst {
  const idFactory = options.idFactory ?? uuidv4;
  const root = htmlToAst(html, { ...options, idFactory });
  return PageAstSchema.parse({
    id: idFactory(),
    name: meta.name,
    root,
    source: { fileName: meta.fileName, templateType: "page" },
  });
}

/**
 * Integración Two-Pass: HTML -> ProjectAst completo.
 * Fase 1 (extractGlobalSystem sobre el CSS embebido) + Fase 2 (htmlToAst con
 * enlazado de globalRefs).
 */
export function buildProjectAst(
  html: string,
  meta: { name: string; fileName?: string },
  options: HtmlParseOptions = {},
): ProjectAst {
  const idFactory = options.idFactory ?? uuidv4;
  const css = collectStyleCss(html);
  const globalSystem = extractGlobalSystem(css, { idFactory });
  const page = htmlToPageAst(html, meta, { ...options, idFactory, globalSystem });
  return ProjectAstSchema.parse({
    id: idFactory(),
    name: meta.name,
    globalSystem,
    pages: [page],
  });
}
