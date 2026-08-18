/**
 * =============================================================================
 *  PILAR 1 — Global Design System Extractor (Fase 1 del Two-Pass)
 * =============================================================================
 *
 * Escanea el CSS del proyecto y produce un `GlobalSystemAst`:
 *   - Variables `:root` (custom properties)  -> rootVariables (+ colores).
 *   - Selectores de etiqueta h1-h6 / body / p -> tipografías globales.
 *
 * Dominio: HTML/CSS -> AST. NO conoce el esquema de Elementor. La generación de
 * `elementor-kit.json` a partir de este AST vive en el compiler (Pilar 5), que
 * requiere fixtures reales del Kit.
 *
 * Regla de errores: si el CSS es indescifrable no se lanza excepción; se
 * devuelve un GlobalSystemAst vacío con una nota en `meta.notes`.
 * =============================================================================
 */

import postcss from "postcss";
import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";
import {
  GlobalSystemAstSchema,
  type GlobalSystemAst,
  type GlobalColor,
  type GlobalTypography,
} from "@/lib/core/ast/types";

export interface ExtractGlobalSystemOptions {
  /** Fábrica de IDs; inyectable para tests deterministas. Debe emitir UUIDs. */
  idFactory?: () => string;
}

/** Subconjunto de claves de `GlobalTypography` que provienen de props de fuente. */
type FontTypographyKey =
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "lineHeight"
  | "letterSpacing"
  | "textTransform"
  | "fontStyle"
  | "textDecoration";

/** Propiedad CSS -> clave tipográfica del AST. */
const FONT_PROP_MAP: Record<string, FontTypographyKey> = {
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "line-height": "lineHeight",
  "letter-spacing": "letterSpacing",
  "text-transform": "textTransform",
  "font-style": "fontStyle",
  "text-decoration": "textDecoration",
};

/** Selector de etiqueta -> nombre legible de la tipografía global. */
const TAG_TYPOGRAPHY_NAME: Record<string, string> = {
  h1: "H1",
  h2: "H2",
  h3: "H3",
  h4: "H4",
  h5: "H5",
  h6: "H6",
  body: "Body",
  p: "Paragraph",
};

/** ¿El valor es un color literal (hex / rgb(a) / hsl(a))? */
function isColorValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v) ||
    /^rgba?\(/.test(v) ||
    /^hsla?\(/.test(v)
  );
}

/** Deriva un nombre legible desde el nombre de una custom property. */
function nameFromVariable(varName: string): string {
  const bare = varName.replace(/^--/, "");
  let tokens = bare.split(/[-_]/).filter(Boolean);
  // Elimina ruido "color"/"colour"/"clr" si hay más tokens.
  const filtered = tokens.filter(
    (t) => !["color", "colour", "clr"].includes(t.toLowerCase()),
  );
  if (filtered.length > 0) tokens = filtered;
  if (tokens.length === 0) tokens = [bare];
  return tokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" ");
}

/** Primera familia tipográfica, sin comillas. */
function firstFontFamily(value: string): string {
  const first = value.split(",")[0] ?? value;
  return first.trim().replace(/^["']|["']$/g, "");
}

/** ¿La regla está en el nivel superior (no anidada en @media, etc.)? */
function isTopLevel(rule: postcss.Rule): boolean {
  return rule.parent?.type === "root";
}

/**
 * Extrae el sistema de diseño global a partir de una cadena CSS.
 * El resultado siempre se valida contra `GlobalSystemAstSchema`.
 */
export function extractGlobalSystem(
  css: string,
  opts: ExtractGlobalSystemOptions = {},
): GlobalSystemAst {
  const id = opts.idFactory ?? uuidv4;
  const systemId = id();

  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch (err) {
    return GlobalSystemAstSchema.parse({
      id: systemId,
      colors: [],
      typographies: [],
      meta: { notes: [`CSS no parseable: ${(err as Error).message}`] },
    });
  }

  const rootVariables: Record<string, string> = {};
  // tipografía acumulada por etiqueta (last-wins = cascada CSS).
  const typographyByTag: Record<string, Partial<Record<FontTypographyKey, string>>> = {};

  root.walkRules((rule) => {
    if (!isTopLevel(rule)) return;
    const selectors = rule.selector.split(",").map((s) => s.trim());

    if (selectors.includes(":root")) {
      rule.walkDecls((decl) => {
        if (decl.prop.startsWith("--")) {
          rootVariables[decl.prop] = decl.value.trim();
        }
      });
    }

    for (const sel of selectors) {
      if (!(sel in TAG_TYPOGRAPHY_NAME)) continue;
      rule.walkDecls((decl) => {
        const key = FONT_PROP_MAP[decl.prop];
        if (!key) return;
        (typographyByTag[sel] ??= {})[key] = decl.value.trim();
      });
    }
  });

  // Colores desde variables :root con valor de color (en orden de aparición).
  const colors: GlobalColor[] = [];
  for (const [varName, value] of Object.entries(rootVariables)) {
    if (!isColorValue(value)) continue;
    colors.push({
      id: id(),
      name: nameFromVariable(varName),
      value,
      cssVariable: varName,
      source: "root-variable",
    });
  }

  // Tipografías desde etiquetas.
  const typographies: GlobalTypography[] = Object.entries(typographyByTag).map(
    ([tag, props]) => ({
      id: id(),
      name: TAG_TYPOGRAPHY_NAME[tag] ?? tag,
      selector: tag,
      source: "tag" as const,
      ...props,
    }),
  );

  // meta: familias tipográficas únicas.
  const families = new Set<string>();
  for (const t of typographies) {
    if (t.fontFamily) families.add(firstFontFamily(t.fontFamily));
  }
  const meta =
    families.size > 0 ? { fontFamilies: [...families] } : undefined;

  return GlobalSystemAstSchema.parse({
    id: systemId,
    colors,
    typographies,
    rootVariables:
      Object.keys(rootVariables).length > 0 ? rootVariables : undefined,
    meta,
  });
}

/**
 * Concatena el CSS de todos los `<style>` de un documento HTML.
 * Punto de entrada práctico para la ingesta (los `<link>` externos se
 * resolverán en la capa de ingesta de ZIP más adelante).
 */
export function collectStyleCss(html: string): string {
  const $ = cheerio.load(html);
  const parts: string[] = [];
  $("style").each((_, el) => {
    parts.push($(el).text());
  });
  return parts.join("\n");
}
