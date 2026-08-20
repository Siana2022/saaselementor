#!/usr/bin/env node
/**
 * Empuja una plantilla (JSON estándar {content:[...]}) a WordPress vía el plugin
 * Elementor Bridge. Crea/actualiza una página de Elementor en tu sitio.
 *
 * Uso:
 *   node scripts/push-to-elementor.mjs \
 *     --url https://staging.tudominio.com \
 *     --user tu_usuario_editor \
 *     --pass "xxxx xxxx xxxx xxxx" \
 *     --file ./ceivan-home-hero.json \
 *     [--title "Home"] [--status draft] [--page-id 0]
 *
 * `--pass` es la CONTRASEÑA DE APLICACIÓN de WordPress (Usuarios → Perfil →
 * Contraseñas de aplicación). No es la contraseña normal.
 */
import { readFileSync } from "node:fs";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const url = (arg("url") || "").replace(/\/+$/, "");
const user = arg("user");
const pass = arg("pass");
const file = arg("file");
const title = arg("title");
const status = arg("status", "draft");
const pageId = Number(arg("page-id", "0"));

if (!url || !user || !pass || !file) {
  console.error("Faltan argumentos. Requeridos: --url --user --pass --file");
  process.exit(1);
}

const doc = JSON.parse(readFileSync(file, "utf8"));
const content = Array.isArray(doc.content) ? doc.content : Array.isArray(doc) ? doc : null;
if (!content) {
  console.error("El archivo no tiene un array 'content' de elementos Elementor.");
  process.exit(1);
}

const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
const endpoint = `${url}/wp-json/elebridge/v1/page`;

const body = {
  title: title || doc.title || "Página (bridge)",
  status,
  content,
  ...(pageId > 0 ? { page_id: pageId } : {}),
};

console.log(`→ POST ${endpoint}  (${content.length} contenedores de nivel superior)`);

const res = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: auth },
  body: JSON.stringify(body),
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  data = text;
}

if (!res.ok) {
  console.error(`✗ Error ${res.status}:`, data);
  process.exit(1);
}

console.log("✓ Página creada/actualizada:");
console.log("  page_id :", data.page_id);
console.log("  editar  :", data.edit_url);
console.log("  ver     :", data.view_url);
