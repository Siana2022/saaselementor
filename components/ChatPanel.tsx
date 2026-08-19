"use client";
import { useState } from "react";
import { useProjectStore } from "@/lib/store/project-store";

interface Msg { role: "user" | "system"; text: string }

export function ChatPanel() {
  const project = useProjectStore((s) => s.project);
  const getSelectedNode = useProjectStore((s) => s.getSelectedNode);
  const applyPatch = useProjectStore((s) => s.applyPatch);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const prompt = input.trim();
    if (!prompt || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: prompt }]);
    setBusy(true);
    try {
      const selectedNode = getSelectedNode();
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, selectedNode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error de IA");
      const { appliedIds, missingIds } = applyPatch(data.mutations);
      setMessages((m) => [
        ...m,
        { role: "system", text: `Aplicadas ${data.mutations.length} mutación(es). OK: ${appliedIds.length}, no encontradas: ${missingIds.length}.` },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: "system", text: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex-1 space-y-2 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs text-neutral-500">
            Pide cambios en lenguaje natural. Ej: “convierte esta cuadrícula en un loop dinámico”.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-md p-2 text-xs ${m.role === "user" ? "bg-blue-600/20 text-blue-100" : "bg-neutral-800 text-neutral-300"}`}
          >
            {m.text}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={!project || busy}
          placeholder={project ? "Escribe una instrucción…" : "Ingesta un HTML primero"}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200 disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!project || busy}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? "…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
