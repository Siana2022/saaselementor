import { describe, it, expect } from "vitest";
import { buildPreflightReport } from "../report";
import { buildProjectAst } from "@/lib/parser/html-to-ast";
import { applyMutationsToProject } from "@/lib/core/mutations";

function seededUuids() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

describe("buildPreflightReport", () => {
  it("censa widgets nativos y detecta fallbacks", () => {
    const html = `<html><head><style>:root{--color-primary:#0af}</style></head><body>
      <h1 style="color:var(--color-primary)">Titulo</h1>
      <p>Parrafo</p>
      <a href="/x" class="btn">Boton</a>
      <ul><li>uno</li></ul>
      <iframe src="https://x.com"></iframe>
    </body></html>`;
    const project = buildProjectAst(html, { name: "home" }, { idFactory: seededUuids() });
    const r = buildPreflightReport(project, { elIdFactory: () => "el" });

    expect(r.pages).toBe(1);
    expect(r.widgetCensus.heading).toBe(1);
    expect(r.widgetCensus["text-editor"]).toBeGreaterThanOrEqual(1);
    expect(r.widgetCensus.button).toBe(1);
    // ul (list) + iframe (html_widget) -> fallback html
    expect(r.fallbackCount).toBeGreaterThanOrEqual(2);
    expect(r.fallbackItems.some((f) => f.tagName === "ul")).toBe(true);
    expect(r.fallbackItems.some((f) => f.role === "html_widget")).toBe(true);
    expect(r.nativeCoverage).toBeLessThan(100);
    expect(r.warnings.some((w) => w.includes("HTML crudo"))).toBe(true);
  });

  it("reporta globales resueltos y cobertura", () => {
    const html = `<html><head><style>:root{--color-primary:#0af}</style></head><body><h1 style="color:var(--color-primary)">T</h1></body></html>`;
    const project = buildProjectAst(html, { name: "home" }, { idFactory: seededUuids() });
    const r = buildPreflightReport(project, { elIdFactory: () => "el" });
    expect(r.globals.colors).toBe(1);
    expect(r.globals.refsResolved).toBe(1);
    expect(r.globals.refsTotal).toBe(1);
    expect(r.nativeCoverage).toBe(100);
  });

  it("detecta candidatos y loops confirmados", () => {
    const card = `<article class="card"><img src="x"><h3>t</h3><p>d</p></article>`;
    const html = `<body><div class="grid">${card}${card}${card}</div></body>`;
    let project = buildProjectAst(html, { name: "home" }, { idFactory: seededUuids() });

    const before = buildPreflightReport(project, { elIdFactory: () => "el" });
    expect(before.loops.candidates).toBe(1);
    expect(before.loops.confirmed).toBe(0);
    expect(before.warnings.some((w) => w.includes("patrón"))).toBe(true);

    const grid = project.pages[0]!.root.children.find((c) => c.classes.includes("grid"))!;
    project = applyMutationsToProject(project, [{ action: "updateRole", id: grid.id, role: "loop_grid" }]).project;
    const after = buildPreflightReport(project, { elIdFactory: () => "el" });
    expect(after.loops.confirmed).toBe(1);
    expect(after.documents.some((d) => d.type === "loop-item")).toBe(true);
  });
});
