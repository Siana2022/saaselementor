import { describe, it, expect } from "vitest";
import {
  AstNodeSchema,
  ProjectAstSchema,
  GlobalSystemAstSchema,
  parseAstNode,
  parseProjectAst,
  type AstNode,
} from "../types";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

describe("AstNodeSchema", () => {
  it("aplica defaults sensatos a un nodo mínimo", () => {
    const node = parseAstNode({ id: UUID_A, tagName: "div" });
    expect(node.nodeType).toBe("element");
    expect(node.classes).toEqual([]);
    expect(node.attributes).toEqual({});
    expect(node.styles).toEqual({});
    expect(node.children).toEqual([]);
    expect(node.elementorRole).toBe("unknown");
  });

  it("valida nodos recursivos (children anidados)", () => {
    const tree = {
      id: UUID_A,
      tagName: "section",
      elementorRole: "container",
      children: [
        {
          id: UUID_B,
          tagName: "h1",
          elementorRole: "heading",
          content: "Hola",
        },
      ],
    };
    const parsed = parseAstNode(tree);
    expect(parsed.children).toHaveLength(1);
    expect(parsed.children[0]?.elementorRole).toBe("heading");
  });

  it("rechaza un id que no sea UUID", () => {
    const res = AstNodeSchema.safeParse({ id: "not-a-uuid", tagName: "div" });
    expect(res.success).toBe(false);
  });

  it("rechaza un elementorRole inexistente", () => {
    const res = AstNodeSchema.safeParse({
      id: UUID_A,
      tagName: "div",
      elementorRole: "carousel_3000",
    });
    expect(res.success).toBe(false);
  });

  it("soporta dynamicMapping y globalRefs", () => {
    const node = parseAstNode({
      id: UUID_A,
      tagName: "h1",
      elementorRole: "heading",
      dynamicMapping: { content: { tag: "post-title", token: "[post_title]" } },
      globalRefs: { color: UUID_B, typography: UUID_C, marginTop: UUID_A },
    });
    expect(node.dynamicMapping?.content?.token).toBe("[post_title]");
    expect(node.globalRefs?.color).toBe(UUID_B);
    // catchall: propiedad de estilo arbitraria -> id global
    expect(node.globalRefs?.marginTop).toBe(UUID_A);
  });

  it("soporta patternMeta y plantillas de loop", () => {
    const grid: AstNode = parseAstNode({
      id: UUID_A,
      tagName: "div",
      elementorRole: "loop_candidate",
      patternMeta: { signature: "div>img+h3+p", repeatedCount: 4, templateChildId: UUID_B },
      children: [
        { id: UUID_B, tagName: "article", elementorRole: "loop_item_template", isTemplate: true },
      ],
    });
    expect(grid.patternMeta?.repeatedCount).toBe(4);
    expect(grid.children[0]?.isTemplate).toBe(true);
  });
});

describe("GlobalSystemAstSchema", () => {
  it("valida colores y tipografías globales", () => {
    const gs = GlobalSystemAstSchema.parse({
      id: UUID_A,
      colors: [{ id: UUID_B, name: "Primary", value: "#0af", cssVariable: "--color-primary", source: "root-variable" }],
      typographies: [{ id: UUID_C, name: "H1", fontSize: "48px", selector: "h1", source: "tag" }],
      rootVariables: { "--color-primary": "#0af" },
    });
    expect(gs.colors[0]?.name).toBe("Primary");
    expect(gs.typographies[0]?.fontSize).toBe("48px");
  });
});

describe("ProjectAstSchema", () => {
  it("valida un proyecto completo Two-Pass (global + pages)", () => {
    const project = parseProjectAst({
      id: UUID_A,
      name: "demo",
      globalSystem: { id: UUID_B, colors: [], typographies: [] },
      pages: [
        {
          id: UUID_C,
          name: "home",
          root: { id: UUID_A, tagName: "body", elementorRole: "container" },
          source: { fileName: "index.html", templateType: "page" },
        },
      ],
    });
    expect(project.schemaVersion).toBe("1.0.0");
    expect(project.pages[0]?.name).toBe("home");
  });
});
