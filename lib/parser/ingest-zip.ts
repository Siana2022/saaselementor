/**
 * =============================================================================
 *  Ingesta de ZIP — proyecto estático completo (HTML + CSS + imágenes)
 * =============================================================================
 *
 * Convierte un ZIP en un ÚNICO HTML autocontenido apto para `buildProjectAst`:
 *   - Localiza el HTML principal (index.html o el primero disponible).
 *   - Resuelve `<link rel="stylesheet">` a los .css del ZIP y los inyecta como
 *     `<style>` (para que el extractor global y el parser vean TODO el CSS).
 *   - Reescribe `<img src>` y `url(...)` del CSS a data URIs cuando el asset
 *     está en el ZIP (para fidelidad del preview y del export).
 *
 * Se ejecuta en el servidor (ruta /api/ingest).
 * =============================================================================
 */

import JSZip from "jszip";
import * as cheerio from "cheerio";

/** Tope por asset embebido como data URI (evita payloads gigantes). */
const MAX_ASSET_BYTES = 2 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  bmp: "image/bmp",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

function ext(path: string): string {
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? "";
}

function dirName(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

function baseName(path: string): string {
  const p = path.slice(path.lastIndexOf("/") + 1);
  return p.replace(/\.[^.]+$/, "");
}

/** Resuelve una referencia relativa contra un directorio base (rutas POSIX). */
function resolvePath(baseDir: string, ref: string): string | null {
  const clean = ref.split("?")[0]?.split("#")[0] ?? "";
  if (!clean || /^(https?:)?\/\//.test(clean) || clean.startsWith("data:")) return null;
  const parts = (baseDir ? baseDir.split("/") : [])
    .concat(clean.split("/"))
    .filter((p) => p !== "" && p !== ".");
  const stack: string[] = [];
  for (const p of parts) {
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  return stack.join("/");
}

async function toDataUri(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  const mime = MIME_BY_EXT[ext(path)];
  if (!mime) return null;
  const buf = await file.async("uint8array");
  if (buf.byteLength > MAX_ASSET_BYTES) return null;
  const base64 = Buffer.from(buf).toString("base64");
  return `data:${mime};base64,${base64}`;
}

/** Reescribe `url(...)` del CSS a data URIs (relativo al dir del .css). */
async function inlineCssUrls(css: string, cssDir: string, zip: JSZip): Promise<string> {
  const refs = new Set<string>();
  const re = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    if (m[1]) refs.add(m[1]);
  }
  let out = css;
  for (const ref of refs) {
    const resolved = resolvePath(cssDir, ref);
    if (!resolved) continue;
    const dataUri = await toDataUri(zip, resolved);
    if (dataUri) out = out.split(ref).join(dataUri);
  }
  return out;
}

export interface ZipPage {
  /** HTML autocontenido (CSS inyectado, imágenes embebidas). */
  html: string;
  /** Nombre del archivo HTML de origen. */
  fileName: string;
  /** Nombre sugerido para la página. */
  name: string;
}

/** Convierte UN archivo HTML del ZIP en HTML autocontenido. */
async function selfContainedHtml(zip: JSZip, mainPath: string): Promise<string> {
  const baseDir = dirName(mainPath);
  const rawHtml = await zip.file(mainPath)!.async("string");
  const $ = cheerio.load(rawHtml);

  // <link rel="stylesheet"> -> <style> (con url() embebidas).
  for (const el of $('link[rel="stylesheet"][href]').toArray()) {
    const href = $(el).attr("href") ?? "";
    const resolved = resolvePath(baseDir, href);
    if (!resolved) continue;
    const cssFile = zip.file(resolved);
    if (!cssFile) continue;
    const css = await cssFile.async("string");
    const inlined = await inlineCssUrls(css, dirName(resolved), zip);
    $(el).replaceWith(`<style data-from="${href}">${inlined}</style>`);
  }

  // <img src> -> data URI.
  for (const el of $("img[src]").toArray()) {
    const src = $(el).attr("src") ?? "";
    const resolved = resolvePath(baseDir, src);
    if (!resolved) continue;
    const dataUri = await toDataUri(zip, resolved);
    if (dataUri) $(el).attr("src", dataUri);
  }

  return $.html();
}

/** Lista los HTML del ZIP (index.html primero, luego por profundidad). */
function htmlPaths(zip: JSZip): string[] {
  const paths = Object.keys(zip.files).filter((p) => !zip.files[p]?.dir && /\.html?$/i.test(p));
  return paths.sort((a, b) => {
    const ai = /(^|\/)index\.html?$/i.test(a) ? 0 : 1;
    const bi = /(^|\/)index\.html?$/i.test(b) ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return a.split("/").length - b.split("/").length || a.localeCompare(b);
  });
}

/** Ingesta de TODAS las páginas HTML del ZIP (cada una autocontenida). */
export async function ingestZipAll(buffer: Uint8Array | ArrayBuffer): Promise<ZipPage[]> {
  const zip = await JSZip.loadAsync(buffer);
  const paths = htmlPaths(zip);
  if (paths.length === 0) throw new Error("El ZIP no contiene ningún archivo .html");
  const pages: ZipPage[] = [];
  for (const path of paths) {
    pages.push({ html: await selfContainedHtml(zip, path), fileName: path, name: baseName(path) || "page" });
  }
  return pages;
}

/** Ingesta del HTML principal del ZIP (compatibilidad; una sola página). */
export async function ingestZipToHtml(buffer: Uint8Array | ArrayBuffer): Promise<ZipPage> {
  const pages = await ingestZipAll(buffer);
  return pages[0]!;
}
