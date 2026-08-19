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
