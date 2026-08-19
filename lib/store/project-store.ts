/**
 * =============================================================================
 *  PILAR 3 (b) — Store global (Zustand) del ProjectAst
 * =============================================================================
 *
 * Fuente de verdad en tiempo real del AST. El visualizador lo renderiza y el
 * AI Chat Controller (Pilar 4) aplica mutaciones que repintan el iframe.
 * =============================================================================
 */

import { create } from "zustand";
import type { AstNode, ProjectAst } from "@/lib/core/ast/types";
import { applyMutationsToProject, type MutationList } from "@/lib/core/mutations";

/** Busca un nodo por id en un árbol. */
export function findNodeById(root: AstNode, id: string): AstNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export interface ProjectStore {
  project: ProjectAst | null;
  /** CSS original (para fidelidad del preview en el iframe). */
  css: string;
  selectedId: string | null;

  setProject: (project: ProjectAst, css?: string) => void;
  selectNode: (id: string | null) => void;
  getSelectedNode: () => AstNode | null;
  applyPatch: (mutations: MutationList) => { appliedIds: string[]; missingIds: string[] };
  reset: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  css: "",
  selectedId: null,

  setProject: (project, css = "") => set({ project, css, selectedId: null }),

  selectNode: (id) => set({ selectedId: id }),

  getSelectedNode: () => {
    const { project, selectedId } = get();
    if (!project || !selectedId) return null;
    for (const page of project.pages) {
      const node = findNodeById(page.root, selectedId);
      if (node) return node;
    }
    return null;
  },

  applyPatch: (mutations) => {
    const { project } = get();
    if (!project) return { appliedIds: [], missingIds: [] };
    const { project: next, appliedIds, missingIds } = applyMutationsToProject(project, mutations);
    set({ project: next });
    return { appliedIds, missingIds };
  },

  reset: () => set({ project: null, css: "", selectedId: null }),
}));
