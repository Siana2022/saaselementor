"use client";
import { useState } from "react";
import { useProjectStore } from "@/lib/store/project-store";
import { ProjectAstSchema } from "@/lib/core/ast/types";
import { SAMPLE_HTML } from "./sample";

export function IngestPanel() {
  const setProject = useProjectStore((s) => s.setProject);
  const [html, setHtml] = useState(SAMPLE_HTML);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ingest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, name: "home" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error de ingesta");
      setProject(ProjectAstSchema.parse(data.project), data.css ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        spellCheck={false}
        className="h-40 w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 p-2 font-mono text-xs text-neutral-200"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={ingest}
          disabled={loading}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "Procesando…" : "Ingestar HTML"}
        </button>
        <button
          onClick={() => setHtml(SAMPLE_HTML)}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          Cargar ejemplo
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
