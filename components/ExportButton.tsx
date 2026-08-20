"use client";
import { useState } from "react";
import { useProjectStore } from "@/lib/store/project-store";
import { exportProjectZip } from "@/lib/compiler/export-zip";

export function ExportButton() {
  const project = useProjectStore((s) => s.project);
  const [busy, setBusy] = useState(false);

  async function exportZip() {
    if (!project || busy) return;
    setBusy(true);
    try {
      // Compilación + ZIP 100% en el cliente (sin límites de serverless).
      const bytes = await exportProjectZip(project);
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "kit"}-elementor-kit.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
      alert(`Error al exportar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={exportZip}
      disabled={!project || busy}
      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
    >
      {busy ? "Generando…" : "Exportar ZIP Elementor"}
    </button>
  );
}
