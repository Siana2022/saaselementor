/**
 * =============================================================================
 *  PILAR 4 — Motor de mutaciones del AST (JSON Patch de la IA)
 * =============================================================================
 *
 * La IA (Claude) recibe un prompt + fragmento del AST + id seleccionado y debe
 * devolver una LISTA de mutaciones tipadas. Aquí se define su schema Zod (para
 * validar la respuesta del modelo) y el aplicador INMUTABLE sobre el AST.
 *
 * Flujo: respuesta IA -> parseMutations() -> applyMutations() -> Zustand -> repintar.
 * =============================================================================
 */

import { z } from "zod";
import {
  AstNodeSchema,
  ProjectAstSchema,
  ElementorRoleSchema,
  StyleMapSchema,
  DynamicMappingSchema,
  GlobalRefsSchema,
  type AstNode,
  type ProjectAst,
} from "./ast/types";

/* -------------------------------------------------------------------------- */
/*  Schema de mutaciones                                                      */
/* -------------------------------------------------------------------------- */

export const MutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("updateRole"), id: z.string(), role: ElementorRoleSchema }),
  z.object({
    action: z.literal("updateStyles"),
    id: z.string(),
    styles: StyleMapSchema,
    /** true (por defecto) = fusiona; false = reemplaza el objeto de estilos. */
    merge: z.boolean().optional(),
  }),
  z.object({ action: z.literal("updateContent"), id: z.string(), content: z.string() }),
  z.object({
    action: z.literal("updateAttributes"),
    id: z.string(),
    attributes: z.record(z.string(), z.string()),
    merge: z.boolean().optional(),
  }),
  z.object({ action: z.literal("addClass"), id: z.string(), className: z.string() }),
  z.object({ action: z.literal("removeClass"), id: z.string(), className: z.string() }),
  z.object({ action: z.literal("setDynamicMapping"), id: z.string(), dynamicMapping: DynamicMappingSchema }),
  z.object({
    action: z.literal("setGlobalRefs"),
    id: z.string(),
    globalRefs: GlobalRefsSchema,
    merge: z.boolean().optional(),
  }),
  z.object({ action: z.literal("removeNode"), id: z.string() }),
]);
export type Mutation = z.infer<typeof MutationSchema>;

export const MutationListSchema = z.array(MutationSchema);
export type MutationList = z.infer<typeof MutationListSchema>;

/** Valida la respuesta de la IA (array de mutaciones). Lanza ZodError si falla. */
export function parseMutations(input: unknown): MutationList {
  return MutationListSchema.parse(input);
}

/* -------------------------------------------------------------------------- */
/*  Aplicación inmutable                                                      */
/* -------------------------------------------------------------------------- */

export interface ApplyResult {
  root: AstNode;
  /** IDs efectivamente afectados por al menos una mutación. */
  appliedIds: string[];
  /** IDs referenciados por mutaciones pero no encontrados en el árbol. */
  missingIds: string[];
}

function indexMutations(mutations: MutationList): Map<string, Mutation[]> {
  const index = new Map<string, Mutation[]>();
  for (const m of mutations) {
    const arr = index.get(m.id);
    if (arr) arr.push(m);
    else index.set(m.id, [m]);
  }
  return index;
}

/** Aplica las mutaciones de campo (no estructurales) sobre una copia del nodo. */
function applyFieldMutations(node: AstNode, mutations: Mutation[]): void {
  for (const m of mutations) {
    switch (m.action) {
      case "updateRole":
        node.elementorRole = m.role;
        break;
      case "updateStyles":
        node.styles = m.merge === false ? { ...m.styles } : { ...node.styles, ...m.styles };
        break;
      case "updateContent":
        node.content = m.content;
        break;
      case "updateAttributes":
        node.attributes =
          m.merge === false ? { ...m.attributes } : { ...node.attributes, ...m.attributes };
        break;
      case "addClass":
        if (!node.classes.includes(m.className)) node.classes = [...node.classes, m.className];
        break;
      case "removeClass":
        node.classes = node.classes.filter((c) => c !== m.className);
        break;
      case "setDynamicMapping":
        node.dynamicMapping = m.dynamicMapping;
        break;
      case "setGlobalRefs":
        node.globalRefs =
          m.merge === false ? { ...m.globalRefs } : { ...node.globalRefs, ...m.globalRefs };
        break;
      case "removeNode":
        // gestionado por el padre (poda estructural).
        break;
    }
  }
}

function applyToNode(
  node: AstNode,
  index: Map<string, Mutation[]>,
  appliedIds: Set<string>,
): AstNode | null {
  const mutations = index.get(node.id) ?? [];
  if (mutations.some((m) => m.action === "removeNode")) {
    appliedIds.add(node.id);
    return null;
  }
  const next: AstNode = { ...node };
  if (mutations.length > 0) {
    applyFieldMutations(next, mutations);
    appliedIds.add(node.id);
  }
  next.children = node.children
    .map((c) => applyToNode(c, index, appliedIds))
    .filter((c): c is AstNode => c !== null);
  return next;
}

/**
 * Aplica una lista de mutaciones a un árbol AST. Devuelve un árbol NUEVO
 * (inmutable) validado contra Zod, más estadísticas de aplicación.
 */
export function applyMutations(root: AstNode, mutations: MutationList): ApplyResult {
  const index = indexMutations(mutations);
  const appliedIds = new Set<string>();
  const result = applyToNode(root, index, appliedIds);
  const root2 = result ?? root;

  const missingIds = [...index.keys()].filter((id) => !appliedIds.has(id));
  return {
    root: AstNodeSchema.parse(root2),
    appliedIds: [...appliedIds],
    missingIds,
  };
}

/** Aplica mutaciones a un ProjectAst completo (a todas las páginas). */
export function applyMutationsToProject(
  project: ProjectAst,
  mutations: MutationList,
): { project: ProjectAst; appliedIds: string[]; missingIds: string[] } {
  const index = indexMutations(mutations);
  const allApplied = new Set<string>();
  const pages = project.pages.map((page) => {
    const applied = new Set<string>();
    const root = applyToNode(page.root, index, applied) ?? page.root;
    for (const id of applied) allApplied.add(id);
    return { ...page, root };
  });
  const parsed = ProjectAstSchema.parse({ ...project, pages });
  const missingIds = [...index.keys()].filter((id) => !allApplied.has(id));
  return { project: parsed, appliedIds: [...allApplied], missingIds };
}
