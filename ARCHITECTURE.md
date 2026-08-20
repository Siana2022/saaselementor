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
  Config de Vitest en `.mts` (ESM). **`types.ts` VALIDADO por el usuario.**
- **2026-08-18** — Pilar 1 (Global Design System Extractor):
  `lib/parser/global-system.ts` con `extractGlobalSystem(css)` →
  `GlobalSystemAst` (colores desde vars `:root`, tipografías desde h1-h6/body/p,
  cascada last-wins, ignora `@media` para la base, tolerante a CSS roto). Se usa
  `postcss` (movido a dependencies) para parsear CSS y `cheerio` para
  `collectStyleCss`. IDs inyectables (`idFactory`) para tests deterministas; la
  salida se valida contra `GlobalSystemAstSchema`. Reordenado el plan: los
  fixtures/schemas de Elementor se posponen a la fase del Compiler (Pilar 5),
  que sí requiere JSON reales. **Pendiente: validación del extractor.**

## 10. Estado del MVP (2026-08-19)

Pipeline end-to-end funcionando: Ingesta → AST (Two-Pass) → Visualizador iframe →
Chat IA (mutaciones) → Export ZIP. Módulos:

```
lib/core/ast/types.ts        Modelo de datos (AST)                [Pilar base]
lib/parser/global-system.ts  CSS -> GlobalSystemAst               [Pilar 1]
lib/parser/html-to-ast.ts    HTML -> AST + pattern matching       [Pilar 2]
lib/render/ast-to-html.ts    AST -> srcdoc iframe                 [Pilar 3]
lib/store/project-store.ts   Estado global (Zustand)              [Pilar 3]
lib/core/mutations.ts        JSON Patch IA + aplicación inmutable [Pilar 4]
lib/compiler/*               AST -> Elementor JSON + ZIP          [Pilar 5]
app/api/{ingest,ai,export}   Rutas server-side (Node runtime)
app/editor + components/*    UI del SaaS (lienzo + chat + export)
```

Cobertura: 56 tests (Vitest). `tsc --noEmit` y `next build` en verde.

**Deuda técnica consciente (por regla de fixtures):** el esquema exacto de los
widgets de Elementor, el `manifest.json` y el `kit.json` son PROVISIONALES;
se validarán/afinarán con JSON reales exportados. El fallback `html_widget`
garantiza que ningún nodo rompa la importación mientras tanto.

## 11. Validación con fixtures reales (2026-08-19)

Se incorporaron 6 exports REALES de Elementor a `fixtures/pages/` (page, header,
footer, archive, loop-item, popup) y se creó `scripts/analyze-fixture.ts`
(`npm run analyze:fixtures`) que cataloga tipos de documento, censo de widgets y
claves de `settings` (salida en `fixtures/analysis.json`).

**Hallazgos que CONFIRMAN el diseño del compiler:**
- Documento: `{content, page_settings, version:"0.4", title, type}`. `page_settings`
  es `[]` cuando está vacío. `elType` sólo `container`/`widget` (Elementor flexbox).
- `heading` → `{title, header_size}` + `__globals__.title_color` / `typography_typography`. ✓
- `text-editor` → `{editor}` + `__globals__.text_color`. ✓
- `button` → `{text, link:{url,is_external,nofollow,custom_attributes}}` + `button_text_color`. ✓
- `image` → `{image:{url,id,alt,source,size}, image_size}`. (afinado)
- Globales confirmados: `title_color, text_color, button_text_color, background_color, typography_typography` vía `__globals__` → `globals/colors?id=` y `globals/typography?id=`. ✓
- Loop: `loop-grid` referencia su plantilla por `template_id` (+ `columns`); la
  plantilla es un documento `type:"loop-item"`. Dynamic tags: `__dynamic__` con
  formato `[elementor-tag id=... name=... settings=...]`.

**Ajustes aplicados:** `page_settings:[]`; `image` con campos completos; compilación
de `__dynamic__` desde `dynamicMapping`; loop_grid/repeater CONFIRMADOS → widget
`loop-grid` real + doc `loop-item` (los candidatos heurísticos siguen como
container estático hasta que la IA/usuario confirme). Test de compatibilidad:
los 6 fixtures validan contra `ElementorDocumentSchema`.

**Aún pendiente (requiere más fixtures):** export real de un **Kit** (ajustes del
sitio) para clavar `kit.json` y los `_id` de system_colors/typography; y un
**Template Kit .zip con `manifest.json`** para el formato del manifest. Además, el
`template_id` del loop-grid es sintético (WordPress real necesita la plantilla
guardada como post).

## 12. Website Kit real (2026-08-19)

Con un export real de *Importar/Exportar Kit* (`fixtures/kit/`) se ajustó el
exporter para producir un **Website Kit importable**, no un formato inventado:

```
manifest.json            name/title/version/elementor_version, theme, experiments,
                         site-settings{globalColors:true,...}, templates{}, content{page{}}
site-settings.json       {content, settings{system_colors, custom_colors,
                          system_typography, custom_typography, ...}, metadata, experiments}
content/page/<id>.json   páginas — shape kit-interno {content, settings, metadata}
templates/<id>.json      sub-templates de loops — mismo shape
```

Hallazgos clave (vs. formato provisional anterior):
- El "kit" es `site-settings.json` con top-level `{content, settings, metadata,
  theme, experiments}` (no `{version,title,type:"kit"}`). `experiments` aquí es
  un OBJETO de flags (en el manifest es un array).
- Colores: 4 slots de sistema con `_id` fijos `primary/secondary/text/accent`;
  el resto en `custom_colors` con id propio. Igual para tipografías. `compileKit`
  mapea los 4 primeros globales a los slots de sistema y el resto a custom.
- Dentro del kit, cada documento usa `{content, settings, metadata}`; su
  `title`/`doc_type` viven en el `manifest` (`templates[id]`, `content.page[id]`).
- `globalRefs` → `globals/colors?id=<_id>` / `globals/typography?id=<_id>` con los
  `_id` reales del kit (slug o custom).

Tests de compatibilidad: `site-settings.json`, `manifest.json` y los documentos
internos reales validan contra `SiteSettingsSchema`, `ManifestSchema` y
`KitDocumentSchema` respectivamente.
