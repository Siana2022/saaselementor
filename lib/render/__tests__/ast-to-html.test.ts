import { describe, it, expect } from "vitest";
import { astToHtml, buildIframeSrcDoc } from "../ast-to-html";
import { parseAstNode } from "@/lib/core/ast/types";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("astToHtml", () => {
  it("serializa con data-ast-id, clases, estilos y atributos", () => {
    const node = parseAstNode({
      id: A, tagName: "h1", elementorRole: "heading",
      classes: ["title"], styles: { color: "#f00" }, attributes: { "data-x": "1" }, content: "Hola",
    });
    const html = astToHtml(node);
    expect(html).toContain(`data-ast-id="${A}"`);
    expect(html).toContain(`class="title"`);
    expect(html).toContain(`style="color:#f00"`);
    expect(html).toContain(`data-x="1"`);
    expect(html).toContain(`>Hola</h1>`);
  });

  it("maneja void tags (img) sin cierre", () => {
    const node = parseAstNode({ id: A, tagName: "img", elementorRole: "image", attributes: { src: "a.png" } });
    const html = astToHtml(node);
    expect(html).toContain("<img ");
    expect(html).not.toContain("</img>");
  });

  it("escapa contenido de texto", () => {
    const node = parseAstNode({ id: A, tagName: "p", elementorRole: "text", content: "<b>x</b> & y" });
    expect(astToHtml(node)).toContain("&lt;b&gt;x&lt;/b&gt; &amp; y");
  });

  it("inyecta rawHtml para html_widget", () => {
    const node = parseAstNode({ id: A, tagName: "iframe", elementorRole: "html_widget", rawHtml: "<iframe src='y'></iframe>" });
    const html = astToHtml(node);
    expect(html).toContain(`data-ast-id="${A}"`);
    expect(html).toContain("<iframe src='y'></iframe>");
  });

  it("buildIframeSrcDoc incluye CSS y el script de selección", () => {
    const root = parseAstNode({ id: A, tagName: "body", elementorRole: "container", children: [{ id: B, tagName: "p", elementorRole: "text", content: "hola" }] });
    const doc = buildIframeSrcDoc(root, "body{margin:0}");
    expect(doc).toContain("<style>body{margin:0}</style>");
    expect(doc).toContain("ast:select");
    expect(doc).toContain(`data-ast-id="${B}"`);
  });
});
