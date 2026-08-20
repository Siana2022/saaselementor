# HTML → Elementor SaaS AI

Plataforma que convierte diseños web estáticos (HTML/CSS) en **paquetes Elementor
Website Kit (.zip)** importables en WordPress, mediante un **AST universal** y
edición asistida por IA.

No es un traductor de etiquetas: infiere lógica de datos (Loops, Repeaters,
Dynamic Tags) y sistemas de diseño globales (Kits) a partir de código estático.

## Cómo funciona (Two-Pass)

```
HTML/CSS ─▶ AST (Fase 1: globales · Fase 2: nodos+patrones) ─▶ Editor (iframe + chat IA) ─▶ Website Kit .zip
```

Los 5 pilares:
1. **Global Design System Extractor** — CSS (`:root`, `h1-h6`) → colores/tipografías globales.
2. **HTML → AST + Pattern Matching** — árbol AST, roles Elementor, detección de loops.
3. **Visualizador** — render del AST en `<iframe sandbox>` con selección por clic.
4. **AI Chat Controller** — Claude devuelve un JSON Patch validado con Zod que muta el AST.
5. **Compiler & Exporter** — AST → Elementor JSON → ZIP (`manifest.json`, `site-settings.json`, `content/`, `templates/`).

Ver [`ARCHITECTURE.md`](ARCHITECTURE.md) para el detalle técnico y [`TODO.md`](TODO.md) para el estado.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 6 (strict) · Tailwind CSS v4 ·
Zustand · Zod v4 · cheerio · postcss · jszip · Anthropic SDK · Vitest 4.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # opcional: rellena ANTHROPIC_API_KEY para el chat IA
npm run dev
```

Abre <http://localhost:3000/editor>. Pega HTML (o usa "Cargar ejemplo"),
selecciona elementos, pide cambios por chat y exporta el ZIP.

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servir el build |
| `npm test` | Tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run analyze:fixtures` | Analiza los fixtures reales de Elementor |

## Variables de entorno

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Solo para el chat IA | Clave de la API de Anthropic |
| `ANTHROPIC_MODEL` | No | Modelo (por defecto `claude-sonnet-5`) |

## Despliegue en Vercel

1. **vercel.com** → *Add New → Project* → importa `Siana2022/saaselementor`.
2. Framework detectado automáticamente: **Next.js** (no cambies el build).
3. En *Environment Variables* añade `ANTHROPIC_API_KEY`.
4. **Deploy**.

Las rutas API (`/api/ingest`, `/api/ai`, `/api/export`) usan runtime **Node.js**
(dependen de `cheerio`/`jszip`), ya declarado en cada `route.ts`.

## Estructura

```
app/                 UI (App Router) + rutas API
  editor/            editor del SaaS
  api/{ingest,ai,export}/
components/           componentes React del editor
lib/
  core/ast/          modelo de datos (AST) — fuente de verdad
  core/mutations.ts  motor de mutaciones (JSON Patch IA)
  parser/            HTML/CSS → AST (Pilares 1 y 2)
  render/            AST → HTML del iframe (Pilar 3)
  store/             estado global (Zustand)
  compiler/          AST → Elementor + ZIP (Pilar 5)
fixtures/            exports reales de Elementor (ingeniería inversa)
scripts/             utilidades (analyze-fixture)
```

## Estado

MVP end-to-end funcional. **67 tests** en verde; `tsc` y `next build` OK. El
compilador está afinado contra exports reales de Elementor. Pendiente: verificar
un import round-trip real, mapear más widgets nativos y añadir auth/persistencia.
