#!/usr/bin/env node
/**
 * Servidor MCP — Elementor Bridge
 * =============================================================================
 * Expone herramientas a Claude para construir en un WordPress+Elementor a través
 * del plugin `elementor-bridge`. La inteligencia (generar el JSON de Elementor
 * siguiendo la receta) la pone Claude; este servidor sólo empuja al WordPress.
 *
 * Config por variables de entorno:
 *   WP_URL           https://tu-staging.tld        (sin barra final)
 *   WP_USER          usuario de WordPress (rol Editor recomendado)
 *   WP_APP_PASSWORD  contraseña de aplicación de WordPress
 * =============================================================================
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const WP_URL = (process.env.WP_URL || "").replace(/\/+$/, "");
const WP_USER = process.env.WP_USER || "";
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD || "";

function assertConfig() {
  if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
    throw new Error("Faltan WP_URL / WP_USER / WP_APP_PASSWORD en el entorno del servidor MCP.");
  }
}
const authHeader = () => "Basic " + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString("base64");
const routeUrl = (path) => `${WP_URL}/?rest_route=/elebridge/v1${path}`;

async function call(method, path, body) {
  assertConfig();
  const res = await fetch(routeUrl(path), {
    method,
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`WP ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}
const ok = (obj) => ({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] });
const fail = (e) => ({ content: [{ type: "text", text: `Error: ${e.message}` }], isError: true });

const server = new McpServer({ name: "elementor-bridge", version: "0.1.0" });

server.tool(
  "wp_ping",
  "Comprueba la conexión con WordPress y devuelve la versión de Elementor y los colores/tipografías globales del Kit (para referenciarlos).",
  {},
  async () => {
    try { return ok(await call("GET", "/ping")); } catch (e) { return fail(e); }
  },
);

server.tool(
  "list_pages",
  "Lista las páginas del WordPress (id, título, estado, URL de edición en Elementor).",
  {},
  async () => {
    try { return ok(await call("GET", "/pages")); } catch (e) { return fail(e); }
  },
);

server.tool(
  "create_page",
  "Crea (o actualiza si se pasa page_id) una página de Elementor. `content` es el array de elementos de nivel superior (containers) en formato Elementor.",
  {
    title: z.string().describe("Título de la página"),
    content: z.array(z.any()).describe("Array de elementos Elementor (containers de nivel superior)"),
    status: z.enum(["draft", "publish", "private"]).optional().describe("Estado (por defecto draft)"),
    page_id: z.number().optional().describe("Si se indica, actualiza esa página en vez de crear"),
  },
  async ({ title, content, status, page_id }) => {
    try {
      return ok(await call("POST", "/page", { title, content, status: status || "draft", ...(page_id ? { page_id } : {}) }));
    } catch (e) { return fail(e); }
  },
);

server.tool(
  "append_section",
  "Añade un container de nivel superior a una página existente (construcción incremental: 'ahora añade la sección de servicios').",
  {
    page_id: z.number().describe("ID de la página destino"),
    container: z.record(z.any()).describe("Un container de Elementor (elType:container) con sus elements"),
  },
  async ({ page_id, container }) => {
    try { return ok(await call("POST", "/section", { page_id, container })); } catch (e) { return fail(e); }
  },
);

server.tool(
  "upload_media_from_url",
  "Sube una imagen a la Media Library de WordPress desde una URL y devuelve su id de adjunto y su URL (para enlazarla en widgets/fondos).",
  { source_url: z.string().describe("URL pública de la imagen") },
  async ({ source_url }) => {
    try { return ok(await call("POST", "/media", { source_url })); } catch (e) { return fail(e); }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
