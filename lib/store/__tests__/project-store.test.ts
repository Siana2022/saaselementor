import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, findNodeById } from "../project-store";
import { buildProjectAst } from "@/lib/parser/html-to-ast";

function seededIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

describe("useProjectStore", () => {
  beforeEach(() => useProjectStore.getState().reset());

  it("setProject y selección de nodo", () => {
    const project = buildProjectAst("<body><h1>Hola</h1></body>", { name: "home" }, { idFactory: seededIds() });
    const store = useProjectStore.getState();
    store.setProject(project, "body{}");
    expect(useProjectStore.getState().project?.name).toBe("home");
    expect(useProjectStore.getState().css).toBe("body{}");

    const h1 = findNodeById(project.pages[0]!.root, "");
    expect(h1).toBeNull(); // id vacío no existe

    const realH1 = project.pages[0]!.root.children.find((c) => c.tagName === "h1")!;
    store.selectNode(realH1.id);
    expect(useProjectStore.getState().getSelectedNode()?.tagName).toBe("h1");
  });

  it("applyPatch aplica mutaciones y actualiza el store", () => {
    const project = buildProjectAst("<body><h1>Hola</h1></body>", { name: "home" }, { idFactory: seededIds() });
    const store = useProjectStore.getState();
    store.setProject(project);
    const h1 = project.pages[0]!.root.children.find((c) => c.tagName === "h1")!;

    const res = useProjectStore.getState().applyPatch([{ action: "updateContent", id: h1.id, content: "Nuevo" }]);
    expect(res.appliedIds).toContain(h1.id);

    const updated = useProjectStore.getState().project!;
    const h1b = updated.pages[0]!.root.children.find((c) => c.tagName === "h1")!;
    expect(h1b.content).toBe("Nuevo");
  });

  it("applyPatch sin proyecto no rompe", () => {
    const res = useProjectStore.getState().applyPatch([{ action: "updateContent", id: "x", content: "y" }]);
    expect(res.appliedIds).toEqual([]);
  });
});
