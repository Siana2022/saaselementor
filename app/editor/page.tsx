"use client";
import { IngestPanel } from "@/components/IngestPanel";
import { CanvasIframe } from "@/components/CanvasIframe";
import { ChatPanel } from "@/components/ChatPanel";
import { NodeInspector } from "@/components/NodeInspector";
import { ExportButton } from "@/components/ExportButton";

export default function EditorPage() {
  return (
    <main className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <h1 className="text-sm font-semibold">HTML → Elementor · Editor</h1>
        <ExportButton />
      </header>
      <div className="grid flex-1 grid-cols-[1fr_380px] gap-3 overflow-hidden p-3">
        <section className="min-h-0 overflow-hidden">
          <CanvasIframe />
        </section>
        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <div>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Ingesta</h2>
            <IngestPanel />
          </div>
          <div>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Selección</h2>
            <NodeInspector />
          </div>
          <div className="flex min-h-48 flex-1 flex-col">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Chat IA</h2>
            <div className="flex-1">
              <ChatPanel />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
