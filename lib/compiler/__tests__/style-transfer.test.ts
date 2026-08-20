import { describe, it, expect } from "vitest";
import { parseLen, parseFourSides, typographySettings, flexSettings } from "../style-map";
import { compilePageDocument } from "../compile";
import { buildProjectAst } from "@/lib/parser/html-to-ast";
import { compileProject } from "../compile";
import type { ElementorElement } from "../elementor-types";

function seededIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}
function walk(els: ElementorElement[], fn: (e: ElementorElement) => void) {
  for (const e of els) {
    fn(e);
    walk(e.elements ?? [], fn);
  }
}

describe("style-map helpers", () => {
  it("parseLen", () => {
    expect(parseLen("48px")).toEqual({ unit: "px", size: 48, sizes: [] });
    expect(parseLen("1.5", "em")).toEqual({ unit: "em", size: 1.5, sizes: [] });
    expect(parseLen("auto")).toBeUndefined();
  });
  it("parseFourSides shorthand", () => {
    expect(parseFourSides("10px")).toMatchObject({ unit: "px", top: "10", right: "10", bottom: "10", left: "10", isLinked: true });
    expect(parseFourSides("10px 20px")).toMatchObject({ top: "10", right: "20", bottom: "10", left: "20", isLinked: false });
    expect(parseFourSides("0 auto")).toBeUndefined();
  });
  it("typographySettings", () => {
    const s = typographySettings({ "font-family": "'Inter', sans-serif", "font-size": "58px", "font-weight": "700", "text-align": "center" });
    expect(s).toMatchObject({
      typography_typography: "custom",
      typography_font_family: "Inter",
      typography_font_size: { unit: "px", size: 58 },
      typography_font_weight: "700",
      align: "center",
    });
  });
  it("flexSettings", () => {
    const s = flexSettings({ display: "flex", "flex-direction": "column", "justify-content": "center", "align-items": "flex-start", gap: "16px" });
    expect(s).toMatchObject({ flex_direction: "column", flex_justify_content: "center", flex_align_items: "flex-start" });
    expect(s.flex_gap).toMatchObject({ unit: "px", size: 16 });
  });
});

describe("transferencia de estilos end-to-end (CSS de clases -> settings)", () => {
  it("heading/text/container llevan tipografía, color, fondo y espaciado", () => {
    const html = `<html><head><style>
      .hero{ display:flex; flex-direction:column; background-color:#01125B; padding:40px; gap:16px; border-radius:20px }
      .hero h1{ font-family:Montserrat; font-size:58px; font-weight:700; color:#ffffff; text-align:center }
      .hero p{ font-size:16px; color:#8ACDCF }
    </style></head><body>
      <section class="hero"><h1>Título</h1><p>Desc</p></section>
    </body></html>`;
    const project = buildProjectAst(html, { name: "home" }, { idFactory: seededIds() });
    const bundle = compileProject(project, { elIdFactory: () => Math.random().toString(36).slice(2, 9) });

    let container: ElementorElement | undefined;
    let heading: ElementorElement | undefined;
    let text: ElementorElement | undefined;
    walk(bundle.documents[0]!.doc.content, (e) => {
      if (e.elType === "container" && (e.settings.background_color || e.settings.flex_direction)) container = e;
      if (e.widgetType === "heading") heading = e;
      if (e.widgetType === "text-editor") text = e;
    });

    // Container: flex + padding + radius literales; fondo GLOBALIZADO (DRY)
    expect(container?.settings).toMatchObject({ flex_direction: "column", background_background: "classic" });
    expect(container?.settings.padding).toMatchObject({ top: "40", isLinked: true });
    expect(container?.settings.border_radius).toMatchObject({ top: "20" });
    const cGlobals = container?.settings.__globals__ as Record<string, string>;
    expect(cGlobals.background_color).toMatch(/^globals\/colors\?id=/);

    // Heading: color y tipografía GLOBALIZADOS; align inline
    expect(heading?.settings.align).toBe("center");
    const hGlobals = heading?.settings.__globals__ as Record<string, string>;
    expect(hGlobals.title_color).toMatch(/^globals\/colors\?id=/);
    expect(hGlobals.typography_typography).toMatch(/^globals\/typography\?id=/);

    // Text: color de texto globalizado
    const tGlobals = text?.settings.__globals__ as Record<string, string>;
    expect(tGlobals.text_color).toMatch(/^globals\/colors\?id=/);

    // El Kit contiene los valores reales (fidelidad end-to-end)
    const colors = bundle.siteSettings.settings.system_colors.concat(bundle.siteSettings.settings.custom_colors);
    expect(colors.map((c) => c.color)).toEqual(expect.arrayContaining(["#01125B", "#ffffff", "#8ACDCF"]));
    const typos = bundle.siteSettings.settings.system_typography.concat(bundle.siteSettings.settings.custom_typography);
    expect(typos.some((t) => t.typography_font_family === "Montserrat")).toBe(true);
  });
});

import { backgroundImageSettings } from "../style-map";

describe("mejoras de fidelidad: clamp() e imágenes de fondo", () => {
  it("parseLen tolera clamp()/rem (toma la mayor px-equivalente)", () => {
    expect(parseLen("clamp(2rem, 5vw, 4rem)")).toEqual({ unit: "px", size: 64, sizes: [] });
    expect(parseLen("1.5rem")).toEqual({ unit: "rem", size: 1.5, sizes: [] });
    expect(parseLen("calc(100% - 20px)")).toEqual({ unit: "px", size: 20, sizes: [] });
  });

  it("backgroundImageSettings extrae url() y pone classic + cover", () => {
    const s = backgroundImageSettings({ "background-image": "url('data:image/png;base64,AAA')" });
    expect(s.background_background).toBe("classic");
    expect((s.background_image as { url: string }).url).toBe("data:image/png;base64,AAA");
    expect(s.background_size).toBe("cover");
  });

  it("un container con background-image exporta background_image", () => {
    const html = `<html><head><style>
      .hero{ background-image:url('https://x.com/hero.jpg'); background-size:cover }
      .hero h1{ font-size:clamp(2rem,5vw,3.5rem); color:#fff }
    </style></head><body><section class="hero"><h1>T</h1></section></body></html>`;
    const project = buildProjectAst(html, { name: "home" }, { idFactory: seededIds() });
    const bundle = compileProject(project, { elIdFactory: () => Math.random().toString(36).slice(2, 9) });

    let heroBg: ElementorElement | undefined;
    walk(bundle.documents[0]!.doc.content, (e) => {
      if (e.settings.background_image) heroBg = e;
    });
    expect(heroBg).toBeDefined();
    expect((heroBg!.settings.background_image as { url: string }).url).toBe("https://x.com/hero.jpg");

    // El título fluido (clamp) ahora tiene tamaño en el Kit
    const typos = bundle.siteSettings.settings.system_typography.concat(bundle.siteSettings.settings.custom_typography);
    expect(typos.some((t) => t.typography_font_size && t.typography_font_size.size === 56)).toBe(true);
  });
});
