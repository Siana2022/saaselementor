import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { ingestZipToHtml } from "../ingest-zip";
import { buildProjectAst } from "../html-to-ast";

// PNG 1x1 transparente
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function makeZip(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [p, c] of Object.entries(files)) zip.file(p, c);
  return zip.generateAsync({ type: "uint8array" });
}

describe("ingestZipToHtml", () => {
  it("inyecta CSS externo enlazado como <style>", async () => {
    const zip = await makeZip({
      "index.html": `<html><head><link rel="stylesheet" href="css/style.css"></head><body><h1>Hola</h1></body></html>`,
      "css/style.css": `:root{--color-primary:#0af} h1{font-size:48px}`,
    });
    const { html, fileName } = await ingestZipToHtml(zip);
    expect(fileName).toBe("index.html");
    expect(html).toContain("<style");
    expect(html).toContain("--color-primary:#0af");
    expect(html).not.toContain('<link rel="stylesheet"');

    // el pipeline completo ahora ve el CSS externo
    const project = buildProjectAst(html, { name: "z" });
    expect(project.globalSystem.colors[0]?.value).toBe("#0af");
    expect(project.globalSystem.typographies[0]?.fontSize).toBe("48px");
  });

  it("embebe imágenes referenciadas como data URI", async () => {
    const zip = await makeZip({
      "index.html": `<body><img src="img/a.png" alt="a"></body>`,
      "img/a.png": PNG_1x1,
    });
    const { html } = await ingestZipToHtml(zip);
    expect(html).toContain("src=\"data:image/png;base64,");
  });

  it("reescribe url() del CSS a data URI", async () => {
    const zip = await makeZip({
      "index.html": `<html><head><link rel="stylesheet" href="s.css"></head><body><div class="hero"></div></body></html>`,
      "s.css": `.hero{background:url('img/bg.png')}`,
      "img/bg.png": PNG_1x1,
    });
    const { html } = await ingestZipToHtml(zip);
    expect(html).toContain("data:image/png;base64,");
    expect(html).not.toContain("url('img/bg.png')");
  });

  it("prefiere index.html y respeta rutas relativas anidadas", async () => {
    const zip = await makeZip({
      "site/otra.html": `<body><p>otra</p></body>`,
      "site/index.html": `<html><head><link rel="stylesheet" href="../assets/main.css"></head><body><h1>Home</h1></body></html>`,
      "assets/main.css": `h1{color:#111}`,
    });
    const { html, fileName } = await ingestZipToHtml(zip);
    expect(fileName).toBe("site/index.html");
    expect(html).toContain("color:#111");
  });

  it("lanza si no hay HTML", async () => {
    const zip = await makeZip({ "readme.txt": "nada" });
    await expect(ingestZipToHtml(zip)).rejects.toThrow(/html/i);
  });
});

describe("ingestZipAll — multi-página", () => {
  it("procesa TODAS las páginas HTML del ZIP", async () => {
    const zip = await makeZip({
      "index.html": `<html><head><link rel="stylesheet" href="s.css"></head><body><h1>Home</h1></body></html>`,
      "about.html": `<html><head><link rel="stylesheet" href="s.css"></head><body><h1>About</h1></body></html>`,
      "blog/post.html": `<body><p>post</p></body>`,
      "s.css": `h1{color:#0af}`,
    });
    const { ingestZipAll } = await import("../ingest-zip");
    const pages = await ingestZipAll(zip);
    expect(pages).toHaveLength(3);
    // index.html va primero
    expect(pages[0]!.fileName).toBe("index.html");
    expect(pages.map((p) => p.name).sort()).toEqual(["about", "index", "post"]);
    // el CSS externo se inyecta en cada una que lo enlaza
    expect(pages[0]!.html).toContain("color:#0af");
  });
});
