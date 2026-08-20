import { describe, it, expect } from "vitest";
import { compactAst, parseAiDocument, buildAiUserMessage } from "../ai-compile";
import { parseAstNode } from "@/lib/core/ast/types";

describe("compactAst", () => {
  it("reduce el AST y descarta data-URIs", () => {
    const node = parseAstNode({
      id: "11111111-1111-4111-8111-111111111111",
      tagName: "section",
      elementorRole: "container",
      classes: ["hero", "x"],
      styles: { "background-image": "url('data:image/png;base64,AAA')", "background-color": "#01125B", display: "flex" },
      children: [
        { id: "22222222-2222-4222-8222-222222222222", tagName: "img", elementorRole: "image", attributes: { src: "data:image/png;base64,BBB", alt: "foto" } },
        { id: "33333333-3333-4333-8333-333333333333", tagName: "h1", elementorRole: "heading", content: "Hola" },
      ],
    });
    const c = compactAst(node);
    expect(c.tag).toBe("section");
    expect(c.role).toBe("container");
    // data-URI de fondo descartado, color conservado
    expect(c.styles?.["background-image"]).toBeUndefined();
    expect(c.styles?.["background-color"]).toBe("#01125B");
    // img data-uri -> placeholder
    expect(c.children?.[0]?.src).toBe("__IMG__");
    expect(c.children?.[0]?.alt).toBe("foto");
    expect(c.children?.[1]?.content).toBe("Hola");
    // sin ids internos
    expect(JSON.stringify(c)).not.toContain("1111-4111");
  });
});

describe("parseAiDocument", () => {
  it("extrae y valida el JSON (con o sin fences)", () => {
    const json = `{"version":"0.4","title":"home","type":"container","content":[{"id":"a1b2c3d","elType":"widget","widgetType":"heading","settings":{"title":"Hi"},"elements":[]}]}`;
    const doc = parseAiDocument("```json\n" + json + "\n```");
    expect(doc.type).toBe("container");
    expect(doc.content[0]?.widgetType).toBe("heading");
  });
  it("rechaza JSON estructuralmente inválido", () => {
    expect(() => parseAiDocument(`{"foo":1}`)).toThrow();
  });
});

describe("buildAiUserMessage", () => {
  it("incluye título y AST compacto", () => {
    const c = { tag: "body", role: "container", content: "x" };
    const msg = buildAiUserMessage("home", c);
    expect(msg).toContain("home");
    expect(msg).toContain('"tag":"body"');
  });
});
