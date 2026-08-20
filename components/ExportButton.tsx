"use client";
import { useState } from "react";
import { useProjectStore } from "@/lib/store/project-store";
import { exportProjectZip, exportTemplatesZip } from "@/lib/compiler/export-zip";

function download(bytes: Uint8Array, name: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton() {
  const project = useProjectStore((s) => s.project);
  const [busy, setBusy] = useState<null | "kit" | "tpl">(null);

  async function run(kind: "kit" | "tpl") {
    if (!project || busy) return;
    setBusy(kind);
    try {
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "kit";
      if (kind === "kit") {
        download(await exportProjectZip(project), `${slug}-elementor-kit.zip`);
      } else {
        download(await exportTemplatesZip(project), `${slug}-plantillas.zip`);
      }
    } catch (e) {
      console.error("Export error:", e);
      alert(`Error al exportar: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => run("tpl")}
        disabled={!project || busy !== null}
        title="Plantillas individuales (Elementor → Plantillas → Importar). Estilos inline."
        className="rounded-md border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-950 disabled:opacity-50"
      >
        {busy === "tpl" ? "Generando…" : "Exportar plantillas"}
      </button>
      <button
        onClick={() => run("kit")}
        disabled={!project || busy !== null}
        title="Website Kit completo (Elementor → Herramientas → Importar kit). Incluye globales."
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy === "kit" ? "Generando…" : "Exportar ZIP (Kit)"}
      </button>
    </div>
  );
}
