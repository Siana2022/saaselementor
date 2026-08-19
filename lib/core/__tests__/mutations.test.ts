import { describe, it, expect } from "vitest";
import {
  parseMutations,
  applyMutations,
  applyMutationsToProject,
} from "../mutations";
import { parseAstNode, parseProjectAst, type AstNode } from "../ast/types";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

function sampleTree(): AstNode {
  return parseAstNode({
    id: A,
    tagName: "div",
    elementorRole: "container",
    classes: ["wrap"],
    styles: { color: "#000" },
    children: [
      { id: B, tagName: "h1", elementorRole: "heading", content: "Hola", classes: ["title"] },
      { id: C, tagName: "p", elementorRole: "text", content: "Texto" },
    ],
  });
}

describe("parseMutations", () => {
  it("valida una lista de mutaciones bien formada", () => {
    const muts = parseMutations([
      { action: "updateRole", id: B, role: "loop_grid" },
      { action: "updateStyles", id: A, styles: { color: "#fff" } },
    ]);
    expect(muts).toHaveLength(2);
  });

  it("rechaza una acción desconocida", () => {
    expect(() => parseMutations([{ action: "nope", id: A }])).toThrow();
  });

  it("rechaza un role inválido en updateRole", () => {
    expect(() => parseMutations([{ action: "updateRole", id: A, role: "xxx" }])).toThrow();
  });
});

describe("applyMutations — inmutabilidad y campos", () => {
  it("no muta el árbol original", () => {
    const tree = sampleTree();
    const { root } = applyMutations(tree, [{ action: "updateRole", id: A, role: "loop_grid" }]);
    expect(tree.elementorRole).toBe("container"); // intacto
    expect(root.elementorRole).toBe("loop_grid");
  });

  it("updateStyles fusiona por defecto y reemplaza con merge:false", () => {
    const tree = sampleTree();
    const merged = applyMutations(tree, [{ action: "updateStyles", id: A, styles: { background: "#eee" } }]);
    expect(merged.root.styles).toEqual({ color: "#000", background: "#eee" });

    const replaced = applyMutations(tree, [
      { action: "updateStyles", id: A, styles: { background: "#eee" }, merge: false },
    ]);
    expect(replaced.root.styles).toEqual({ background: "#eee" });
  });

  it("updateContent, addClass y removeClass", () => {
    const tree = sampleTree();
    const { root } = applyMutations(tree, [
      { action: "updateContent", id: B, content: "Nuevo" },
      { action: "addClass", id: B, className: "featured" },
      { action: "removeClass", id: B, className: "title" },
    ]);
    const h1 = root.children.find((c) => c.id === B)!;
    expect(h1.content).toBe("Nuevo");
    expect(h1.classes).toEqual(["featured"]);
  });

  it("setDynamicMapping y setGlobalRefs", () => {
    const tree = sampleTree();
    const { root } = applyMutations(tree, [
      { action: "setDynamicMapping", id: B, dynamicMapping: { content: { tag: "post-title", token: "[post_title]" } } },
      { action: "setGlobalRefs", id: B, globalRefs: { color: A } },
    ]);
    const h1 = root.children.find((c) => c.id === B)!;
    expect(h1.dynamicMapping?.content?.token).toBe("[post_title]");
    expect(h1.globalRefs?.color).toBe(A);
  });

  it("removeNode poda el subárbol", () => {
    const tree = sampleTree();
    const { root, appliedIds } = applyMutations(tree, [{ action: "removeNode", id: C }]);
    expect(root.children.map((c) => c.id)).toEqual([B]);
    expect(appliedIds).toContain(C);
  });

  it("reporta appliedIds y missingIds", () => {
    const tree = sampleTree();
    const res = applyMutations(tree, [
      { action: "updateRole", id: B, role: "text" },
      { action: "updateRole", id: "99999999-9999-4999-8999-999999999999", role: "text" },
    ]);
    expect(res.appliedIds).toContain(B);
    expect(res.missingIds).toContain("99999999-9999-4999-8999-999999999999");
  });
});

describe("applyMutationsToProject", () => {
  it("aplica mutaciones a las páginas del proyecto", () => {
    const project = parseProjectAst({
      id: A,
      name: "demo",
      globalSystem: { id: B, colors: [], typographies: [] },
      pages: [{ id: C, name: "home", root: sampleTree() }],
    });
    const { project: next } = applyMutationsToProject(project, [
      { action: "updateRole", id: A, role: "loop_grid" },
    ]);
    expect(next.pages[0]?.root.elementorRole).toBe("loop_grid");
  });
});
