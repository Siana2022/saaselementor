/**
 * Analiza fixtures reales de Elementor (fixtures/pages/*.json) y produce un
 * informe de la estructura: tipos de documento, censo de widgets y unión de
 * claves de `settings` por widget. Base para derivar/afinar los schemas Zod.
 *
 * Uso:  node scripts/analyze-fixture.ts   (Node 24: type-stripping nativo)
 *       o  npm run analyze:fixtures
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface ElNode {
  elType?: string;
  widgetType?: string;
  settings?: Record<string, unknown>;
  elements?: ElNode[];
}

const DIR = join(process.cwd(), "fixtures", "pages");

const docTypes: Record<string, number> = {};
const widgetCensus: Record<string, number> = {};
const settingsByWidget: Record<string, Set<string>> = {};
const globalKeys = new Set<string>();
const dynamicKeys = new Set<string>();

function walk(node: ElNode): void {
  if (!node || typeof node !== "object") return;
  if (node.widgetType) {
    widgetCensus[node.widgetType] = (widgetCensus[node.widgetType] ?? 0) + 1;
    const set = (settingsByWidget[node.widgetType] ??= new Set());
    for (const k of Object.keys(node.settings ?? {})) {
      if (k === "__globals__") {
        for (const gk of Object.keys(node.settings?.__globals__ as object)) globalKeys.add(gk);
      } else if (k === "__dynamic__") {
        for (const dk of Object.keys(node.settings?.__dynamic__ as object)) dynamicKeys.add(dk);
      } else {
        set.add(k);
      }
    }
  }
  for (const child of node.elements ?? []) walk(child);
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
for (const file of files) {
  const doc = JSON.parse(readFileSync(join(DIR, file), "utf8")) as {
    type?: string;
    content?: ElNode[];
  };
  docTypes[doc.type ?? "unknown"] = (docTypes[doc.type ?? "unknown"] ?? 0) + 1;
  for (const el of doc.content ?? []) walk(el);
}

const report = {
  files: files.length,
  docTypes,
  widgetCensus,
  globalKeys: [...globalKeys].sort(),
  dynamicKeys: [...dynamicKeys].sort(),
  settingsByWidget: Object.fromEntries(
    Object.entries(settingsByWidget).map(([w, s]) => [w, [...s].sort()]),
  ),
};

writeFileSync(join(process.cwd(), "fixtures", "analysis.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
