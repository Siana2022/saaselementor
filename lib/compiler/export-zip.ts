/**
 * =============================================================================
 *  PILAR 5 (c) — Exporter: bundle -> ZIP oficial de Elementor Template Kit
 * =============================================================================
 *
 * Estructura del ZIP (según especificación del proyecto):
 *   manifest.json
 *   kit.json
 *   templates/
 *     <page>.json
 *     <page>-loop-item-N.json   (sub-templates de loops)
 *
 * ⚠️ PROVISIONAL: estructura basada en el formato público; validar con fixtures.
 * =============================================================================
 */

import JSZip from "jszip";
import type { ProjectAst } from "@/lib/core/ast/types";
import { compileProject, type CompileOptions } from "./compile";
import { ElementorManifestSchema } from "./elementor-types";

const ELEMENTOR_VERSION = "3.25.0";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "page"
  );
}

/**
 * Construye el mapa { ruta -> contenido } del Template Kit. Útil para tests
 * (sin descomprimir) y como fuente para el ZIP.
 */
export function buildFileMap(project: ProjectAst, opts: CompileOptions = {}): Record<string, string> {
  const bundle = compileProject(project, opts);
  const files: Record<string, string> = {};

  const templates: Record<string, { id: string; title: string; doc_type: string; name: string }> = {};
  const usedSlugs = new Set<string>();

  for (const d of bundle.documents) {
    let fileId = slugify(d.name);
    let n = 1;
    while (usedSlugs.has(fileId)) fileId = `${slugify(d.name)}-${++n}`;
    usedSlugs.add(fileId);

    templates[fileId] = { id: fileId, title: d.title, doc_type: d.type, name: d.name };
    files[`templates/${fileId}.json`] = JSON.stringify(d.doc, null, 2);
  }

  const manifest = ElementorManifestSchema.parse({
    name: slugify(project.name),
    title: project.name,
    version: "1.0.0",
    elementor_version: ELEMENTOR_VERSION,
    templates,
    content: {},
  });

  files["manifest.json"] = JSON.stringify(manifest, null, 2);
  files["kit.json"] = JSON.stringify(bundle.kit, null, 2);
  return files;
}

/** Genera el ZIP del Template Kit como Uint8Array (Node y navegador). */
export async function exportProjectZip(
  project: ProjectAst,
  opts: CompileOptions = {},
): Promise<Uint8Array> {
  const files = buildFileMap(project, opts);
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
