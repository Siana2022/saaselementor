# Arquitectura — Elementor Live Builder (skill ↔ puente MCP ↔ WordPress)

Diseño del sistema propuesto: el usuario dirige desde la **skill** (Claude), que
**construye en vivo** en su WordPress+Elementor a través de un **puente (servidor
MCP)** y un **plugin** en WordPress. El humano decide en cada paso.

> Sustituye el enfoque "subir ZIP → descargar JSON" por construcción incremental
> y en directo sobre el Elementor real. El "cerebro" (la receta que genera el JSON
> de Elementor) se reutiliza; sólo cambia **cómo se entrega**.

---

## 1. Visión y flujo

```
  Tú (en Claude, con la skill)
        │  "monta el hero", "ahora los servicios en 3 columnas", "el título más grande"
        ▼
  SKILL (Claude + receta)  ──genera JSON Elementor + decide──►  Herramientas MCP
        │                                                            │
        ▼                                                            ▼
  PUENTE (servidor MCP)  ──REST autenticado──►  PLUGIN WordPress  ──►  Elementor (en vivo)
```

Flujo end-to-end (el "punto 3" del usuario):

1. En Claude: *"Crea la home de Ceivan."*
2. La skill genera el JSON del hero y llama a `create_page("Home", heroJson, draft)`.
   → devuelve la URL de edición. *"Hecho, aquí está el hero: …"*
3. *"Ahora la sección de servicios en 3 columnas."*
4. La skill genera ese container y llama a `append_section(pageId, serviciosJson)`.
5. Abres Elementor y **lo ves en vivo**. *"El título más grande"* → `update_section(...)` → cambia.
6. Imágenes y Dynamic Tags: **manuales** (como hoy con la skill); la skill te dice qué asignar.

---

## 2. Las tres piezas

### Pieza 1 — Plugin de WordPress (`elementor-bridge`)

PHP pequeño (~80-120 líneas). Expone endpoints REST bajo `/wp-json/elebridge/v1/`:

| Endpoint | Qué hace |
|---|---|
| `GET /ping` | Comprueba conexión y devuelve versión de Elementor, tema activo y los `_id` de **colores/tipografías globales** (para que la skill los referencie). |
| `GET /pages` | Lista páginas (id, título, URL de edición). |
| `POST /page` | Crea/actualiza una **página** desde `{title, content, status?, page_id?}`. |
| `POST /section` | Añade/reemplaza **un container de nivel superior** en una página (construcción incremental). |
| `POST /template` | Guarda en la **Biblioteca** de Elementor (`type` container/section/page). |

Cómo escribe la página (lo que hace Elementor internamente):
- `post_type=page`, `post_title`, `post_status` (borrador por defecto).
- Meta:
  - `_elementor_data` = **el array `content[]` serializado como string JSON** (¡no el envoltorio!).
  - `_elementor_edit_mode` = `"builder"`
  - `_elementor_template_type` = `"wp-page"` (o `container`/`section` para biblioteca)
  - `_elementor_version` = versión instalada
  - `_wp_page_template` = `"elementor_header_footer"` (lienzo full-width) — opcional.
- Tras guardar: **limpiar la caché CSS** de Elementor (`Plugin::$instance->files_manager->clear_cache()`).
- Devuelve `{ page_id, edit_url, view_url }`.

Notas técnicas:
- El `_elementor_data` puede llevar HTML (widget html). Guardar el JSON **crudo**
  con `update_post_meta` + `wp_slash`, como hace Elementor, para no perderlo por kses.
- Validar que el body es JSON válido y limitar tamaño.

### Pieza 2 — Puente (servidor MCP) — "el SaaS"

Servidor MCP fino que expone **herramientas** a Claude y traduce a llamadas REST al
plugin. No tiene IA (la IA es Claude al otro lado). Herramientas:

- `wp_ping()` → estado + globales del sitio.
- `list_pages()`
- `create_page(title, content, status?)`
- `update_page(page_id, content)`
- `append_section(page_id, container)`  ← construcción paso a paso
- `create_library_template(title, type, content)`

Antes de empujar, **valida el JSON con nuestros schemas Zod** (`ElementorDocumentSchema`)
— así el puente nunca manda basura a WordPress.

Transporte / alojamiento:
- **Local (stdio)** → conecta con **Claude Desktop / Claude Code / Cowork**. Las
  credenciales se quedan en tu máquina. **Recomendado para empezar** (cero hosting).
- **Remoto (HTTP/SSE en Vercel)** → conector personalizado en **Claude.ai** (planes de
  pago). Necesario si el equipo trabaja desde el navegador. Fase posterior.

### Pieza 3 — La skill (ya existe, adaptada)

- La **receta** (el cerebro) se mantiene: sabe producir Elementor limpio
  (`type:container`, `_element_width:"initial"`, anchos en %, globales, píldoras=button,
  máx 3 niveles, etc.). Ver [[elementor-traspaso-recipe]].
- Se adapta para que, en vez de "devuelve JSON para descargar", **llame a las
  herramientas MCP** y construya en vivo, pieza a pieza, con el humano decidiendo.
- Corre en **Claude.ai (tu suscripción)** o Claude Code → **sin coste por API**.

---

## 3. Seguridad y credenciales

- **Autenticación:** *Contraseñas de aplicación* nativas de WordPress (revocables,
  por usuario). El puente se autentica por Basic Auth sobre **HTTPS**. Los endpoints
  del plugin exigen `current_user_can('edit_pages')`.
- **Dónde viven las credenciales:**
  - MCP local → en tu máquina (config/env). Nunca salen de ahí.
  - MCP remoto (Vercel) → variables de entorno del proyecto; para multi-sitio, un
    almacén por usuario/sitio. Empezar con **un sitio** (env) para simplificar.
- **Nunca** en el repositorio. HTTPS obligatorio. Límite de tamaño y validación del JSON.

---

## 4. Qué es automático y qué manual (honesto)

- **Automático:** estructura, containers, anchos (con las claves aprendidas),
  tipografía, color, fondos, referencias a globales, textos.
- **Manual (igual que con la skill hoy):** asignar **imágenes** a la Media Library
  (necesitan el ID de adjunto real), enlazar **Dynamic Tags**, y el pulido final.

---

## 5. Coste

- Ejecutado desde **Claude.ai (suscripción)** o Claude Code: la generación la cubre
  tu plan → **0 € por página**.
- Puente MCP + plugin: coste de ejecución ~nulo (Vercel free / local).
- Único gasto posible: hosting del MCP si es remoto (free tier suele bastar).

---

## 6. Plan por fases

| Fase | Entregable | Validación |
|---|---|---|
| **0 · Base** | Plugin WP con `GET /ping` + `POST /page` | Empujar `ceivan-home-hero.json` con `curl` y ver la página aparecer en tu Elementor. |
| **1 · Puente local** | MCP (stdio) con ping/list/create/append | Construir una página en vivo desde Claude Code/Desktop, conversando. |
| **2 · Skill en vivo** | Receta adaptada a herramientas MCP | Montar una home paso a paso decidiendo tú. |
| **3 · Remoto (opcional)** | MCP en Vercel como conector de Claude.ai | Que el equipo lo use desde el navegador. |
| **4 · Ampliación** | Multi-sitio, biblioteca, globales, secciones reutilizables | — |

Se valida cada fase antes de la siguiente (la Fase 0 es barata y prueba lo esencial:
que se puede escribir en Elementor desde fuera).

---

## 7. Qué se reutiliza del trabajo actual

- La **receta** y las claves aprendidas (`_element_width:"initial"`, anchos %, formato
  `type:container`, `__globals__`, etc.).
- Los **schemas Zod** de Elementor → el puente valida antes de empujar.
- El conocimiento de ingesta (extraer HTML+CSS por página) si se quiere partir de un ZIP.

El motor mecánico (parser/compilador AST) queda como legado; no participa en esta vía.

---

## 8. Riesgos / preguntas abiertas (honesto)

- Escribir `_elementor_data` correctamente (array `content` como string, `edit_mode`
  builder, limpiar caché) — trillado por muchos plugins, pero necesita **una prueba real**.
- Sanitización (kses) del meta: asegurar que el contenido de widgets `html` sobrevive.
- Conector personalizado en Claude.ai: depende del plan; **local (Claude Desktop/Code)
  funciona siempre**.
- Alta de credenciales por sitio (contraseña de aplicación): pequeño paso manual por WP.
- Diferencias de claves entre versiones de Elementor → `ping` devuelve versión para calibrar.
