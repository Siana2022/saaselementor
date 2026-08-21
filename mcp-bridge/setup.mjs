#!/usr/bin/env node
/**
 * Asistente de instalación (para personas sin conocimientos técnicos).
 * Pregunta los datos de un sitio WordPress, PRUEBA la conexión, y configura
 * todo automáticamente:
 *   - guarda el sitio en sites.json (registro del puente)
 *   - añade el servidor MCP a la config de Claude Desktop
 * No hay que editar ningún archivo a mano.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const rl = createInterface({ input: stdin, output: stdout });
const ask = (q) => rl.question(q);

console.log("\n=== Asistente Elementor Bridge ===");
console.log("Voy a conectar tu Claude con un WordPress. Necesito 4 datos.\n");

const name = (await ask("1) Nombre corto para este sitio (ej: cliente-ceivan): ")).trim() || "sitio";
let url = (await ask("2) Dirección web del WordPress (https://...): ")).trim().replace(/\/+$/, "");
const user = (await ask("3) Usuario de WordPress (rol Editor): ")).trim();
const pass = (await ask("4) Contraseña de aplicación (con espacios, tal cual): ")).trim();

if (!/^https?:\/\//.test(url)) url = "https://" + url;

console.log("\n→ Probando la conexión...");
try {
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  const res = await fetch(`${url}/?rest_route=/elebridge/v1/ping`, { headers: { Authorization: auth } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.log(`\n✗ No pude conectar (HTTP ${res.status}). Revisa usuario/contraseña y que el plugin esté activo.`);
    console.log("  Detalle:", JSON.stringify(data));
    rl.close();
    process.exit(1);
  }
  console.log(`✓ Conectado. Elementor ${data.elementor_version || "?"} · WordPress ${data.wp_version || "?"}`);
} catch (e) {
  console.log("\n✗ Error de red:", e.message);
  rl.close();
  process.exit(1);
}

// 1) Guardar el sitio en sites.json
const sitesPath = join(HERE, "sites.json");
let reg = { sites: {}, default: name };
if (existsSync(sitesPath)) {
  try { reg = JSON.parse(readFileSync(sitesPath, "utf8")); } catch { reg = { sites: {}, default: name }; }
}
reg.sites = reg.sites || {};
reg.sites[name] = { url, user, app_password: pass };
if (!reg.default) reg.default = name;
writeFileSync(sitesPath, JSON.stringify(reg, null, 2));
console.log(`✓ Sitio "${name}" guardado en el registro (sites.json).`);

// 2) Configurar Claude Desktop
const cfgDir = join(process.env.HOME, "Library", "Application Support", "Claude");
const cfgPath = join(cfgDir, "claude_desktop_config.json");
try {
  if (!existsSync(cfgDir)) mkdirSync(cfgDir, { recursive: true });
  let cfg = {};
  if (existsSync(cfgPath)) {
    copyFileSync(cfgPath, cfgPath + ".bak");
    try { cfg = JSON.parse(readFileSync(cfgPath, "utf8")); } catch { cfg = {}; }
  }
  cfg.mcpServers = cfg.mcpServers || {};
  cfg.mcpServers["elementor-bridge"] = {
    command: process.execPath, // ruta absoluta de node (la de este mismo proceso)
    args: [join(HERE, "index.mjs")],
  };
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  console.log("✓ Claude Desktop configurado.");
} catch (e) {
  console.log("⚠ No pude escribir la config de Claude Desktop:", e.message);
  console.log("  (¿Está instalado Claude Desktop en este Mac?)");
}

console.log("\n=== ¡Listo! ===");
console.log("1. Cierra Claude Desktop del todo (Cmd+Q) y vuelve a abrirlo.");
console.log(`2. En un chat: "usa wp_ping en el sitio ${name}".`);
console.log("Para añadir otro sitio, vuelve a ejecutar este asistente.\n");
rl.close();
