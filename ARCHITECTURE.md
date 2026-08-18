# ARCHITECTURE.md — HTML → Elementor SaaS AI

Documento vivo de decisiones técnicas. Se actualiza en cada hito.

## 1. Visión

Plataforma SaaS que ingiere un diseño web estático (HTML/CSS o ZIP), lo
renderiza en un lienzo interactivo, permite editarlo mediante un chat de IA y
lo exporta como un **Elementor Template Kit (.zip)** estructuralmente válido y
100% compatible con el importador de Elementor Pro / Site Kits.

No es un traductor de etiquetas: infiere **lógica de datos** (Repeaters, Loops,
Dynamic Tags) y **sistemas de diseño globales** (Kits) a partir de código
estático.

## 2. Stack

| Área              | Tecnología                                   |
| ----------------- | -------------------------------------------- |
| Core              | Next.js 16 (App Router), React 19, TS 6 strict |
| Estado            | Zustand (AST global en tiempo real)          |
| Estilos UI        | Tailwind CSS v4                              |
| Sandbox diseño    | `<iframe sandbox>` con CSS original aislado   |
| Parsing DOM (srv) | cheerio / jsdom                              |
| IA                | Anthropic Claude API                        |
| Validación        | Zod v4 (tipa el AST y el JSON de Elementor)  |
| Tests             | Vitest 4 (entorno jsdom)                     |

## 3. Regla de oro

**Nadie toca directamente el HTML ni el JSON de Elementor. Todo pasa por el AST.**

```
HTML/CSS  ──(Pilar 2: Parser)──▶  AST  ──(Pilar 5: Compiler)──▶  Elementor JSON/ZIP
                                   ▲
                                   │ (Pilar 4: mutaciones IA vía JSON Patch)
```

## 4. Separación estricta de dominios

- `lib/core/ast/`        → modelo de datos (schemas Zod + tipos). **Sin lógica.**
- `lib/parser/` (futuro) → HTML → AST (cheerio/jsdom, pattern matching).
- `lib/compiler/` (futuro) → AST → Elementor (schema propietario + ZIP).
- `lib/ai/` (futuro)     → orquestación Claude + validación de mutaciones.

La lógica HTML→AST y la lógica AST→Elementor **nunca** se mezclan.

## 5. El AST (modelo de datos)

Ver `lib/core/ast/types.ts` (fuente de verdad). Resumen:

### 5.1 `AstNode`
| Campo            | Descripción                                                    |
| ---------------- | -------------------------------------------------------------- |
| `id`             | UUID interno del sistema (≠ atributo `id` del HTML).           |
| `nodeType`       | `"element"` \| `"text"` (convención tipo DOM).                 |
| `tagName`        | Etiqueta original (`div`, `p`, `img`) o `"#text"`.             |
| `classes`        | Array de clases CSS.                                           |
| `attributes`     | Atributos HTML (href, src, alt, data-*, aria-*).              |
| `styles`         | CSS base (desktop): computado + inline.                       |
| `responsive`     | Overrides `tablet` / `mobile`.                                 |
| `hoverStyles`    | Estilos de estado `:hover`.                                    |
| `children`       | Nodos hijos (recursivo).                                       |
| `content`        | Texto (nodos de texto o texto directo).                       |
| `elementorRole`  | Rol inferido/confirmado (ver 5.2).                            |
| `dynamicMapping` | Binding a Dynamic Tags de Elementor.                          |
| `globalRefs`     | Mapea propiedades de estilo → IDs del `GlobalSystemAst`.       |
| `patternMeta`    | Metadatos de patrón repetido (en el nodo padre).             |
| `isTemplate`     | Marca a un hijo como plantilla del loop/repeater.             |
| `rawHtml`        | HTML crudo (obligatorio si `elementorRole === "html_widget"`).|

### 5.2 `elementorRole`
- **Estructura:** `container`.
- **Widgets:** `heading`, `text`, `image`, `button`, `link`, `icon`, `icon_box`,
  `video`, `list`, `divider`, `spacer`, `form`, `input`.
- **Patrones dinámicos:** `repeater_candidate`, `loop_candidate` (heurística del
  parser) → se confirman como `repeater`, `loop_grid`, con `loop_item_template`
  para el hijo plantilla.
- **Fallback:** `html_widget` (inyección de HTML crudo), `unknown`.

### 5.3 `GlobalSystemAst` (Pilar 1)
Sistema de diseño global extraído en Fase 1. Genera `elementor-kit.json`.
- `colors: GlobalColor[]`         → cada uno con UUID, referenciado por
  `globalRefs` y compilado como `globals/colors?id=<id>`.
- `typographies: GlobalTypography[]` → tipografías globales (H1..H6, Body...).
- `rootVariables`                 → custom properties `:root` verbatim.

### 5.4 Raíz: `ProjectAst`
Combina `globalSystem` (Fase 1) + `pages: PageAst[]` (Fase 2). Es lo que vive en
Zustand y lo que consume el compilador. Incluye `schemaVersion` para migraciones.

## 6. Los 5 Pilares (Two-Pass Compilation)

1. **Global Design System Extractor (Fase 1):** escanea CSS (`:root`, `h1-h6`,
   clases globales), genera `GlobalSystemAst` + UUIDs → `elementor-kit.json`.
2. **Ingesta + Pattern Matching (Fase 2):** HTML → AST base. Si un contenedor
   tiene ≥3 hijos con estructura idéntica → `loop_candidate`/`repeater_candidate`
   y los hijos se preparan como plantillas.
3. **Visualizador en tiempo real:** AST (Zustand) → `<iframe sandbox>`. Clic en
   un elemento envía su `id` al panel de chat para dar contexto.
4. **AI Chat Controller:** Claude recibe prompt + fragmento del AST + id
   seleccionado, y devuelve un **JSON Patch validado con Zod**
   (ej. `[{ action: "updateRole", id, role: "loop_grid" }]`). Zustand aplica y
   el iframe se repinta.
5. **Compiler & Exporter:** AST → schema propietario de Elementor. Los widgets
   apuntan a los IDs del Kit (no hardcodean estilos). Exporta `.zip` con
   `manifest.json`, `kit.json` y `/templates/` (página + sub-templates de loops).

## 7. Reglas de desarrollo

1. **Ingeniería inversa con Fixtures:** nunca inventar la estructura JSON de
   Elementor. Por cada widget/kit soportado se parte de un `.json` real
   exportado (`fixtures/`), analizado con `scripts/analyze-fixture.ts` para
   derivar los schemas Zod.
2. **HTML Fallback:** CSS/JS indescifrable (sliders, scripts) → nodo envuelto en
   `elementorRole: "html_widget"` con `rawHtml`, para no romper el diseño.
3. **Separación de dominios:** HTML→AST y AST→Elementor estrictamente separados.

## 8. Workflow del agente

- **Documentación viva:** este archivo + `TODO.md`, actualizados por hito.
- **TDD obligatorio:** Vitest. Tests para AST (HTML→AST) y para el Compiler
  (AST→Elementor JSON exacto).
- **Commits atómicos:** pequeños y descriptivos por función/test/hito.

## 9. Decisiones registradas

- **2026-08-18** — Andamiaje inicial. Stack fijado en versiones actuales
  (Next 16, React 19, Tailwind v4, Zod v4, Vitest 4). `types.ts` como primera
  fuente de verdad del AST; se enriqueció el contrato mínimo con: `attributes`,
  `responsive`/`hoverStyles`, `nodeType`, `patternMeta`/`isTemplate`, `rawHtml`,
  y un envoltorio `PageAst`/`ProjectAst`. `dynamicMapping` pasó de `string` a un
  objeto `{ tag, token, settings }` (superset del ejemplo `[post_title]`).
  Config de Vitest en `.mts` (ESM). **Pendiente: validación de `types.ts`.**
