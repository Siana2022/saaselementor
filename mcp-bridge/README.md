# Elementor Bridge — servidor MCP

Da a Claude herramientas para **construir en tu WordPress+Elementor en vivo** a
través del plugin `elementor-bridge`. Tú conversas con Claude (con la receta de la
skill) y lo que decides aparece en tu Elementor.

## Requisitos
- El plugin **Elementor Bridge** activo en tu WordPress (ver `docs/FASE-0-SETUP.md`).
- Node 20+.
- Un usuario de WP (rol **Editor**) con **Contraseña de aplicación**.

## Instalar
```bash
cd mcp-bridge
npm install
```

## Conectar a Claude Code (CLI)
```bash
claude mcp add elementor-bridge \
  --env WP_URL=https://pretty-blue-whale.5-9-221-129.cpanel.site \
  --env WP_USER=TU_USUARIO \
  --env WP_APP_PASSWORD="xxxx xxxx xxxx xxxx" \
  -- node /Users/cavesson/Desktop/Saas\ elementor/mcp-bridge/index.mjs
```
Luego, en Claude Code: `/mcp` para ver que está conectado.

## Conectar a Claude Desktop
Edita el archivo de configuración de Claude Desktop
(`~/Library/Application Support/Claude/claude_desktop_config.json` en Mac) y añade:

```json
{
  "mcpServers": {
    "elementor-bridge": {
      "command": "node",
      "args": ["/Users/cavesson/Desktop/Saas elementor/mcp-bridge/index.mjs"],
      "env": {
        "WP_URL": "https://pretty-blue-whale.5-9-221-129.cpanel.site",
        "WP_USER": "TU_USUARIO",
        "WP_APP_PASSWORD": "xxxx xxxx xxxx xxxx"
      }
    }
  }
}
```
Reinicia Claude Desktop. Las credenciales se quedan **solo en tu máquina**.

## Herramientas expuestas
| Herramienta | Qué hace |
|---|---|
| `wp_ping` | Versión de Elementor + colores/tipografías globales del Kit. |
| `list_pages` | Lista páginas (id, título, URL de edición). |
| `create_page` | Crea/actualiza una página con `content` (array de containers Elementor). |
| `append_section` | Añade un container a una página existente (incremental). |
| `upload_media_from_url` | Sube una imagen a la Media Library y devuelve id + URL. |

## Cómo se usa (la visión)
1. Carga la **receta** (la skill: cómo generar Elementor limpio — `type:container`,
   `_element_width:"initial"`, anchos %, globales, etc.) en tu Claude.
2. Conversa: *"crea la home de Ceivan con el hero"* → Claude genera el `content` y
   llama a `create_page`. *"añade la sección de servicios en 3 columnas"* →
   `append_section`. *"sube esta imagen de fondo"* → `upload_media_from_url`.
3. Abres Elementor y lo ves en vivo; sigues decidiendo.

> La inteligencia la pone Claude (tu suscripción); el MCP sólo empuja a WordPress.
> Coste por página: 0 € si lo usas desde Claude.ai / Claude Code.

## Seguridad
- Credenciales solo en la config local del cliente MCP (nunca en el repo).
- Usuario Editor (no admin) → alcance limitado. Contraseña de aplicación revocable.
- HTTPS obligatorio.
