import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { compileKit, compileProject, compilePageDocument } from "../compile";
import { buildFileMap, exportProjectZip } from "../export-zip";
import { ElementorDocumentSchema, SiteSettingsSchema } from "../elementor-types";
import { buildProjectAst } from "@/lib/parser/html-to-ast";
import { applyMutationsToProject } from "@/lib/core/mutations";
import { parseAstNode, parseProjectAst, type GlobalSystemAst, type AstNode } from "@/lib/core/ast/types";

function seededUuids() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}
function seededElIds() {
  let n = 0;
  return () => `el${String(++n).padStart(5, "0")}`;
}

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

function emptyGlobals(id = UUID_A): GlobalSystemAst {
  return { id, colors: [], typographies: [] };
}
function pageRoot(children: unknown[]): AstNode {
  return parseAstNode({ id: UUID_A, tagName: "body", elementorRole: "container", children });
}

describe("compileKit", () => {
  it("compila colores y tipografías con idMap UUID->idCorto", () => {
    const gs: GlobalSystemAst = {
      id: UUID_A,
      colors: [{ id: UUID_B, name: "Primary", value: "#0af", source: "root-variable" }],
      typographies: [{ id: UUID_C, name: "H1", fontFamily: "'Inter', sans-serif", fontSize: "48px", fontWeight: "700" }],
    };
    const { siteSettings, idMap } = compileKit(gs, { elIdFactory: seededElIds() });
    expect(SiteSettingsSchema.parse(siteSettings)).toBeTruthy();
    expect(siteSettings.settings.system_colors[0]).toMatchObject({ _id: "primary", title: "Primary", color: "#0af" });
    expect(siteSettings.settings.system_typography[0]).toMatchObject({
      _id: "primary",
      title: "H1",
      typography_typography: "custom",
      typography_font_family: "Inter",
      typography_font_size: { unit: "px", size: 48 },
      typography_font_weight: "700",
    });
    // 1er color/typografía -> slot de sistema "primary"
    expect(idMap.get(UUID_B)).toBe("primary");
    expect(idMap.get(UUID_C)).toBe("primary");
  });
});

describe("compileNode — mapeo de widgets", () => {
  const idMap = new Map<string, string>();

  it("heading -> widget heading con header_size", () => {
    const doc = compilePageDocument(
      pageRoot([{ id: UUID_B, tagName: "h1", elementorRole: "heading", content: "Hola" }]),
      "home", idMap, { elIdFactory: seededElIds() },
    );
    const w = doc.content[0]!;
    expect(w.elType).toBe("widget");
    expect(w.widgetType).toBe("heading");
    expect(w.settings.title).toBe("Hola");
    expect(w.settings.header_size).toBe("h1");
  });

  it("text -> text-editor; button -> button con link; image -> image", () => {
    const doc = compilePageDocument(
      pageRoot([
        { id: UUID_B, tagName: "p", elementorRole: "text", content: "Texto" },
        { id: UUID_C, tagName: "a", elementorRole: "button", content: "Ir", attributes: { href: "/x" } },
        { id: "44444444-4444-4444-8444-444444444444", tagName: "img", elementorRole: "image", attributes: { src: "a.png", alt: "a" } },
      ]),
      "home", idMap, { elIdFactory: seededElIds() },
    );
    expect(doc.content[0]).toMatchObject({ widgetType: "text-editor", settings: { editor: "<p>Texto</p>" } });
    expect(doc.content[1]).toMatchObject({ widgetType: "button", settings: { text: "Ir", link: { url: "/x" } } });
    expect(doc.content[2]).toMatchObject({ widgetType: "image", settings: { image: { url: "a.png", alt: "a" } } });
  });

  it("roles no cubiertos y html_widget -> widget html (fallback)", () => {
    const doc = compilePageDocument(
      pageRoot([
        { id: UUID_B, tagName: "ul", elementorRole: "list", children: [{ id: UUID_C, tagName: "li", elementorRole: "text", content: "x" }] },
        { id: "44444444-4444-4444-8444-444444444444", tagName: "iframe", elementorRole: "html_widget", rawHtml: "<iframe src='y'></iframe>" },
      ]),
      "home", idMap, { elIdFactory: seededElIds() },
    );
    expect(doc.content[0]?.widgetType).toBe("html");
    expect(String(doc.content[0]?.settings.html)).toContain("<ul");
    expect(doc.content[1]?.widgetType).toBe("html");
    expect(doc.content[1]?.settings.html).toBe("<iframe src='y'></iframe>");
  });

  it("container anida sus hijos como elements", () => {
    const doc = compilePageDocument(
      pageRoot([{ id: UUID_B, tagName: "div", elementorRole: "container", children: [{ id: UUID_C, tagName: "h2", elementorRole: "heading", content: "T" }] }]),
      "home", idMap, { elIdFactory: seededElIds() },
    );
    expect(doc.content[0]?.elType).toBe("container");
    expect(doc.content[0]?.elements[0]?.widgetType).toBe("heading");
  });
});

describe("globals wiring (__globals__)", () => {
  it("mapea globalRefs.color a globals/colors?id=<idCorto>", () => {
    const gs: GlobalSystemAst = {
      id: UUID_A,
      colors: [{ id: UUID_B, name: "Primary", value: "#0af", source: "root-variable" }],
      typographies: [],
    };
    const { idMap } = compileKit(gs, { elIdFactory: seededElIds() });
    const doc = compilePageDocument(
      pageRoot([{ id: UUID_C, tagName: "h1", elementorRole: "heading", content: "H", globalRefs: { color: UUID_B } }]),
      "home", idMap, { elIdFactory: seededElIds() },
    );
    const globals = doc.content[0]?.settings.__globals__ as Record<string, string>;
    expect(globals.title_color).toBe("globals/colors?id=primary");
  });
});

describe("compileProject + export", () => {
  it("loop_candidate se compila como container estático (sin loop-item)", () => {
    const card = `<article class="card"><img src="x"><h3>t</h3><p>d</p></article>`;
    const html = `<html><head><style>:root{--color-primary:#0af}</style></head><body><div class="grid">${card}${card}${card}</div></body></html>`;
    const project = buildProjectAst(html, { name: "home" }, { idFactory: seededUuids() });

    const bundle = compileProject(project, { elIdFactory: seededElIds() });
    expect(bundle.siteSettings.settings.system_colors).toHaveLength(1);
    expect(bundle.documents.map((d) => d.type)).toEqual(["page"]); // sin loop-item
  });

  it("loop_grid CONFIRMADO genera widget loop-grid + doc loop-item con template_id", () => {
    const card = `<article class="card"><img src="x"><h3>t</h3><p>d</p></article>`;
    const html = `<body><div class="grid">${card}${card}${card}</div></body>`;
    let project = buildProjectAst(html, { name: "home" }, { idFactory: seededUuids() });

    // Confirma el patrón como loop dinámico (lo que haría la IA en el Pilar 4).
    const grid = project.pages[0]!.root.children.find((c) => c.classes.includes("grid"))!;
    project = applyMutationsToProject(project, [
      { action: "updateRole", id: grid.id, role: "loop_grid" },
    ]).project;

    const bundle = compileProject(project, { elIdFactory: seededElIds() });
    const loopItem = bundle.documents.find((d) => d.type === "loop-item");
    expect(loopItem).toBeDefined();

    // localiza el widget loop-grid en el documento de página
    const page = bundle.documents.find((d) => d.type === "page")!;
    let loopGrid: unknown;
    const walk = (els: { widgetType?: string; settings: Record<string, unknown>; elements: unknown[] }[]) => {
      for (const el of els) {
        if (el.widgetType === "loop-grid") loopGrid = el;
        walk((el.elements as typeof els) ?? []);
      }
    };
    walk(page.doc.content as never);
    expect(loopGrid).toBeDefined();
    expect((loopGrid as { settings: Record<string, unknown> }).settings.template_id).toBeDefined();
    expect((loopGrid as { settings: Record<string, unknown> }).settings.columns).toBe("3");
    for (const d of bundle.documents) expect(ElementorDocumentSchema.parse(d.doc)).toBeTruthy();
  });

  it("buildFileMap produce un Website Kit real (manifest + site-settings + content/page)", () => {
    const project = parseProjectAst({
      id: UUID_A, name: "Mi Sitio",
      globalSystem: emptyGlobals(UUID_B),
      pages: [{ id: UUID_C, name: "home", root: pageRoot([{ id: "44444444-4444-4444-8444-444444444444", tagName: "h1", elementorRole: "heading", content: "T" }]) }],
    });
    const files = buildFileMap(project, { elIdFactory: seededElIds() });
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(["manifest.json", "site-settings.json", "content/page/100.json"]),
    );
    const manifest = JSON.parse(files["manifest.json"]!);
    expect(manifest.name).toBe("mi-sitio");
    expect(manifest.content.page["100"]).toMatchObject({ doc_type: "wp-page", title: "home" });
    // el documento interno usa el shape {content, settings, metadata}
    const doc = JSON.parse(files["content/page/100.json"]!);
    expect(Object.keys(doc).sort()).toEqual(["content", "metadata", "settings"]);
    expect(doc.content[0].widgetType).toBe("heading");
  });

  it("exportProjectZip genera un ZIP legible con las entradas esperadas", async () => {
    const project = parseProjectAst({
      id: UUID_A, name: "demo",
      globalSystem: emptyGlobals(UUID_B),
      pages: [{ id: UUID_C, name: "home", root: pageRoot([{ id: "44444444-4444-4444-8444-444444444444", tagName: "p", elementorRole: "text", content: "hola" }]) }],
    });
    const bytes = await exportProjectZip(project, { elIdFactory: seededElIds() });
    expect(bytes.byteLength).toBeGreaterThan(0);
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file("manifest.json")).toBeTruthy();
    expect(zip.file("site-settings.json")).toBeTruthy();
    expect(zip.file("content/page/100.json")).toBeTruthy();
    const doc = JSON.parse(await zip.file("content/page/100.json")!.async("string"));
    expect(doc.content[0].widgetType).toBe("text-editor");
  });
});

describe("exportTemplatesZip (plantillas standalone inline)", () => {
  it("genera JSONs con formato standalone y estilos inline (sin __globals__)", async () => {
    const { exportTemplatesZip } = await import("../export-zip");
    const html = `<html><head><style>.h{color:#01125B;font-size:40px;background-color:#8ACDCF}</style></head><body><section class="h"><h1 class="h">T</h1></section></body></html>`;
    const project = buildProjectAst(html, { name: "home" }, { idFactory: seededUuids() });
    const bytes = await exportTemplatesZip(project, { elIdFactory: seededElIds() });
    const zip = await JSZip.loadAsync(bytes);
    const file = zip.file("home.json");
    expect(file).toBeTruthy();
    const doc = JSON.parse(await file!.async("string"));
    // formato standalone
    expect(doc.type).toBe("page");
    expect(doc.version).toBe("0.4");
    expect(Array.isArray(doc.content)).toBe(true);
    // estilos inline literales, NO globals
    const json = JSON.stringify(doc);
    expect(json).not.toContain("__globals__");
    expect(json).toContain("#01125B");
  });
});
