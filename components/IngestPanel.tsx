"use client";
import { useRef, useState } from "react";
import { useProjectStore } from "@/lib/store/project-store";
import { ProjectAstSchema } from "@/lib/core/ast/types";
import { SAMPLE_HTML } from "./sample";

export function IngestPanel() {
  const setProject = useProjectStore((s) => s.setProject);
  const [html, setHtml] = useState(SAMPLE_HTML);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleResponse(res: Response) {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error de ingesta");
    setProject(ProjectAstSchema.parse(data.project), data.css ?? "");
  }

  async function ingestHtml() {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, name: "home" }),
      });
      await handleResponse(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function ingestZip(file: File) {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name.replace(/\.zip$/i, ""));
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      await handleResponse(res);
      setInfo(`ZIP "${file.name}" procesado.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Subida de ZIP */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) ingestZip(f);
        }}
        className="rounded-md border border-dashed border-neutral-700 p-3 text-center"
      >
        <p className="text-xs text-neutral-400">Arrastra un .zip (HTML + CSS + imágenes) o</p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="mt-1 rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
        >
          Elegir ZIP
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) ingestZip(f);
          }}
        />
      </div>

      <p className="text-center text-[10px] uppercase tracking-wide text-neutral-600">o pega HTML</p>

      <textarea
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        spellCheck={false}
        className="h-32 w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 p-2 font-mono text-xs text-neutral-200"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={ingestHtml}
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
      {info && <p className="text-xs text-emerald-400">{info}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
