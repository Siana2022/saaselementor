# Fase 0 — Probar que se puede escribir en tu Elementor desde fuera

Objetivo: instalar el plugin **Elementor Bridge** en tu WordPress de staging y
**empujar una plantilla** (el hero de Ceivan) para que **aparezca como página de
Elementor**. Si esto funciona, el resto (MCP + skill) se monta encima.

> Hazlo en un **dominio técnico/staging**, nunca en producción. Haz **backup** antes.

## 1. Instalar el plugin

El plugin está en `wordpress-plugin/elementor-bridge/elementor-bridge.php`.

**Opción A (subir ZIP):**
1. Comprime la carpeta `elementor-bridge` en `elementor-bridge.zip`.
2. WP Admin → **Plugins → Añadir nuevo → Subir plugin** → sube el ZIP → **Activar**.

**Opción B (FTP/gestor de archivos):**
1. Copia la carpeta `elementor-bridge/` a `wp-content/plugins/`.
2. WP Admin → **Plugins** → activa **Elementor Bridge**.

## 2. Crear un usuario dedicado (rol Editor, NO administrador)

WP Admin → **Usuarios → Añadir** → rol **Editor**. (Puede crear páginas y subir
medios, pero no tocar ajustes ni instalar plugins → alcance limitado por seguridad.)

## 3. Crear una Contraseña de aplicación

Inicia sesión con ese usuario (o edítalo como admin) → **Usuarios → Perfil** →
abajo, **Contraseñas de aplicación** → nombre `bridge` → **Añadir**.
Copia la contraseña que aparece (formato `xxxx xxxx xxxx xxxx`). Se muestra una vez.

> Requisito: el sitio debe ir por **HTTPS** (las Application Passwords lo exigen).

## 4. Comprobar la conexión (ping)

```bash
node scripts/ping-elementor.mjs \
  --url https://staging.tudominio.com \
  --user tu_usuario_editor \
  --pass "xxxx xxxx xxxx xxxx"
```

Debe devolver `200` con la versión de Elementor y los colores/tipografías globales.

## 5. Empujar el hero

Descarga el `ceivan-home-hero.json` que te pasé (o cualquier plantilla estándar
`{content:[…]}`) y:

```bash
node scripts/push-to-elementor.mjs \
  --url https://staging.tudominio.com \
  --user tu_usuario_editor \
  --pass "xxxx xxxx xxxx xxxx" \
  --file ./ceivan-home-hero.json \
  --title "Ceivan — Home (bridge)" \
  --status draft
```

Devuelve `page_id`, `edit_url` y `view_url`. Abre `edit_url` → **debería abrirse
la página en Elementor con el hero montado**.

## Qué valida esto
Que el puente puede **crear/actualizar páginas de Elementor desde fuera**. Es el
cimiento de todo el sistema. Con esto verde, seguimos con el **puente MCP** (Fase 1)
para que la skill construya en vivo, y la **subida de imágenes** (Fase 2b).

## Seguridad (resumen)
- Endpoints con **autenticación obligatoria** (Application Password) + permiso `edit_pages`.
- Usuario **Editor dedicado** (no admin) → daño máximo = contenido, no el servidor.
- **HTTPS**. Credenciales **solo** en tu máquina / en los comandos, nunca en el repo.
- La contraseña de aplicación se **revoca en un clic** desde el perfil del usuario.
- Cuando no uses el sistema, puedes **desactivar el plugin**.

## Si algo falla
- **401/403** → revisa usuario/contraseña de aplicación y que el sitio sea HTTPS.
- **404 en /wp-json/elebridge/v1/ping** → el plugin no está activo, o los enlaces
  permanentes están en "Simple"; ve a Ajustes → Enlaces permanentes y guarda.
- **La página sale vacía en Elementor** → mándame la respuesta del script y la
  versión de Elementor; ajustamos las claves del meta.
