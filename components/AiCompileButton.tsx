"use client";
import { useState } from "react";
import JSZip from "jszip";
import { useProjectStore } from "@/lib/store/project-store";
import { compactAst } from "@/lib/compiler/ai-compile";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pagina";
}
function downloadBlob(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function compileOne(page: { name: string; root: unknown }, signal?: AbortSignal) {
  const res = await fetch("/api/ai-compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ compact: compactAst(page.root as never), title: page.name }),
    signal,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error de compilación IA");
  return data.doc;
}

export function AiCompileButton() {
  const project = useProjectStore((s) => s.project);
  const [busy, setBusy] = useState<null | "one" | "all">(null);
  const [progress, setProgress] = useState("");

  async function one() {
    const page = project?.pages[0];
    if (!page || busy) return;
    setBusy("one");
    setProgress("");
    try {
      const doc = await compileOne(page);
      downloadBlob(JSON.stringify(doc, null, 2), `${slug(page.name)}.json`, "application/json");
    } catch (e) {
      alert(`IA: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function all() {
    if (!project || busy) return;
    setBusy("all");
    const zip = new JSZip();
    try {
      const used = new Set<string>();
      for (let i = 0; i < project.pages.length; i++) {
        const page = project.pages[i]!;
        setProgress(`${i + 1}/${project.pages.length} · ${page.name}`);
        const doc = await compileOne(page);
        let name = slug(page.name);
        let n = 1;
        while (used.has(name)) name = `${slug(page.name)}-${++n}`;
        used.add(name);
        zip.file(`${name}.json`, JSON.stringify(doc, null, 2));
      }
      const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
      downloadBlob(new Uint8Array(bytes), `${slug(project.name)}-ia-plantillas.zip`, "application/zip");
    } catch (e) {
      alert(`IA: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      setProgress("");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {progress && <span className="text-xs text-neutral-400">{progress}</span>}
      <button
        onClick={one}
        disabled={!project || busy !== null}
        title="Claude reconstruye la primera página como Elementor limpio."
        className="rounded-md border border-violet-500 px-3 py-1.5 text-sm font-medium text-violet-300 hover:bg-violet-950 disabled:opacity-50"
      >
        {busy === "one" ? "Compilando…" : "IA: compilar página"}
      </button>
      <button
        onClick={all}
        disabled={!project || busy !== null}
        title="Claude reconstruye TODAS las páginas (una llamada por página)."
        className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {busy === "all" ? "Compilando…" : "IA: todas (ZIP)"}
      </button>
    </div>
  );
}
