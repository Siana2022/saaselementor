# TODO.md — HTML → Elementor SaaS AI

## Estado actual
**FASE: PASO 2 — Pilar 1: Global Design System Extractor.**
⏸️ **BLOQUEADO esperando validación del usuario sobre el extractor.**

> Nota de orden: los fixtures/schemas de Elementor se han movido a la fase del
> Compiler (Pilar 5), porque solo son necesarios para la salida AST→Elementor y
> requieren JSON reales que aportará el usuario. Las fases HTML/CSS→AST (Pilares
> 1 y 2) no los necesitan y avanzan primero.

---

## PASO 1 — Andamiaje y AST  ✅ VALIDADO
- [x] Repo git + Next.js 16 (App Router) + TS 6 strict + Tailwind v4.
- [x] Zustand, Zod v4, Vitest (+ cheerio, jsdom, @anthropic-ai/sdk, uuid).
- [x] `lib/core/ast/types.ts` (AstNode + GlobalSystemAst + ProjectAst).
- [x] Tests de humo (8) + `ARCHITECTURE.md` + `TODO.md`.
- [x] **Validado por el usuario.**

## PASO 2 — Pilar 1: Global Design System Extractor  ✅ (a la espera de validación)
- [x] `lib/parser/global-system.ts`: `extractGlobalSystem(css)` → `GlobalSystemAst`.
  - [x] Variables `:root` → `rootVariables` (+ `GlobalColor` si son color).
  - [x] Derivación de nombres de color desde la custom property.
  - [x] Tipografías desde h1-h6 / body / p (cascada last-wins, ignora @media).
  - [x] `meta.fontFamilies` (familias únicas).
  - [x] Tolerancia a CSS roto (nota en `meta.notes`, sin excepción).
  - [x] `collectStyleCss(html)` para reunir el CSS de los `<style>`.
- [x] Tests (11) verdes; `tsc` + salida validada contra Zod.
- [ ] ⏳ **VALIDACIÓN DEL USUARIO.**

---

## Próximas fases (no iniciar hasta validar el PASO 2)

### PASO 3 — Pilar 2: Ingesta de páginas + Pattern Matching
- [ ] `lib/parser/html-to-ast.ts` HTML → AST base (cheerio/jsdom).
- [ ] Inferencia de `elementorRole` por etiqueta/heurística.
- [ ] Enlace de `globalRefs` contra el `GlobalSystemAst` (Fase 1).
- [ ] Pattern matching (≥3 hijos idénticos → loop/repeater candidate + plantilla).
- [ ] Fallback `html_widget` (+ `rawHtml`) para estructuras indescifrables.
- [ ] Tests: fixtures HTML → AST esperado.

### PASO 4 — Pilar 3: Visualizador en tiempo real
- [ ] Store Zustand del `ProjectAst`.
- [ ] Render del AST en `<iframe sandbox>`.
- [ ] Selección de elementos → envía `id` al panel de chat.

### PASO 5 — Pilar 4: AI Chat Controller
- [ ] Schema Zod de mutaciones (JSON Patch: updateRole, updateStyle, ...).
- [ ] Route Claude API (prompt + fragmento AST + id).
- [ ] Aplicar mutaciones validadas → Zustand → repintado.
- [ ] Tests: mutación → AST resultante.

### PASO 6 — Fixtures + Pilar 5: Compiler & Exporter
- [ ] **(Requiere fixtures del usuario)** `fixtures/` con kit + widgets reales.
- [ ] `scripts/analyze-fixture.ts` → derivar schemas Zod de Elementor.
- [ ] AST → JSON de Elementor (widgets apuntan a globals del Kit).
- [ ] `GlobalSystemAst` → `elementor-kit.json`.
- [ ] Empaquetado ZIP: `manifest.json` + `kit.json` + `/templates/` (+ loops).
- [ ] Tests: AST → JSON Elementor exacto (contra fixtures).

### Transversal
- [ ] Ingesta de ZIP (subida HTML/CSS + `<link>` externos).
- [ ] UI del SaaS (lienzo + chat).
- [ ] Autenticación / multi-proyecto (si aplica).
