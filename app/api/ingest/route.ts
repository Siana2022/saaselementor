/**
 * POST /api/ingest
 *   - JSON  { html, name? }              -> ingesta de HTML pegado
 *   - multipart/form-data { file, name? } -> ingesta de un ZIP completo
 * Devuelve { project, css }.
 */
import { NextResponse } from "next/server";
import { buildProjectAst, buildProjectAstFromPages } from "@/lib/parser/html-to-ast";
import { collectStyleCss } from "@/lib/parser/global-system";
import { ingestZipAll } from "@/lib/parser/ingest-zip";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    // --- Ingesta de ZIP (subida de archivo) ---
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Falta el archivo ZIP" }, { status: 400 });
      }
      const buffer = new Uint8Array(await file.arrayBuffer());
      const pages = await ingestZipAll(buffer);
      const projectName =
        (typeof form.get("name") === "string" && (form.get("name") as string)) ||
        "proyecto";
      const project = buildProjectAstFromPages(
        pages.map((p) => ({ name: p.name, html: p.html, fileName: p.fileName })),
        projectName,
      );
      // CSS de la primera página para el preview del lienzo.
      const css = pages[0] ? collectStyleCss(pages[0].html) : "";
      return NextResponse.json({ project, css, pageCount: pages.length });
    }

    // --- Ingesta de HTML pegado ---
    const body = await req.json();
    const html = typeof body?.html === "string" ? body.html : "";
    const name = typeof body?.name === "string" && body.name ? body.name : "home";
    if (!html.trim()) {
      return NextResponse.json({ error: "html requerido" }, { status: 400 });
    }
    const project = buildProjectAst(html, { name });
    const css = collectStyleCss(html);
    return NextResponse.json({ project, css });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
