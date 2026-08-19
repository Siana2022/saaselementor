/**
 * =============================================================================
 *  PILAR 3 (a) — Renderer AST -> HTML para el <iframe sandbox>
 * =============================================================================
 *
 * Reconstruye HTML desde el AST preservando clases, atributos y estilos inline,
 * y añade `data-ast-id` a cada elemento para permitir la selección (clic ->
 * postMessage del id al panel de chat). El CSS original se inyecta aparte por el
 * componente del iframe para fidelidad visual.
 * =============================================================================
 */

import type { AstNode } from "@/lib/core/ast/types";

const VOID_TAGS = new Set([
  "img", "input", "br", "hr", "meta", "link", "source", "area", "base", "col", "embed", "track", "wbr",
]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function styleToString(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/** Serializa un AstNode (y sus hijos) a HTML con `data-ast-id`. */
export function astToHtml(node: AstNode): string {
  if (node.nodeType === "text") {
    return escapeHtml(node.content ?? "");
  }

  if (node.elementorRole === "html_widget" && node.rawHtml) {
    return `<div data-ast-id="${escapeAttr(node.id)}" data-ast-raw="1">${node.rawHtml}</div>`;
  }

  const tag = node.tagName === "#text" ? "span" : node.tagName;
  const attrParts: string[] = [`data-ast-id="${escapeAttr(node.id)}"`];

  if (node.classes.length > 0) {
    attrParts.push(`class="${escapeAttr(node.classes.join(" "))}"`);
  }
  const styleStr = styleToString(node.styles);
  if (styleStr) attrParts.push(`style="${escapeAttr(styleStr)}"`);

  for (const [k, v] of Object.entries(node.attributes)) {
    if (k === "class" || k === "style") continue;
    attrParts.push(`${k}="${escapeAttr(v)}"`);
  }

  const open = `<${tag} ${attrParts.join(" ")}>`;
  if (VOID_TAGS.has(tag)) return `<${tag} ${attrParts.join(" ")}>`;

  const inner =
    node.children.length > 0
      ? node.children.map(astToHtml).join("")
      : escapeHtml(node.content ?? "");

  return `${open}${inner}</${tag}>`;
}

/** Script inyectado en el iframe para resaltar y emitir la selección. */
export const SELECTION_SCRIPT = `
(function(){
  var current=null;
  document.addEventListener('mouseover',function(e){
    var el=e.target.closest('[data-ast-id]'); if(!el)return;
    el.style.outline='1px dashed rgba(59,130,246,.6)';
  },true);
  document.addEventListener('mouseout',function(e){
    var el=e.target.closest('[data-ast-id]'); if(!el||el===current)return;
    el.style.outline='';
  },true);
  document.addEventListener('click',function(e){
    var el=e.target.closest('[data-ast-id]'); if(!el)return;
    e.preventDefault(); e.stopPropagation();
    if(current)current.style.outline='';
    current=el; el.style.outline='2px solid #3b82f6';
    parent.postMessage({type:'ast:select',id:el.getAttribute('data-ast-id')},'*');
  },true);
})();
`;

/** Documento completo (srcdoc) para el iframe: CSS original + HTML + script. */
export function buildIframeSrcDoc(root: AstNode, css: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${astToHtml(
    root,
  )}<script>${SELECTION_SCRIPT}</script></body></html>`;
}
