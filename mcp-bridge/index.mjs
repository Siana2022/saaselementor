#!/usr/bin/env node
/**
 * Servidor MCP — Elementor Bridge (multi-sitio)
 * =============================================================================
 * Da a Claude herramientas para construir en WordPress+Elementor vía el plugin
 * `elementor-bridge`. Soporta VARIOS sitios mediante un registro:
 *
 *   sites.json  (junto a este archivo):
 *   { "sites": { "cliente-a": {"url","user","app_password"}, ... }, "default": "cliente-a" }
 *
 * Compatibilidad: si no hay sites.json pero existen WP_URL/WP_USER/WP_APP_PASSWORD
 * en el entorno, se usa como sitio único "default".
 * =============================================================================
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function loadRegistry() {
  const p = process.env.SITES_FILE || join(HERE, "sites.json");
  if (existsSync(p)) {
    const reg = JSON.parse(readFileSync(p, "utf8"));
    return { sites: reg.sites || {}, def: reg.default || Object.keys(reg.sites || {})[0] };
  }
  if (process.env.WP_URL && process.env.WP_USER && process.env.WP_APP_PASSWORD) {
    return {
      sites: { default: { url: process.env.WP_URL, user: process.env.WP_USER, app_password: process.env.WP_APP_PASSWORD } },
      def: "default",
    };
  }
  return { sites: {}, def: undefined };
}

function resolveSite(name) {
  const { sites, def } = loadRegistry();
  const key = name || def;
  const site = key ? sites[key] : undefined;
  if (!site) {
    const avail = Object.keys(sites).join(", ") || "(ninguno)";
    throw new Error(`Sitio "${key || ""}" no encontrado. Disponibles: ${avail}. Configura sites.json o el asistente de instalación.`);
  }
  return { ...site, url: String(site.url).replace(/\/+$/, "") };
}

async function call(siteName, method, path, body) {
  const site = resolveSite(siteName);
  const auth = "Basic " + Buffer.from(`${site.user}:${site.app_password}`).toString("base64");
  const url = `${site.url}/?rest_route=/elebridge/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: auth },
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
const SITE = { site: z.string().optional().describe("Nombre del sitio del registro (si se omite, usa el sitio por defecto)") };

const server = new McpServer({ name: "elementor-bridge", version: "0.2.0" });

server.tool("list_sites", "Lista los sitios WordPress configurados en el registro.", {}, async () => {
  try {
    const { sites, def } = loadRegistry();
    return ok({ default: def, sites: Object.fromEntries(Object.entries(sites).map(([k, v]) => [k, v.url])) });
  } catch (e) { return fail(e); }
});

server.tool("wp_ping", "Comprueba la conexión con un sitio y devuelve versión de Elementor + globales del Kit.", { ...SITE }, async ({ site }) => {
  try { return ok(await call(site, "GET", "/ping")); } catch (e) { return fail(e); }
});

server.tool("list_pages", "Lista las páginas de un sitio (id, título, estado, URL de edición).", { ...SITE }, async ({ site }) => {
  try { return ok(await call(site, "GET", "/pages")); } catch (e) { return fail(e); }
});

server.tool(
  "create_page",
  "Crea (o actualiza si se pasa page_id) una página de Elementor. `content` = array de containers de nivel superior.",
  { ...SITE, title: z.string(), content: z.array(z.any()), status: z.enum(["draft", "publish", "private"]).optional(), page_id: z.number().optional() },
  async ({ site, title, content, status, page_id }) => {
    try { return ok(await call(site, "POST", "/page", { title, content, status: status || "draft", ...(page_id ? { page_id } : {}) })); } catch (e) { return fail(e); }
  },
);

server.tool(
  "append_section",
  "Añade un container de nivel superior a una página existente (construcción incremental).",
  { ...SITE, page_id: z.number(), container: z.record(z.any()) },
  async ({ site, page_id, container }) => {
    try { return ok(await call(site, "POST", "/section", { page_id, container })); } catch (e) { return fail(e); }
  },
);

server.tool(
  "upload_media_from_url",
  "Sube una imagen a la Media Library desde una URL y devuelve id + URL (para enlazarla).",
  { ...SITE, source_url: z.string() },
  async ({ site, source_url }) => {
    try { return ok(await call(site, "POST", "/media", { source_url })); } catch (e) { return fail(e); }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
