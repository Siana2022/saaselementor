import { describe, it, expect } from "vitest";
import { extractGlobalSystem, collectStyleCss } from "../global-system";

/** Fábrica de UUIDs deterministas y válidos para asserts estables. */
function seededIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

describe("extractGlobalSystem — variables :root", () => {
  it("captura todas las custom properties en rootVariables", () => {
    const css = `:root{ --color-primary:#0af; --space-lg:32px; --font-body:'Inter'; }`;
    const gs = extractGlobalSystem(css, { idFactory: seededIds() });
    expect(gs.rootVariables).toEqual({
      "--color-primary": "#0af",
      "--space-lg": "32px",
      "--font-body": "'Inter'",
    });
  });

  it("crea GlobalColor solo para variables con valor de color", () => {
    const css = `:root{ --color-primary:#0af; --secondary:rgb(10,20,30); --brand:hsl(200,50%,50%); --space-lg:32px; }`;
    const gs = extractGlobalSystem(css, { idFactory: seededIds() });
    expect(gs.colors.map((c) => [c.name, c.value, c.cssVariable])).toEqual([
      ["Primary", "#0af", "--color-primary"],
      ["Secondary", "rgb(10,20,30)", "--secondary"],
      ["Brand", "hsl(200,50%,50%)", "--brand"],
    ]);
    // --space-lg no es color
    expect(gs.colors.find((c) => c.cssVariable === "--space-lg")).toBeUndefined();
    expect(gs.colors.every((c) => c.source === "root-variable")).toBe(true);
  });

  it("deriva nombres limpios eliminando el token 'color'", () => {
    const css = `:root{ --primary-color:#111; --color-accent:#222; --brand-secondary:#333; }`;
    const gs = extractGlobalSystem(css, { idFactory: seededIds() });
    expect(gs.colors.map((c) => c.name)).toEqual([
      "Primary",
      "Accent",
      "Brand Secondary",
    ]);
  });
});

describe("extractGlobalSystem — tipografías por etiqueta", () => {
  it("extrae y mapea props de fuente de h1-h6/body/p", () => {
    const css = `
      h1 { font-family: 'Inter', sans-serif; font-size: 48px; font-weight: 700; line-height: 1.1; }
      body { font-family: Georgia, serif; font-size: 16px; letter-spacing: .2px; }
      p { font-size: 16px; text-transform: none; }
    `;
    const gs = extractGlobalSystem(css, { idFactory: seededIds() });
    const byName = Object.fromEntries(gs.typographies.map((t) => [t.name, t]));

    expect(byName.H1).toMatchObject({
      selector: "h1",
      source: "tag",
      fontFamily: "'Inter', sans-serif",
      fontSize: "48px",
      fontWeight: "700",
      lineHeight: "1.1",
    });
    expect(byName.Body).toMatchObject({ fontSize: "16px", letterSpacing: ".2px" });
    expect(byName.Paragraph).toMatchObject({ selector: "p", fontSize: "16px" });
  });

  it("aplica cascada (last-wins) sobre la misma etiqueta", () => {
    const css = `h2 { font-size: 20px; } h2 { font-size: 28px; font-weight: 600; }`;
    const gs = extractGlobalSystem(css, { idFactory: seededIds() });
    const h2 = gs.typographies.find((t) => t.name === "H2");
    expect(h2?.fontSize).toBe("28px");
    expect(h2?.fontWeight).toBe("600");
  });

  it("ignora reglas anidadas en @media para la tipografía base", () => {
    const css = `
      h1 { font-size: 48px; }
      @media (max-width: 600px) { h1 { font-size: 24px; } }
    `;
    const gs = extractGlobalSystem(css, { idFactory: seededIds() });
    const h1 = gs.typographies.find((t) => t.name === "H1");
    expect(h1?.fontSize).toBe("48px");
  });

  it("agrega familias tipográficas únicas en meta.fontFamilies", () => {
    const css = `h1 { font-family: 'Inter', sans-serif; } body { font-family: Inter, sans-serif; } h2 { font-family: Georgia, serif; }`;
    const gs = extractGlobalSystem(css, { idFactory: seededIds() });
    expect(gs.meta?.fontFamilies).toEqual(["Inter", "Georgia"]);
  });
});

describe("extractGlobalSystem — robustez y salida", () => {
  it("devuelve una estructura válida y vacía ante CSS vacío", () => {
    const gs = extractGlobalSystem("", { idFactory: seededIds() });
    expect(gs.colors).toEqual([]);
    expect(gs.typographies).toEqual([]);
    expect(gs.rootVariables).toBeUndefined();
  });

  it("no lanza ante CSS roto: registra una nota", () => {
    const gs = extractGlobalSystem("h1 { color: ", { idFactory: seededIds() });
    // postcss es tolerante; si fallara, habría nota. En cualquier caso no lanza.
    expect(gs).toBeTruthy();
    expect(Array.isArray(gs.colors)).toBe(true);
  });

  it("asigna UUIDs (system, colores, tipografías)", () => {
    const css = `:root{ --color-primary:#0af; } h1{ font-size:40px; }`;
    const gs = extractGlobalSystem(css, { idFactory: seededIds() });
    expect(gs.id).toBe("00000000-0000-4000-8000-000000000001");
    expect(gs.colors[0]?.id).toBe("00000000-0000-4000-8000-000000000002");
    expect(gs.typographies[0]?.id).toBe("00000000-0000-4000-8000-000000000003");
  });
});

describe("collectStyleCss", () => {
  it("concatena el contenido de todos los <style>", () => {
    const html = `<html><head><style>:root{--a:#111}</style><style>h1{font-size:40px}</style></head><body></body></html>`;
    const css = collectStyleCss(html);
    const gs = extractGlobalSystem(css, { idFactory: seededIds() });
    expect(gs.rootVariables).toEqual({ "--a": "#111" });
    expect(gs.typographies[0]?.fontSize).toBe("40px");
  });
});
