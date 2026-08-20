"use client";
import { useMemo } from "react";
import { useProjectStore } from "@/lib/store/project-store";
import { buildPreflightReport } from "@/lib/compiler/report";

function Bar({ value }: { value: number }) {
  const color = value >= 90 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-neutral-800">
      <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export function PreflightPanel() {
  const project = useProjectStore((s) => s.project);

  const report = useMemo(() => {
    if (!project) return null;
    try {
      return buildPreflightReport(project);
    } catch {
      return null;
    }
  }, [project]);

  if (!report) {
    return <p className="text-xs text-neutral-500">Ingesta un HTML para ver el pre-vuelo del export.</p>;
  }

  return (
    <div className="space-y-3 text-xs">
      {/* Cobertura nativa */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-neutral-400">Cobertura nativa</span>
          <span className="font-semibold text-neutral-200">{report.nativeCoverage}%</span>
        </div>
        <Bar value={report.nativeCoverage} />
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Páginas" value={report.pages} />
        <Metric label="Widgets" value={report.totalWidgets} />
        <Metric label="Fallback HTML" value={report.fallbackCount} warn={report.fallbackCount > 0} />
        <Metric label="Loops" value={`${report.loops.confirmed}✓ / ${report.loops.candidates}?`} />
        <Metric label="Colores" value={report.globals.colors} />
        <Metric label="Tipografías" value={report.globals.typographies} />
      </div>

      {/* Censo de widgets */}
      {Object.keys(report.widgetCensus).length > 0 && (
        <div>
          <p className="mb-1 text-neutral-400">Widgets</p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(report.widgetCensus)
              .sort((a, b) => b[1] - a[1])
              .map(([type, n]) => (
                <span
                  key={type}
                  className={`rounded px-1.5 py-0.5 ${type === "html" ? "bg-red-900/40 text-red-300" : "bg-neutral-800 text-neutral-300"}`}
                >
                  {type} ×{n}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Avisos */}
      {report.warnings.length > 0 && (
        <div className="space-y-1">
          {report.warnings.map((w, i) => (
            <p key={i} className="rounded bg-amber-900/30 px-2 py-1 text-amber-300">⚠️ {w}</p>
          ))}
        </div>
      )}

      {/* Elementos a revisar */}
      {report.fallbackItems.length > 0 && (
        <details className="rounded border border-neutral-800">
          <summary className="cursor-pointer px-2 py-1 text-neutral-400">
            Elementos a revisar ({report.fallbackItems.length})
          </summary>
          <ul className="max-h-40 space-y-1 overflow-y-auto p-2">
            {report.fallbackItems.map((f, i) => (
              <li key={i} className="text-neutral-400">
                <span className="text-red-300">{f.tagName}</span>{" "}
                <span className="text-neutral-600">({f.role})</span>
                <br />
                <span className="text-[10px] text-neutral-600">{f.path}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5">
      <p className="text-neutral-500">{label}</p>
      <p className={`text-sm font-semibold ${warn ? "text-amber-400" : "text-neutral-200"}`}>{value}</p>
    </div>
  );
}
