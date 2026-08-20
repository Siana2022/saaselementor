/**
 * =============================================================================
 *  PILAR 5 — Style Map: estilos computados (CSS) -> settings de Elementor
 * =============================================================================
 *
 * Traduce el StyleMap de un AstNode a fragmentos de `settings` de Elementor,
 * con las claves reales observadas en fixtures (typography_*, *_color,
 * background_*, padding/margin dimension, flex_*, border_radius).
 * =============================================================================
 */

import type { StyleMap } from "@/lib/core/ast/types";
import type { ElementorSettings } from "./elementor-types";

export interface Len {
  unit: string;
  size: number;
  sizes: number[];
}

export function firstFamily(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const first = value.split(",")[0] ?? value;
  const clean = first.trim().replace(/^["']|["']$/g, "");
  return clean || undefined;
}

/**
 * Parsea una longitud CSS a {unit,size,sizes}. Tolera valores complejos
 * (`clamp()`, `calc()`, min/max): extrae la mayor longitud px-equivalente
 * (rem/em ≈ 16px), útil para el tamaño de escritorio de tipografías fluidas.
 * `defaultUnit` se usa para valores sin unidad (p. ej. line-height).
 */
export function parseLen(value: string | undefined, defaultUnit = "px"): Len | undefined {
  if (!value) return undefined;
  const v = value.trim();
  const simple = v.match(/^(-?[\d.]+)(px|em|rem|%|vw|vh|pt)?$/);
  if (simple && simple[1] !== undefined) {
    const size = Number.parseFloat(simple[1]);
    if (!Number.isNaN(size)) return { unit: simple[2] ?? defaultUnit, size, sizes: [] };
  }
  // Valor complejo (clamp/calc/…): toma la mayor longitud absoluta en px.
  const tokens = [...v.matchAll(/(-?[\d.]+)(px|rem|em)/g)];
  let best = -Infinity;
  for (const t of tokens) {
    const n = Number.parseFloat(t[1]!);
    if (Number.isNaN(n)) continue;
    const px = t[2] === "px" ? n : n * 16;
    if (px > best) best = px;
  }
  if (best > -Infinity) return { unit: "px", size: Math.round(best * 100) / 100, sizes: [] };
  return undefined;
}

interface Dimension {
  unit: string;
  top: string;
  right: string;
  bottom: string;
  left: string;
  isLinked: boolean;
}

/** Parsea un shorthand (padding/margin/border-radius) a dimension de Elementor. */
export function parseFourSides(value: string | undefined): Dimension | undefined {
  if (!value) return undefined;
  const tokens = value.trim().split(/\s+/);
  if (tokens.length === 0 || tokens.length > 4) return undefined;
  if (tokens.some((t) => /auto|inherit|initial/.test(t))) return undefined;

  const parsed = tokens.map((t) => t.match(/^(-?[\d.]+)(px|em|rem|%|vw|vh|pt)?$/));
  if (parsed.some((p) => p === null)) return undefined;
  const nums = parsed.map((p) => p![1]!);
  const unit = parsed[0]![2] ?? "px";

  let top: string, right: string, bottom: string, left: string;
  if (nums.length === 1) [top, right, bottom, left] = [nums[0]!, nums[0]!, nums[0]!, nums[0]!];
  else if (nums.length === 2) [top, right, bottom, left] = [nums[0]!, nums[1]!, nums[0]!, nums[1]!];
  else if (nums.length === 3) [top, right, bottom, left] = [nums[0]!, nums[1]!, nums[2]!, nums[1]!];
  else [top, right, bottom, left] = [nums[0]!, nums[1]!, nums[2]!, nums[3]!];

  const isLinked = top === right && right === bottom && bottom === left;
  return { unit, top, right, bottom, left, isLinked };
}

/** Ajustes de tipografía + alineación desde los estilos. */
export function typographySettings(styles: StyleMap): ElementorSettings {
  const out: ElementorSettings = {};
  const family = firstFamily(styles["font-family"]);
  const size = parseLen(styles["font-size"]);
  const weight = styles["font-weight"];
  const lineHeight = parseLen(styles["line-height"], "em");
  const spacing = parseLen(styles["letter-spacing"]);
  const transform = styles["text-transform"];

  if (family || size || weight || lineHeight || spacing || transform) {
    out.typography_typography = "custom";
    if (family) out.typography_font_family = family;
    if (size) out.typography_font_size = size;
    if (weight && weight !== "normal") out.typography_font_weight = weight;
    if (lineHeight) out.typography_line_height = lineHeight;
    if (spacing) out.typography_letter_spacing = spacing;
    if (transform && transform !== "none") out.typography_text_transform = transform;
  }
  const align = styles["text-align"];
  if (align && ["left", "center", "right", "justify"].includes(align)) out.align = align;
  return out;
}

/** Color de fondo (desde background-color o el shorthand background). */
function backgroundColor(styles: StyleMap): string | undefined {
  const bc = styles["background-color"];
  if (bc && bc !== "transparent") return bc;
  const bg = styles["background"];
  if (bg) {
    const m = bg.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/);
    if (m) return m[0];
  }
  return undefined;
}

/** Ajustes de fondo "classic" (para containers). */
export function backgroundSettings(styles: StyleMap): ElementorSettings {
  const color = backgroundColor(styles);
  if (!color) return {};
  return { background_background: "classic", background_color: color };
}

/** URL de imagen de fondo desde `background-image` o el shorthand `background`. */
function backgroundImageUrl(styles: StyleMap): string | undefined {
  const src = styles["background-image"] ?? styles["background"];
  if (!src) return undefined;
  const m = src.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
  return m?.[1];
}

/** Ajustes de imagen de fondo "classic" (containers con background-image). */
export function backgroundImageSettings(styles: StyleMap): ElementorSettings {
  const url = backgroundImageUrl(styles);
  if (!url) return {};
  return {
    background_background: "classic",
    background_image: { url, id: "", alt: "", source: "url", size: "" },
    background_position: styles["background-position"] ?? "center center",
    background_repeat: styles["background-repeat"] ?? "no-repeat",
    background_size: styles["background-size"] ?? "cover",
  };
}

/** Espaciado (padding/margin) con prefijo "" (container) o "_" (widget). */
export function spacingSettings(styles: StyleMap, prefix: "" | "_"): ElementorSettings {
  const out: ElementorSettings = {};
  const padding = parseFourSides(styles["padding"]);
  const margin = parseFourSides(styles["margin"]);
  if (padding) out[`${prefix}padding`] = padding;
  if (margin) out[`${prefix}margin`] = margin;
  return out;
}

/** border-radius a la clave indicada. */
export function borderRadiusSetting(styles: StyleMap, key: string): ElementorSettings {
  const br = parseFourSides(styles["border-radius"]);
  return br ? { [key]: br } : {};
}

/** Ajustes de container flexbox desde display/flex-* (grid -> row + wrap). */
export function flexSettings(styles: StyleMap): ElementorSettings {
  const out: ElementorSettings = {};
  const display = styles["display"];
  const isFlex = display === "flex" || display === "inline-flex";
  const isGrid = display === "grid" || display === "inline-grid";
  if (!isFlex && !isGrid) return out;

  if (isGrid) {
    // La receta: reproducir grids con flex row + wrap (evita claves de grid).
    out.flex_direction = "row";
    out.flex_wrap = "wrap";
  } else {
    const dir = styles["flex-direction"];
    out.flex_direction = dir === "column" ? "column" : "row";
    if (styles["flex-wrap"] === "wrap") out.flex_wrap = "wrap";
  }

  const justify = styles["justify-content"];
  if (justify) out.flex_justify_content = justify;
  const align = styles["align-items"];
  if (align) out.flex_align_items = align;

  const gap = parseLen(styles["gap"] ?? styles["grid-gap"] ?? styles["column-gap"]);
  if (gap) {
    out.flex_gap = { ...gap, column: String(gap.size), row: String(gap.size), isLinked: true };
  }
  return out;
}

/**
 * Ancho de un container hijo. Clave para que las filas flex no colapsen:
 * un hijo sin ancho vale 100% por defecto y rompe `space-between`.
 *   - %  -> width en %
 *   - px -> width en px + flex_grow:0/flex_shrink:0 (panel fijo)
 *   - fit-content -> width unidad custom
 */
export function widthSettings(styles: StyleMap): ElementorSettings {
  const w = styles["width"];
  if (!w) return {};
  const v = w.trim();
  if (/fit-content|max-content|min-content/.test(v)) {
    return { width: { unit: "custom", size: "fit-content", sizes: [] }, _flex_grow: 0 };
  }
  const m = v.match(/^(-?[\d.]+)(px|%|rem|em|vw|vh)$/);
  if (!m || m[1] === undefined) return {};
  const size = Number.parseFloat(m[1]);
  if (Number.isNaN(size)) return {};
  if (m[2] === "%") {
    return { width: { unit: "%", size, sizes: [] } };
  }
  const px = m[2] === "rem" || m[2] === "em" ? size * 16 : size;
  return { width: { unit: "px", size: px, sizes: [] }, flex_grow: 0, flex_shrink: 0 };
}
