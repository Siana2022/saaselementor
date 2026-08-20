/**
 * =============================================================================
 *  PILAR 5 (d) — Informe de pre-vuelo (pre-flight) del export
 * =============================================================================
 *
 * Antes de exportar el ZIP, analiza el ProjectAst + su compilación y reporta la
 * CALIDAD del resultado: cuántos widgets se mapean de forma nativa vs. caen al
 * fallback `html`, globales resueltos, loops detectados y elementos a revisar.
 *
 * Función pura (sin dependencias de Node): se puede ejecutar en el cliente.
 * =============================================================================
 */

import type { AstNode, ProjectAst } from "@/lib/core/ast/types";
import { compileProject, type CompileOptions } from "./compile";
import type { ElementorElement } from "./elementor-types";

/** Roles que el compiler mapea a widgets/containers NATIVOS de Elementor. */
const NATIVE_ROLES = new Set([
  "heading",
  "text",
  "button",
  "link",
  "image",
  "divider",
  "spacer",
  "container",
  "loop_candidate",
  "repeater_candidate",
  "loop_item_template",
  "loop_grid",
  "repeater",
]);

export interface FallbackItem {
  /** Ruta legible del nodo (ej. "body > div.grid > ul"). */
  path: string;
  tagName: string;
  role: string;
}

export interface PreflightReport {
  pages: number;
  documents: Array<{ name: string; type: string }>;
  totalWidgets: number;
  widgetCensus: Record<string, number>;
  /** Widgets que caen al fallback `html` (lossy). */
  fallbackCount: number;
  fallbackItems: FallbackItem[];
  globals: { colors: number; typographies: number; refsTotal: number; refsResolved: number };
  loops: { confirmed: number; candidates: number };
  warnings: string[];
  /** % de widgets mapeados de forma nativa (0-100). */
  nativeCoverage: number;
}

function walkElements(elements: ElementorElement[], fn: (el: ElementorElement) => void): void {
  for (const el of elements) {
    fn(el);
    if (el.elements?.length) walkElements(el.elements, fn);
  }
}

function nodeLabel(node: AstNode): string {
  const cls = node.classes[0] ? `.${node.classes[0]}` : "";
  return `${node.tagName}${cls}`;
}

function walkAst(node: AstNode, ancestors: string[], fn: (n: AstNode, path: string) => void): void {
  const path = [...ancestors, nodeLabel(node)].join(" > ");
  fn(node, path);
  for (const child of node.children) walkAst(child, [...ancestors, nodeLabel(node)], fn);
}

/** Construye el informe de pre-vuelo del proyecto. */
export function buildPreflightReport(project: ProjectAst, opts: CompileOptions = {}): PreflightReport {
  const bundle = compileProject(project, opts);

  const widgetCensus: Record<string, number> = {};
  let totalWidgets = 0;
  for (const d of bundle.documents) {
    walkElements(d.doc.content, (el) => {
      if (el.elType === "widget" && el.widgetType) {
        widgetCensus[el.widgetType] = (widgetCensus[el.widgetType] ?? 0) + 1;
        totalWidgets += 1;
      }
    });
  }
  const fallbackCount = widgetCensus["html"] ?? 0;

  const fallbackItems: FallbackItem[] = [];
  let candidates = 0;
  let confirmed = 0;
  let refsTotal = 0;
  let refsResolved = 0;
  const colorIds = new Set(project.globalSystem.colors.map((c) => c.id));
  const typoIds = new Set(project.globalSystem.typographies.map((t) => t.id));

  for (const page of project.pages) {
    walkAst(page.root, [], (node, path) => {
      if (node.nodeType !== "element") return;
      const role = node.elementorRole;
      if (role === "loop_candidate" || role === "repeater_candidate") candidates += 1;
      if (role === "loop_grid" || role === "repeater") confirmed += 1;
      if (!NATIVE_ROLES.has(role)) {
        fallbackItems.push({ path, tagName: node.tagName, role });
      }
      if (node.globalRefs?.color) {
        refsTotal += 1;
        if (colorIds.has(node.globalRefs.color)) refsResolved += 1;
      }
      if (node.globalRefs?.typography) {
        refsTotal += 1;
        if (typoIds.has(node.globalRefs.typography)) refsResolved += 1;
      }
    });
  }

  const warnings: string[] = [];
  if (fallbackCount > 0) {
    warnings.push(
      `${fallbackCount} elemento(s) se exportan como HTML crudo (fallback). Revisa que se vean bien tras importar.`,
    );
  }
  if (candidates > 0) {
    warnings.push(
      `${candidates} patrón(es) repetido(s) detectado(s) sin confirmar. Pídele a la IA convertirlos en Loop Grid para que sean dinámicos.`,
    );
  }
  if (refsTotal > refsResolved) {
    warnings.push(`${refsTotal - refsResolved} referencia(s) a globales no resuelta(s).`);
  }
  if (totalWidgets === 0) {
    warnings.push("No se generó ningún widget. ¿Ingestaste un HTML válido?");
  }

  const nativeCoverage =
    totalWidgets === 0 ? 0 : Math.round(((totalWidgets - fallbackCount) / totalWidgets) * 100);

  return {
    pages: project.pages.length,
    documents: bundle.documents.map((d) => ({ name: d.name, type: d.type })),
    totalWidgets,
    widgetCensus,
    fallbackCount,
    fallbackItems,
    globals: {
      colors: project.globalSystem.colors.length,
      typographies: project.globalSystem.typographies.length,
      refsTotal,
      refsResolved,
    },
    loops: { confirmed, candidates },
    warnings,
    nativeCoverage,
  };
}
