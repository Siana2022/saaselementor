/**
 * POST /api/ingest — { html, name? } -> { project, css }
 * Ingesta Two-Pass server-side (cheerio). Devuelve el ProjectAst + CSS original.
 */
import { NextResponse } from "next/server";
import { buildProjectAst } from "@/lib/parser/html-to-ast";
import { collectStyleCss } from "@/lib/parser/global-system";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
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
