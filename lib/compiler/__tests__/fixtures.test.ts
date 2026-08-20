import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ElementorDocumentSchema } from "../elementor-types";

/**
 * Compatibilidad: los exports REALES de Elementor (fixtures/pages) deben validar
 * contra nuestro ElementorDocumentSchema. Garantiza que nuestro esquema modela
 * la estructura real (Regla: ingeniería inversa con fixtures).
 */
const DIR = join(process.cwd(), "fixtures", "pages");

describe("compatibilidad con fixtures reales de Elementor", () => {
  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json")) : [];

  it("hay fixtures disponibles", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`valida ${file} contra ElementorDocumentSchema`, () => {
      const doc = JSON.parse(readFileSync(join(DIR, file), "utf8"));
      const parsed = ElementorDocumentSchema.parse(doc);
      expect(parsed.version).toBe("0.4");
      expect(["page", "header", "footer", "archive", "loop-item", "popup", "section", "container"]).toContain(parsed.type);
    });
  }
});

import { SiteSettingsSchema, ManifestSchema, KitDocumentSchema } from "../elementor-types";

const KIT_DIR = join(process.cwd(), "fixtures", "kit");

describe("compatibilidad con el Website Kit real", () => {
  it("site-settings.json valida contra SiteSettingsSchema", () => {
    const p = join(KIT_DIR, "site-settings.json");
    if (!existsSync(p)) return; // fixture opcional
    const ss = SiteSettingsSchema.parse(JSON.parse(readFileSync(p, "utf8")));
    expect(ss.settings.system_colors.length).toBeGreaterThan(0);
    // slugs de sistema reales
    expect(ss.settings.system_colors.map((c) => c._id)).toContain("primary");
    expect(ss.settings.custom_colors.length).toBeGreaterThan(0);
    expect(ss.settings.system_typography[0]?.typography_typography).toBe("custom");
  });

  it("manifest.json valida contra ManifestSchema", () => {
    const p = join(KIT_DIR, "manifest.json");
    if (!existsSync(p)) return;
    const m = ManifestSchema.parse(JSON.parse(readFileSync(p, "utf8")));
    expect(m.elementor_version).toBeTruthy();
    expect(Object.keys(m.templates).length).toBeGreaterThan(0);
    expect(m["site-settings"].globalColors).toBe(true);
  });

  it("documentos internos del kit validan contra KitDocumentSchema", () => {
    for (const rel of ["content/page/180.json", "templates/21.json"]) {
      const p = join(KIT_DIR, rel);
      if (!existsSync(p)) continue;
      const doc = KitDocumentSchema.parse(JSON.parse(readFileSync(p, "utf8")));
      expect(Array.isArray(doc.content)).toBe(true);
    }
  });
});
