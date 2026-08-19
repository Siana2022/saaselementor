"use client";
import { useState } from "react";
import { useProjectStore } from "@/lib/store/project-store";

export function ExportButton() {
  const project = useProjectStore((s) => s.project);
  const [busy, setBusy] = useState(false);

  async function exportZip() {
    if (!project || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error al exportar");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name}-elementor-kit.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert((e as Error).message);
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
