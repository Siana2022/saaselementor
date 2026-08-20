/**
 * =============================================================================
 *  Optimizador del AST — limpia el árbol para un Elementor USABLE
 * =============================================================================
 *
 * El HTML real tiene decenas de <div> envoltorio que, 1:1, generan containers
 * vacíos y anidamiento absurdo en Elementor. Este pase:
 *   - Elimina nodos de texto vacíos.
 *   - Poda containers vacíos e invisibles (sin hijos, sin contenido, sin estilo).
 *   - Colapsa wrappers redundantes (container con un único hijo container y sin
 *     estilo propio) para reducir profundidad.
 *
 * No toca hojas con significado (image, button, heading con texto, etc.) ni los
 * nodos de patrón (loop_*).
 * =============================================================================
 */

import type { AstNode } from "@/lib/core/ast/types";

/** Roles de container "neutro" candidatos a poda/colapso. */
const NEUTRAL_CONTAINER = new Set(["container", "unknown"]);

/** ¿El container tiene estilo visible propio (fondo, borde, tamaño...)? */
function hasVisualStyle(node: AstNode): boolean {
  const s = node.styles;
  const bg = s["background-color"];
  const bgShort = s["background"];
  return Boolean(
    (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") ||
      s["background-image"] ||
      (bgShort && /url\(|#|rgb|hsl/.test(bgShort)) ||
      s["border"] ||
      s["border-width"] ||
      s["border-top"] ||
      s["border-bottom"] ||
      s["border-left"] ||
      s["border-right"] ||
      s["border-radius"] ||
      s["box-shadow"] ||
      s["min-height"] ||
      s["height"],
  );
}

function optimize(node: AstNode): AstNode | null {
  if (node.nodeType === "text") {
    return node.content && node.content.trim() ? node : null;
  }

  node.children = node.children
    .map(optimize)
    .filter((n): n is AstNode => n !== null);
  const elementKids = node.children.filter((k) => k.nodeType === "element");
  const hasContent = Boolean(node.content && node.content.trim());
  const role = node.elementorRole;

  // Hojas de texto/encabezado vacías -> fuera.
  if ((role === "heading" || role === "text") && !hasContent && elementKids.length === 0) {
    return null;
  }

  if (NEUTRAL_CONTAINER.has(role)) {
    // Poda: container vacío, sin contenido, sin HTML crudo y sin estilo visible.
    if (elementKids.length === 0 && !hasContent && !node.rawHtml && !hasVisualStyle(node)) {
      return null;
    }
    // Colapso: wrapper con un único hijo-container y sin estilo/patrón propio.
    if (
      node.children.length === 1 &&
      elementKids.length === 1 &&
      role === "container" &&
      !hasVisualStyle(node) &&
      !node.patternMeta
    ) {
      const only = elementKids[0]!;
      if (only.nodeType === "element" && (only.elementorRole === "container" || only.elementorRole === "unknown")) {
        return only;
      }
    }
  }
  return node;
}

/**
 * Optimiza el árbol IN-SITU (el nodo raíz se conserva; se limpian sus hijos).
 */
export function optimizeTree(root: AstNode): AstNode {
  root.children = root.children
    .map(optimize)
    .filter((n): n is AstNode => n !== null);
  return root;
}
