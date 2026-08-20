/**
 * =============================================================================
 *  Resolver de cascada CSS — estilos COMPUTADOS por elemento
 * =============================================================================
 *
 * Dado el CSS y el DOM (cheerio), calcula los estilos efectivos de cada
 * elemento aplicando: matching de selectores (vía el motor de cheerio),
 * especificidad, orden de origen, `!important` e HERENCIA de propiedades
 * heredables. Base para transferir el diseño real a Elementor.
 *
 * Subset práctico: reglas de nivel superior (ignora @media para la base).
 * =============================================================================
 */

import postcss from "postcss";
import type { CheerioAPI } from "cheerio";
import { isTag, type Element } from "domhandler";
import type { StyleMap } from "@/lib/core/ast/types";

/** Propiedades que heredan de padre a hijo (subset relevante para Elementor). */
const INHERITED = new Set([
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "text-decoration",
  "white-space",
  "list-style",
]);

/** Especificidad simplificada (id, clase/atributo/pseudo-clase, tipo). */
function specificity(selector: string): number {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) ?? []).length;
  const types = (
    selector
      .replace(/[#.][\w-]+/g, " ")
      .replace(/\[[^\]]+\]/g, " ")
      .replace(/::?[\w-]+/g, " ")
      .match(/\b[a-z][\w-]*\b/gi) ?? []
  ).length;
  return ids * 10000 + classes * 100 + types;
}

interface Decl {
  prop: string;
  value: string;
  important: boolean;
}
interface Matched {
  spec: number;
  order: number;
  decls: Decl[];
}

/**
 * Devuelve un Map<Element, StyleMap> con los estilos computados (ya con
 * herencia) de cada elemento del documento.
 */
export function computeStyles($: CheerioAPI, css: string): Map<Element, StyleMap> {
  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return new Map();
  }

  const matches = new Map<Element, Matched[]>();
  let order = 0;

  root.walkRules((rule) => {
    if (rule.parent?.type !== "root") return; // solo base (ignora @media)
    const decls: Decl[] = [];
    rule.walkDecls((d) => {
      // postcss expone `!important` en `d.important` (el valor ya viene limpio).
      decls.push({
        prop: d.prop.toLowerCase(),
        value: d.value.replace(/\s*!important\s*$/i, "").trim(),
        important: d.important === true || /!important/i.test(d.value),
      });
    });
    if (decls.length === 0) return;

    for (const part of rule.selector.split(",").map((s) => s.trim()).filter(Boolean)) {
      const spec = specificity(part);
      const ord = order++;
      let els: Element[];
      try {
        els = $(part).toArray().filter(isTag);
      } catch {
        continue; // selector no soportado por el motor -> se ignora
      }
      for (const el of els) {
        const arr = matches.get(el);
        if (arr) arr.push({ spec, order: ord, decls });
        else matches.set(el, [{ spec, order: ord, decls }]);
      }
    }
  });

  // Estilos propios (sin herencia) resolviendo la cascada por propiedad.
  const own = new Map<Element, StyleMap>();
  for (const [el, rules] of matches) {
    const map: StyleMap = {};
    const score: Record<string, number> = {};
    for (const r of rules) {
      for (const d of r.decls) {
        const s = (d.important ? 1e12 : 0) + r.spec * 1e6 + r.order;
        if (score[d.prop] === undefined || s >= score[d.prop]!) {
          map[d.prop] = d.value;
          score[d.prop] = s;
        }
      }
    }
    own.set(el, map);
  }

  // Herencia: recorrido en profundidad desde los elementos raíz.
  const computed = new Map<Element, StyleMap>();
  const visit = (el: Element, inherited: StyleMap): void => {
    const ownMap = own.get(el) ?? {};
    const merged: StyleMap = {};
    for (const p of INHERITED) if (inherited[p] !== undefined) merged[p] = inherited[p]!;
    Object.assign(merged, ownMap);
    computed.set(el, merged);

    const next: StyleMap = {};
    for (const p of INHERITED) if (merged[p] !== undefined) next[p] = merged[p]!;
    for (const child of el.children) if (isTag(child)) visit(child, next);
  };
  const topLevel = $("*")
    .toArray()
    .filter((n): n is Element => isTag(n) && !(n.parent && isTag(n.parent)));
  for (const el of topLevel) visit(el, {});
  return computed;
}
