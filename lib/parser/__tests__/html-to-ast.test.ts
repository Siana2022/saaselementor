import { describe, it, expect } from "vitest";
import {
  htmlToAst,
  htmlToPageAst,
  buildProjectAst,
} from "../html-to-ast";
import type { AstNode } from "@/lib/core/ast/types";

function seededIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

/** Encuentra el primer nodo que cumple el predicado (DFS). */
function find(node: AstNode, pred: (n: AstNode) => boolean): AstNode | undefined {
  if (pred(node)) return node;
  for (const c of node.children) {
    const r = find(c, pred);
    if (r) return r;
  }
  return undefined;
}

describe("htmlToAst — construcción básica", () => {
  it("infiere roles por etiqueta", () => {
    const html = `
      <body>
        <section>
          <h1>Titulo</h1>
          <p>Parrafo</p>
          <img src="a.png" alt="a">
          <a href="/x" class="btn">Comprar</a>
          <a href="/y">enlace</a>
          <ul><li>1</li></ul>
          <hr>
        </section>
      </body>`;
    const root = htmlToAst(html, { idFactory: seededIds() });
    expect(root.tagName).toBe("body");
    expect(find(root, (n) => n.tagName === "h1")?.elementorRole).toBe("heading");
    expect(find(root, (n) => n.tagName === "p")?.elementorRole).toBe("text");
    expect(find(root, (n) => n.tagName === "img")?.elementorRole).toBe("image");
    expect(find(root, (n) => n.tagName === "a" && n.classes.includes("btn"))?.elementorRole).toBe("button");
    expect(find(root, (n) => n.tagName === "a" && !n.classes.includes("btn"))?.elementorRole).toBe("link");
    expect(find(root, (n) => n.tagName === "ul")?.elementorRole).toBe("list");
    expect(find(root, (n) => n.tagName === "hr")?.elementorRole).toBe("divider");
  });

  it("captura atributos, clases, estilos inline y contenido de texto", () => {
    const html = `<body><h1 class="title big" style="color:#f00; font-size:40px" data-x="1">Hola</h1></body>`;
    const root = htmlToAst(html, { idFactory: seededIds() });
    const h1 = find(root, (n) => n.tagName === "h1")!;
    expect(h1.classes).toEqual(["title", "big"]);
    expect(h1.attributes).toEqual({ "data-x": "1" });
    expect(h1.styles).toEqual({ color: "#f00", "font-size": "40px" });
    expect(h1.content).toBe("Hola");
  });

  it("no incluye script/style/head en el árbol", () => {
    const html = `<html><head><title>t</title></head><body><script>1</script><style>x{}</style><p>ok</p></body></html>`;
    const root = htmlToAst(html, { idFactory: seededIds() });
    expect(find(root, (n) => n.tagName === "script")).toBeUndefined();
    expect(find(root, (n) => n.tagName === "style")).toBeUndefined();
    expect(find(root, (n) => n.tagName === "p")).toBeDefined();
  });

  it("envuelve iframe como html_widget con rawHtml", () => {
    const html = `<body><div><iframe src="https://x.com/v"></iframe></div></body>`;
    const root = htmlToAst(html, { idFactory: seededIds() });
    const w = find(root, (n) => n.elementorRole === "html_widget")!;
    expect(w.tagName).toBe("iframe");
    expect(w.rawHtml).toContain("<iframe");
    expect(w.children).toEqual([]);
  });
});

describe("htmlToAst — pattern matching", () => {
  it("marca grid de tarjetas como loop_candidate y sus hijos como plantillas", () => {
    const card = `<article class="card"><img src="x"><h3>t</h3><p>d</p></article>`;
    const html = `<body><div class="grid">${card}${card}${card}${card}</div></body>`;
    const root = htmlToAst(html, { idFactory: seededIds() });
    const grid = find(root, (n) => n.classes.includes("grid"))!;
    expect(grid.elementorRole).toBe("loop_candidate");
    expect(grid.patternMeta?.repeatedCount).toBe(4);
    expect(grid.patternMeta?.templateChildId).toBeDefined();
    const templates = grid.children.filter((c) => c.isTemplate);
    expect(templates).toHaveLength(4);
    expect(templates.every((t) => t.elementorRole === "loop_item_template")).toBe(true);
  });

  it("distingue repeater_candidate para items simples (poca profundidad)", () => {
    const html = `<body><ul class="tags"><li>a</li><li>b</li><li>c</li><li>d</li></ul></body>`;
    const root = htmlToAst(html, { idFactory: seededIds() });
    const ul = find(root, (n) => n.classes.includes("tags"))!;
    expect(ul.elementorRole).toBe("repeater_candidate");
    expect(ul.patternMeta?.repeatedCount).toBe(4);
  });

  it("no activa el patrón con menos de 3 repeticiones", () => {
    const card = `<article><img src="x"><h3>t</h3></article>`;
    const html = `<body><div class="grid">${card}${card}</div></body>`;
    const root = htmlToAst(html, { idFactory: seededIds() });
    const grid = find(root, (n) => n.classes.includes("grid"))!;
    expect(grid.elementorRole).toBe("container");
    expect(grid.patternMeta).toBeUndefined();
  });

  it("respeta un patternThreshold personalizado", () => {
    const html = `<body><ul class="t"><li>a</li><li>b</li></ul></body>`;
    const root = htmlToAst(html, { idFactory: seededIds(), patternThreshold: 2 });
    const ul = find(root, (n) => n.classes.includes("t"))!;
    expect(ul.patternMeta?.repeatedCount).toBe(2);
  });
});

describe("buildProjectAst — integración Two-Pass", () => {
  it("combina GlobalSystem (Fase 1) y páginas (Fase 2) y enlaza globalRefs", () => {
    const html = `
      <html><head>
        <style>:root{--color-primary:#0af} h1{font-size:48px}</style>
      </head><body>
        <h1 style="color: var(--color-primary)">Hola</h1>
      </body></html>`;
    const project = buildProjectAst(html, { name: "home", fileName: "index.html" });

    expect(project.name).toBe("home");
    expect(project.globalSystem.colors[0]?.value).toBe("#0af");
    expect(project.pages).toHaveLength(1);

    const primaryId = project.globalSystem.colors[0]?.id;
    const h1 = find(project.pages[0]!.root, (n) => n.tagName === "h1")!;
    expect(h1.globalRefs?.color).toBe(primaryId);
  });

  it("htmlToPageAst produce un PageAst válido", () => {
    const page = htmlToPageAst("<body><p>hola</p></body>", { name: "p1" }, { idFactory: seededIds() });
    expect(page.name).toBe("p1");
    expect(page.source?.templateType).toBe("page");
    expect(page.root.tagName).toBe("body");
  });
});

describe("htmlToAst — SVG como bloque único", () => {
  it("no desciende dentro de <svg> (sin nodos circle/path)", () => {
    const html = `<body><div><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/><path d="M0 0"/></svg></div></body>`;
    const root = htmlToAst(html, { idFactory: seededIds() });
    const svg = find(root, (n) => n.tagName === "svg")!;
    expect(svg.elementorRole).toBe("html_widget");
    expect(svg.children).toEqual([]);
    expect(svg.rawHtml).toContain("<circle");
    expect(find(root, (n) => n.tagName === "circle")).toBeUndefined();
    expect(find(root, (n) => n.tagName === "path")).toBeUndefined();
  });
});

describe("buildProjectAstFromPages — multi-página", () => {
  it("crea varias páginas con un Kit global compartido", async () => {
    const { buildProjectAstFromPages } = await import("../html-to-ast");
    const mk = (t: string) =>
      `<html><head><style>.t{color:#01125B;font-family:Montserrat;font-size:40px}</style></head><body><h1 class="t">${t}</h1></body></html>`;
    const project = buildProjectAstFromPages(
      [
        { name: "home", html: mk("Home") },
        { name: "about", html: mk("About") },
      ],
      "MiSitio",
      { idFactory: seededIds() },
    );
    expect(project.pages).toHaveLength(2);
    expect(project.pages.map((p) => p.name)).toEqual(["home", "about"]);
    // color compartido: un único global referenciado por ambas páginas
    const c = project.globalSystem.colors.find((x) => x.value === "#01125B");
    expect(c).toBeDefined();
    const h1a = project.pages[0]!.root.children.find((n) => n.tagName === "h1")!;
    const h1b = project.pages[1]!.root.children.find((n) => n.tagName === "h1")!;
    expect(h1a.globalRefs?.color).toBe(c!.id);
    expect(h1b.globalRefs?.color).toBe(c!.id);
  });
});
