/**
 * =============================================================================
 *  Globales por USO — deriva el sistema de diseño desde los estilos computados
 * =============================================================================
 *
 * Los sitios modernos estilizan por CLASES, no con variables :root ni etiquetas
 * h1-h6. Este módulo analiza la FRECUENCIA de colores y tipografías realmente
 * usados en el AST y:
 *   1) crea GlobalColor / GlobalTypography (rellena el Kit), y
 *   2) enlaza `globalRefs` en cada nodo cuyo estilo coincide con un global.
 *
 * Se combina con los globales derivados de :root (extractGlobalSystem).
 * =============================================================================
 */

import type {
  AstNode,
  GlobalColor,
  GlobalSystemAst,
  GlobalTypography,
} from "@/lib/core/ast/types";

const MAX_COLORS = 12;
const MAX_TYPOGRAPHIES = 10;

function isColor(v: string): boolean {
  const s = v.trim().toLowerCase();
  return (
    /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(s) ||
    /^rgba?\(/.test(s) ||
    /^hsla?\(/.test(s)
  );
}

/** Normaliza un color para comparación (hex corto -> largo, minúsculas). */
function normColor(v: string): string {
  let s = v.trim().toLowerCase();
  const hex = s.match(/^#([0-9a-f]{3,4})$/);
  if (hex && hex[1]) {
    s = "#" + hex[1].split("").map((c) => c + c).join("");
  }
  return s.replace(/\s+/g, "");
}

function bgColorOf(styles: Record<string, string>): string | undefined {
  const bc = styles["background-color"];
  if (bc && bc !== "transparent" && isColor(bc)) return bc;
  const bg = styles["background"];
  if (bg) {
    const m = bg.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/);
    if (m && isColor(m[0])) return m[0];
  }
  return undefined;
}

function typoKey(s: Record<string, string>): string | null {
  const family = s["font-family"];
  const size = s["font-size"];
  if (!family && !size) return null;
  return [
    family ?? "",
    size ?? "",
    s["font-weight"] ?? "",
    s["line-height"] ?? "",
    s["letter-spacing"] ?? "",
    s["text-transform"] ?? "",
  ].join("|");
}

function forEachNode(node: AstNode, fn: (n: AstNode) => void): void {
  fn(node);
  for (const c of node.children) forEachNode(c, fn);
}

/**
 * Deriva globales (colores + tipografías) por frecuencia de uso y los fusiona
 * con los ya existentes (p. ej. de :root). Devuelve un nuevo GlobalSystemAst.
 */
export function deriveGlobalsFromUsage(
  root: AstNode,
  existing: GlobalSystemAst,
  idFactory: () => string,
): GlobalSystemAst {
  // --- Colores ---
  const colorFreq = new Map<string, { value: string; count: number }>();
  const bump = (map: Map<string, { value: string; count: number }>, key: string, value: string) => {
    const e = map.get(key);
    if (e) e.count += 1;
    else map.set(key, { value, count: 1 });
  };

  const typoFreq = new Map<string, { sample: AstNode; count: number }>();

  forEachNode(root, (n) => {
    if (n.nodeType !== "element") return;
    const c = n.styles["color"];
    if (c && isColor(c)) bump(colorFreq, normColor(c), c);
    const bg = bgColorOf(n.styles);
    if (bg) bump(colorFreq, normColor(bg), bg);
    const tk = typoKey(n.styles);
    if (tk) {
      const e = typoFreq.get(tk);
      if (e) e.count += 1;
      else typoFreq.set(tk, { sample: n, count: 1 });
    }
  });

  const existingColorNorms = new Set(existing.colors.map((c) => normColor(c.value)));
  const newColors: GlobalColor[] = [...colorFreq.values()]
    .filter((c) => !existingColorNorms.has(normColor(c.value)))
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(0, MAX_COLORS - existing.colors.length))
    .map((c, i) => ({
      id: idFactory(),
      name: `Color ${existing.colors.length + i + 1}`,
      value: c.value,
      source: "inferred" as const,
    }));

  // --- Tipografías ---
  const existingTypoKeys = new Set(
    existing.typographies.map((t) =>
      [
        t.fontFamily ?? "",
        t.fontSize ?? "",
        t.fontWeight ?? "",
        t.lineHeight ?? "",
        t.letterSpacing ?? "",
        t.textTransform ?? "",
      ].join("|"),
    ),
  );
  const newTypos: GlobalTypography[] = [...typoFreq.entries()]
    .filter(([key]) => !existingTypoKeys.has(key))
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, Math.max(0, MAX_TYPOGRAPHIES - existing.typographies.length))
    .map(([, { sample }], i) => {
      const s = sample.styles;
      return {
        id: idFactory(),
        name: `Estilo ${existing.typographies.length + i + 1}`,
        ...(s["font-family"] ? { fontFamily: s["font-family"] } : {}),
        ...(s["font-size"] ? { fontSize: s["font-size"] } : {}),
        ...(s["font-weight"] ? { fontWeight: s["font-weight"] } : {}),
        ...(s["line-height"] ? { lineHeight: s["line-height"] } : {}),
        ...(s["letter-spacing"] ? { letterSpacing: s["letter-spacing"] } : {}),
        ...(s["text-transform"] ? { textTransform: s["text-transform"] } : {}),
        source: "inferred" as const,
      };
    });

  return {
    ...existing,
    colors: [...existing.colors, ...newColors],
    typographies: [...existing.typographies, ...newTypos],
  };
}

/** Enlaza `globalRefs` de cada nodo contra el GlobalSystemAst (color/bg/typo). */
export function linkGlobalRefs(root: AstNode, gs: GlobalSystemAst): void {
  const colorByNorm = new Map<string, string>();
  const colorByVar = new Map<string, string>();
  for (const c of gs.colors) {
    colorByNorm.set(normColor(c.value), c.id);
    if (c.cssVariable) colorByVar.set(c.cssVariable, c.id);
  }
  const typoById = new Map<string, string>();
  for (const t of gs.typographies) {
    const key = [
      t.fontFamily ?? "",
      t.fontSize ?? "",
      t.fontWeight ?? "",
      t.lineHeight ?? "",
      t.letterSpacing ?? "",
      t.textTransform ?? "",
    ].join("|");
    typoById.set(key, t.id);
  }

  const resolveColor = (value: string): string | undefined => {
    const varMatch = value.match(/var\(\s*(--[\w-]+)\s*\)/);
    if (varMatch && varMatch[1] && colorByVar.has(varMatch[1])) return colorByVar.get(varMatch[1]);
    if (isColor(value)) return colorByNorm.get(normColor(value));
    return undefined;
  };

  forEachNode(root, (n) => {
    if (n.nodeType !== "element") return;
    const refs: Record<string, string> = { ...(n.globalRefs ?? {}) };

    const c = n.styles["color"];
    if (c) {
      const id = resolveColor(c);
      if (id) refs.color = id;
    }
    const bg = bgColorOf(n.styles);
    if (bg) {
      const id = resolveColor(bg);
      if (id) refs.backgroundColor = id;
    }
    const tk = typoKey(n.styles);
    if (tk && typoById.has(tk)) refs.typography = typoById.get(tk)!;

    if (Object.keys(refs).length > 0) n.globalRefs = refs;
  });
}
