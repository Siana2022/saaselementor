/**
 * POST /api/ai — { prompt, selectedNode?, contextFragment? } -> { mutations }
 * AI Chat Controller (Pilar 4): pide a Claude un JSON Patch de mutaciones y lo
 * valida con Zod antes de devolverlo al frontend.
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { parseMutations } from "@/lib/core/mutations";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const SYSTEM_PROMPT = `Eres el controlador de edición de un AST que representa un diseño web que se exportará a Elementor.
Debes traducir la petición del usuario a una LISTA de mutaciones en JSON puro (sin markdown, sin texto extra).
Cada mutación es un objeto con "action", "id" y campos propios. Acciones válidas:
- {"action":"updateRole","id":"<uuid>","role":"<elementorRole>"}
  roles: container, heading, text, image, button, link, icon, icon_box, video, list, divider, spacer, form, input, repeater_candidate, loop_candidate, loop_grid, repeater, loop_item_template, html_widget, unknown
- {"action":"updateStyles","id":"<uuid>","styles":{"<css-prop>":"<valor>"},"merge":true}
- {"action":"updateContent","id":"<uuid>","content":"<texto>"}
- {"action":"updateAttributes","id":"<uuid>","attributes":{"href":"..."},"merge":true}
- {"action":"addClass","id":"<uuid>","className":"..."}
- {"action":"removeClass","id":"<uuid>","className":"..."}
- {"action":"setDynamicMapping","id":"<uuid>","dynamicMapping":{"content":{"tag":"post-title","token":"[post_title]"}}}
- {"action":"setGlobalRefs","id":"<uuid>","globalRefs":{"color":"<globalId>"}}
- {"action":"removeNode","id":"<uuid>"}
Usa el "id" del nodo seleccionado salvo que el usuario se refiera a otro. Responde SOLO con el array JSON.`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  const slice = start >= 0 && end >= 0 ? raw.slice(start, end + 1) : raw;
  return JSON.parse(slice);
}

export async function POST(req: Request) {
  try {
    const { prompt, selectedNode, contextFragment } = await req.json();
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Falta ANTHROPIC_API_KEY en el entorno." },
        { status: 503 },
      );
    }
    if (typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "prompt requerido" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const userContent = [
      selectedNode ? `Nodo seleccionado:\n${JSON.stringify(selectedNode, null, 2)}` : "",
      contextFragment ? `Contexto del AST:\n${JSON.stringify(contextFragment, null, 2)}` : "",
      `Petición del usuario: ${prompt}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    let mutations;
    try {
      mutations = parseMutations(extractJson(text));
    } catch (parseErr) {
      return NextResponse.json(
        { error: "La respuesta de la IA no es un JSON Patch válido.", detail: (parseErr as Error).message, raw: text },
        { status: 422 },
      );
    }
    return NextResponse.json({ mutations });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
