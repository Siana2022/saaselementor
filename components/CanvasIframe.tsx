"use client";
import { useEffect, useMemo, useRef } from "react";
import { useProjectStore } from "@/lib/store/project-store";
import { buildIframeSrcDoc } from "@/lib/render/ast-to-html";

export function CanvasIframe() {
  const project = useProjectStore((s) => s.project);
  const css = useProjectStore((s) => s.css);
  const selectNode = useProjectStore((s) => s.selectNode);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcDoc = useMemo(() => {
    const root = project?.pages[0]?.root;
    if (!root) return "";
    return buildIframeSrcDoc(root, css);
  }, [project, css]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "ast:select" && typeof e.data.id === "string") {
        selectNode(e.data.id);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [selectNode]);

  if (!srcDoc) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        Ingesta un HTML para ver el lienzo.
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title="canvas"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="h-full w-full rounded-md border border-neutral-800 bg-white"
    />
  );
}
