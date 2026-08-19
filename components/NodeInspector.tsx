"use client";
import { useProjectStore } from "@/lib/store/project-store";

export function NodeInspector() {
  const selectedId = useProjectStore((s) => s.selectedId);
  const getSelectedNode = useProjectStore((s) => s.getSelectedNode);
  const node = selectedId ? getSelectedNode() : null;

  if (!node) {
    return <p className="text-xs text-neutral-500">Haz clic en un elemento del lienzo para seleccionarlo.</p>;
  }
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-mono text-blue-400">{node.tagName}</span>
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300">{node.elementorRole}</span>
      </div>
      <p className="mt-1 truncate text-neutral-500">id: {node.id}</p>
      {node.content && <p className="mt-1 truncate text-neutral-400">“{node.content}”</p>}
      {node.patternMeta && (
        <p className="mt-1 text-amber-400">patrón ×{node.patternMeta.repeatedCount}</p>
      )}
    </div>
  );
}
