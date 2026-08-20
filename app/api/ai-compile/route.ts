/**
 * POST /api/ai-compile — { html, title } -> { doc } (Elementor container)
 * El SaaS ejecuta la "skill": Claude reconstruye la página (HTML+CSS real) como
 * plantilla Elementor limpia, validada con Zod. Streaming para evitar timeouts.
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AI_SYSTEM_PROMPT, buildAiUserMessage, parseAiDocument } from "@/lib/compiler/ai-compile";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY en el entorno." }, { status: 503 });
    }
    const body = await req.json();
    const html = typeof body?.html === "string" ? body.html : "";
    const title = typeof body?.title === "string" && body.title ? body.title : "pagina";
    if (!html.trim()) {
      return NextResponse.json({ error: "html requerido" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const userMessage = buildAiUserMessage(title, html);

    const run = async (extra?: string) => {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        system: AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: extra ? `${userMessage}\n\n${extra}` : userMessage }],
      });
      const msg = await stream.finalMessage();
      return msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    };

    let text = await run();
    try {
      return NextResponse.json({ doc: parseAiDocument(text) });
    } catch (firstErr) {
      text = await run(
        `El JSON anterior no fue válido (${(firstErr as Error).message}). Devuelve SOLO el JSON válido, sin texto.`,
      );
      return NextResponse.json({ doc: parseAiDocument(text) });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
