import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { computeStyles } from "../css-resolver";
import { htmlToAst } from "../html-to-ast";
import type { AstNode } from "@/lib/core/ast/types";

function find(node: AstNode, pred: (n: AstNode) => boolean): AstNode | undefined {
  if (pred(node)) return node;
  for (const c of node.children) {
    const r = find(c, pred);
    if (r) return r;
  }
  return undefined;
}
function seededIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

describe("computeStyles", () => {
  it("aplica estilos por clase y etiqueta", () => {
    const $ = cheerio.load(`<body><h1 class="title">Hola</h1></body>`);
    const css = `h1{font-size:40px;color:#111} .title{color:#f00;font-weight:700}`;
    const map = computeStyles($, css);
    const h1 = $("h1").get(0)!;
    const s = map.get(h1 as never)!;
    expect(s["font-size"]).toBe("40px");
    expect(s["font-weight"]).toBe("700");
    // .title (clase, spec 100) gana a h1 (tipo, spec 1) para color
    expect(s["color"]).toBe("#f00");
  });

  it("respeta especificidad e !important", () => {
    const $ = cheerio.load(`<body><p id="x" class="c">t</p></body>`);
    const css = `p{color:#001} .c{color:#002} #x{color:#003} p{color:#004 !important}`;
    const map = computeStyles($, css);
    const s = map.get($("p").get(0) as never)!;
    // !important gana pese a menor especificidad
    expect(s["color"]).toBe("#004");
  });

  it("hereda propiedades heredables a los hijos", () => {
    const $ = cheerio.load(`<body class="b"><div><span>t</span></div></body>`);
    const css = `.b{color:#0af;font-family:Inter}`;
    const map = computeStyles($, css);
    const span = $("span").get(0)!;
    const s = map.get(span as never)!;
    expect(s["color"]).toBe("#0af");
    expect(s["font-family"]).toBe("Inter");
  });

  it("no hereda propiedades no heredables (padding)", () => {
    const $ = cheerio.load(`<body class="b"><span>t</span></body>`);
    const map = computeStyles($, `.b{padding:20px;color:#111}`);
    const s = map.get($("span").get(0) as never)!;
    expect(s["padding"]).toBeUndefined();
    expect(s["color"]).toBe("#111"); // color sí hereda
  });
});

describe("htmlToAst con CSS de clases", () => {
  it("los estilos computados aterrizan en node.styles", () => {
    const html = `<html><head><style>
      .hero{background-color:#01125B;padding:40px}
      .hero h1{font-size:58px;color:#fff}
    </style></head><body><section class="hero"><h1>Título</h1></section></body></html>`;
    const root = htmlToAst(html, { idFactory: seededIds() });
    const hero = find(root, (n) => n.classes.includes("hero"))!;
    const h1 = find(root, (n) => n.tagName === "h1")!;
    expect(hero.styles["background-color"]).toBe("#01125B");
    expect(hero.styles["padding"]).toBe("40px");
    expect(h1.styles["font-size"]).toBe("58px");
    expect(h1.styles["color"]).toBe("#fff");
  });
});
