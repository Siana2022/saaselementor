import { describe, it, expect } from "vitest";
import { stripDataUris, parseAiDocument, buildAiUserMessage } from "../ai-compile";

describe("stripDataUris", () => {
  it("quita src/href data: y url(data:)", () => {
    const html = `<img src="data:image/png;base64,AAA" alt="x"><div style="background:url('data:image/png;base64,BBB')"></div>`;
    const out = stripDataUris(html);
    expect(out).not.toContain("data:image");
    expect(out).toContain('alt="x"');
    expect(out).toContain('src=""');
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
  it("incluye título y el HTML (sin data-URIs)", () => {
    const msg = buildAiUserMessage("home", `<h1>Hola</h1><img src="data:image/png;base64,AAA">`);
    expect(msg).toContain("home");
    expect(msg).toContain("<h1>Hola</h1>");
    expect(msg).not.toContain("data:image");
  });
});
