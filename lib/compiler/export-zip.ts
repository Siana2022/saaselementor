/**
 * =============================================================================
 *  PILAR 5 (c) — Exporter: bundle -> Website Kit ZIP de Elementor
 * =============================================================================
 *
 * Estructura real de un Website Kit (validada contra fixtures/kit):
 *   manifest.json
 *   site-settings.json          (Kit global: system/custom colors + typography)
 *   content/page/<id>.json      (páginas; shape {content, settings, metadata})
 *   templates/<id>.json         (sub-templates de loops; mismo shape)
 *
 * Los title/doc_type de cada documento viven en el manifest, no en el archivo.
 * =============================================================================
 */

import JSZip from "jszip";
import type { ProjectAst } from "@/lib/core/ast/types";
import { compileProject, type CompileOptions } from "./compile";
import { KitDocumentSchema, ManifestSchema } from "./elementor-types";

// Versiones que replican un Website Kit real que importa correctamente.
const KIT_FORMAT_VERSION = "3.0"; // formato import/export kit (crítico para el importador)
const ELEMENTOR_VERSION = "4.2.2";

const HELLO_THEME = {
  name: "Hello Elementor",
  theme_uri: "https://elementor.com/hello-theme/",
  version: "3.0.0",
  slug: "hello-elementor",
};

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "kit"
  );
}

/**
 * Construye el mapa { ruta -> contenido } del Website Kit. Útil para tests
 * (sin descomprimir) y como fuente para el ZIP.
 */
export function buildFileMap(project: ProjectAst, opts: CompileOptions = {}): Record<string, string> {
  const bundle = compileProject(project, opts);
  const files: Record<string, string> = {};

  const manifestTemplates: Record<string, { title: string; doc_type: string; thumbnail: boolean }> = {};
  const manifestPages: Record<
    string,
    { title: string; doc_type: string; thumbnail: boolean; url: string; terms: unknown[] }
  > = {};

  let nextId = 100;
  for (const d of bundle.documents) {
    const id = String(nextId++);

    if (d.type === "page") {
      // Las páginas llevan settings de página (objeto), como en un kit real.
      const kitDoc = KitDocumentSchema.parse({
        content: d.doc.content,
        settings: { template: "default" },
        metadata: [],
      });
      files[`content/page/${id}.json`] = JSON.stringify(kitDoc, null, 2);
      manifestPages[id] = { title: d.title, doc_type: "wp-page", thumbnail: false, url: "", terms: [] };
    } else {
      const kitDoc = KitDocumentSchema.parse({ content: d.doc.content, settings: [], metadata: [] });
      files[`templates/${id}.json`] = JSON.stringify(kitDoc, null, 2);
      manifestTemplates[id] = { title: d.title, doc_type: d.type, thumbnail: false };
    }
  }

  const manifest = ManifestSchema.parse({
    name: slugify(project.name),
    title: project.name,
    description: null,
    author: "HTML → Elementor SaaS",
    version: KIT_FORMAT_VERSION,
    elementor_version: ELEMENTOR_VERSION,
    thumbnail: false,
    theme: HELLO_THEME,
    experiments: [],
    "site-settings": {
      theme: false,
      globalColors: true,
      globalFonts: true,
      themeStyleSettings: false,
      generalSettings: false,
      experiments: false,
      customCode: false,
      customIcons: false,
      customFonts: false,
    },
    plugins: [],
    templates: manifestTemplates,
    taxonomies: {},
    content: Object.keys(manifestPages).length > 0 ? { page: manifestPages } : {},
  });

  files["manifest.json"] = JSON.stringify(manifest, null, 2);
  files["site-settings.json"] = JSON.stringify(bundle.siteSettings, null, 2);
  return files;
}

/** Genera el ZIP del Website Kit como Uint8Array (Node y navegador). */
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

/**
 * Genera un ZIP de PLANTILLAS INDIVIDUALES en formato standalone
 * `{content, page_settings, version, title, type}` — importables una a una por
 * *Elementor → Plantillas → Importar plantillas*. Estilos INLINE (sin Kit), así
 * el diseño se ve aunque no se importen los globales.
 */
export async function exportTemplatesZip(
  project: ProjectAst,
  opts: CompileOptions = {},
): Promise<Uint8Array> {
  const bundle = compileProject(project, { ...opts, inlineStyles: true });
  const zip = new JSZip();
  const used = new Set<string>();
  for (const d of bundle.documents) {
    let slug = slugify(d.name);
    let n = 1;
    while (used.has(slug)) slug = `${slugify(d.name)}-${++n}`;
    used.add(slug);
    // `type:"container"` es el tipo válido para importar por Plantillas →
    // Importar plantillas (a diferencia de "page", que da "Invalid template type").
    const doc = { ...d.doc, type: "container" };
    zip.file(`${slug}.json`, JSON.stringify(doc, null, 2));
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
