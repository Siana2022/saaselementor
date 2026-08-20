/**
 * POST /api/ai-compile — { page: PageAst, title } -> { doc } (Elementor container)
 * Claude reconstruye la página como plantilla Elementor limpia (guiado por la
 * receta), validada con Zod. Reintenta una vez con el error de validación.
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  AI_SYSTEM_PROMPT,
  buildAiUserMessage,
  parseAiDocument,
} from "@/lib/compiler/ai-compile";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY en el entorno." }, { status: 503 });
    }
    const body = await req.json();
    const compact = body?.compact;
    if (!compact || typeof compact !== "object") {
      return NextResponse.json({ error: "Falta el AST compacto (compact)." }, { status: 400 });
    }
    const title = typeof body?.title === "string" && body.title ? body.title : "pagina";

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const userMessage = buildAiUserMessage(title, compact);

    const call = async (extra?: string) => {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 32000,
        system: AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: extra ? `${userMessage}\n\n${extra}` : userMessage }],
      });
      return message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    };

    let text = await call();
    try {
      return NextResponse.json({ doc: parseAiDocument(text) });
    } catch (firstErr) {
      // Reintento con el error de validación como pista.
      text = await call(
        `El JSON anterior no fue válido (${(firstErr as Error).message}). Devuelve SOLO el JSON válido, sin texto.`,
      );
      const doc = parseAiDocument(text);
      return NextResponse.json({ doc });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
