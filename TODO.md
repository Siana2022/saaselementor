# TODO.md — HTML → Elementor SaaS AI

## Estado actual
**FASE: PASO 1 — Andamiaje + diseño del AST.**
⏸️ **BLOQUEADO esperando validación del usuario sobre `lib/core/ast/types.ts`.**
(Instrucción explícita: detenerse antes de desarrollar los parsers.)

---

## PASO 1 — Andamiaje y AST  ✅ (a la espera de validación)
- [x] Inicializar repositorio git (branch `main`).
- [x] Base Next.js 16 (App Router) + TypeScript 6 strict + Tailwind v4.
- [x] Instalar Zustand, Zod, Vitest (+ cheerio, jsdom, @anthropic-ai/sdk, uuid).
- [x] Configurar Vitest (entorno jsdom, alias `@`).
- [x] `ARCHITECTURE.md` y `TODO.md`.
- [x] `lib/core/ast/types.ts` — AST (nodo + `GlobalSystemAst` + `ProjectAst`)
      con Zod + TS: `elementorRole`, pattern matching, `dynamicMapping`,
      `globalRefs`.
- [x] Tests de humo del AST (8 tests, verdes).
- [x] `next build` y `tsc --noEmit` verdes.
- [ ] ⏳ **VALIDACIÓN DEL USUARIO sobre `types.ts`.**

---

## Próximas fases (no iniciar hasta validar el PASO 1)

### PASO 2 — Fixtures & schemas de Elementor (ingeniería inversa)
- [ ] Definir estructura `fixtures/` (kit + widgets reales exportados).
- [ ] `scripts/analyze-fixture.ts` → deriva schemas Zod desde JSON real.
- [ ] Schemas Zod del esquema propietario de Elementor (widget, section, kit).

### PASO 3 — Pilar 1: Global Design System Extractor
- [ ] Parser de CSS (`:root`, `h1-h6`, clases globales) → `GlobalSystemAst`.
- [ ] Generación de `elementor-kit.json`.
- [ ] Tests: CSS de entrada → GlobalSystemAst esperado.

### PASO 4 — Pilar 2: Ingesta de páginas + Pattern Matching
- [ ] `lib/parser/` HTML → AST base (cheerio/jsdom).
- [ ] Inferencia de `elementorRole`.
- [ ] Pattern matching (≥3 hijos idénticos → loop/repeater candidate).
- [ ] Fallback `html_widget` para estructuras indescifrables.
- [ ] Tests: fixtures HTML → AST esperado.

### PASO 5 — Pilar 3: Visualizador en tiempo real
- [ ] Store Zustand del `ProjectAst`.
- [ ] Render del AST en `<iframe sandbox>`.
- [ ] Selección de elementos → envía `id` al panel de chat.

### PASO 6 — Pilar 4: AI Chat Controller
- [ ] Schema Zod de mutaciones (JSON Patch: updateRole, updateStyle, ...).
- [ ] Endpoint/route Claude API (prompt + fragmento AST + id).
- [ ] Aplicación de mutaciones validadas → Zustand → repintado.
- [ ] Tests: mutación → AST resultante.

### PASO 7 — Pilar 5: Compiler & Exporter
- [ ] AST → JSON de Elementor (referencias a globals del Kit).
- [ ] Empaquetado ZIP: `manifest.json` + `kit.json` + `/templates/`.
- [ ] Sub-templates de loops.
- [ ] Tests: AST → JSON Elementor exacto (contra fixtures).

### Transversal
- [ ] Ingesta de ZIP (subida de proyecto HTML/CSS).
- [ ] UI del SaaS (lienzo + chat).
- [ ] Autenticación / multi-proyecto (si aplica).
