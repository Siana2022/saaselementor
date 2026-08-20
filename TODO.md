# TODO.md — HTML → Elementor SaaS AI

## Estado actual
**MVP end-to-end completo (Pilares 1-5 + UI).** 56 tests verdes · `tsc` · `next build` OK.
Pendiente: afinar mapeos exactos de Elementor con **fixtures reales** del usuario.

---

## Completado

### PASO 1 — Andamiaje y AST  ✅ VALIDADO
- [x] Next.js 16 + TS strict + Tailwind v4 + Zustand/Zod/Vitest.
- [x] `lib/core/ast/types.ts` (AstNode + GlobalSystemAst + ProjectAst).

### PASO 2 — Pilar 1: Global Design System Extractor  ✅ VALIDADO
- [x] `lib/parser/global-system.ts` (CSS → GlobalSystemAst, colores/tipografías).

### PASO 3 — Pilar 2: HTML → AST + Pattern Matching  ✅
- [x] `lib/parser/html-to-ast.ts` (roles, atributos, patrones, html_widget,
      globalRefs, `buildProjectAst` Two-Pass).

### PASO 4 — Pilar 4: Motor de mutaciones  ✅
- [x] `lib/core/mutations.ts` (MutationSchema + applyMutations inmutable).
- [x] `app/api/ai/route.ts` (Claude → JSON Patch validado con Zod).

### PASO 5 — Pilar 5: Compiler & Exporter  ✅ (PROVISIONAL sin fixtures)
- [x] `lib/compiler/elementor-types.ts` (schemas Zod del esquema Elementor).
- [x] `lib/compiler/compile.ts` (Kit + widgets + __globals__ + sub-templates loop).
- [x] `lib/compiler/export-zip.ts` (manifest.json + kit.json + templates/).
- [x] `app/api/export/route.ts` (descarga ZIP).

### PASO 6 — Pilar 3: Visualizador + UI  ✅
- [x] `lib/store/project-store.ts` (Zustand).
- [x] `lib/render/ast-to-html.ts` (srcdoc iframe + selección por postMessage).
- [x] `app/api/ingest/route.ts`.
- [x] `components/` (Ingest, Canvas, Chat, Inspector, Export) + `app/editor`.

---

## Añadido
- [x] Informe de pre-vuelo del export (lib/compiler/report.ts + PreflightPanel): cobertura nativa, censo de widgets, fallbacks, globales y loops, con avisos.

## Pendiente
- [x] Fixtures reales (páginas + Website Kit) + `scripts/analyze-fixture.ts`.
- [x] Kit real: `site-settings.json` (system/custom colors + typography).
- [x] `manifest.json` real (templates + content.page + flags site-settings).
- [x] Documentos kit-internos {content, settings, metadata} en content/page + templates.
- [x] Loop dinámico: loop-grid + loop-item con template_id (rol confirmado).
- [ ] Mapear más widgets nativos (icon-box, nav-menu, form, posts, video, social-icons, nested-carousel).
- [ ] Responsive: emitir variantes _tablet/_mobile en tipografías y estilos.
- [x] Ingesta de ZIP (HTML + <link> CSS externos + imágenes embebidas como data URI).
- [ ] Verificar import real en una instalación Elementor (round-trip).
- [ ] Tests de integración de rutas API; auth / multi-proyecto.
- [ ] `ANTHROPIC_API_KEY` en `.env.local` para el chat IA.
