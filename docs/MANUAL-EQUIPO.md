# Manual del equipo — Construir en Elementor con Claude

Con esto, cualquiera del equipo puede **decirle a Claude que monte páginas en un
WordPress** y verlas aparecer en Elementor. No hay que saber programar.

> Este manual es para **Mac**. Si usas Windows, avísanos y te damos la versión.

---

## Resumen de lo que vas a hacer

- **Una vez en tu ordenador:** instalar 2 programas y una carpeta.
- **Una vez por cada web:** activar un plugin y crear una contraseña.
- **Cada día:** abrir Claude y pedirle lo que quieras. Ya está.

---

## PARTE 1 · Preparar tu ordenador (solo la primera vez)

### 1.1 Instalar Node
1. Entra en **https://nodejs.org**
2. Pulsa el botón verde grande (versión **LTS**).
3. Abre el archivo descargado y dale a **Continuar → Continuar → Instalar**. Ya.

### 1.2 Instalar Claude Desktop
1. Entra en **https://claude.ai/download** e instala la app de escritorio.
2. Inicia sesión con tu cuenta.

### 1.3 Descargar la carpeta del puente
1. Te pasaremos la carpeta **`mcp-bridge`** (por el repositorio o una carpeta compartida).
2. Guárdala en un sitio fijo, por ejemplo en tu carpeta de usuario. **No la muevas después.**

---

## PARTE 2 · Preparar la web (una vez por cada WordPress)

> Esto se hace en el **wp-admin** de la web. Es WordPress normal, sin código.

### 2.1 Activar el plugin
1. Te pasaremos el archivo **`elementor-bridge.zip`**.
2. En wp-admin: **Plugins → Añadir nuevo → Subir plugin** → elige el zip → **Instalar** → **Activar**.

### 2.2 Crear un usuario "Editor" (recomendado)
- **Usuarios → Añadir** → rol **Editor**. (Por seguridad, no uses el administrador.)

### 2.3 Crear la contraseña de aplicación
1. **Usuarios → (tu usuario Editor) → Editar.**
2. Abajo del todo: **"Contraseñas de aplicación"** → escribe un nombre (`bridge`) → **Añadir**.
3. **Copia la contraseña** que aparece (tipo `abcd 1234 efgh 5678`). **Solo se muestra una vez.**

> La web debe tener **https://** (candado). Si no, avísanos.

---

## PARTE 3 · Conectar Claude con esa web (el asistente lo hace por ti)

1. Abre la carpeta **`mcp-bridge`**.
2. **Doble clic** en **`setup.command`**.
   - Si Mac dice *"no se puede abrir, desarrollador no identificado"*: haz **clic derecho → Abrir → Abrir**. (Solo la primera vez.)
3. Se abre una ventana negra que te pregunta 4 cosas. Responde y pulsa Enter en cada una:
   1. **Nombre corto** para la web (ej: `cliente-ceivan`).
   2. **Dirección web** (ej: `https://midominio.com`).
   3. **Usuario** de WordPress.
   4. **Contraseña de aplicación** (la que copiaste, con espacios).
4. Si todo va bien verás **"✓ Conectado"** y **"¡Listo!"**.
5. **Cierra Claude Desktop del todo** (Cmd+Q) y vuelve a abrirlo.

Eso es todo: no has tenido que editar ningún archivo.

---

## PARTE 3.5 · Cargar "la receta" (una vez, para que salga clavado)

Para que Claude monte con calidad (y no improvise), dale la receta:

1. En Claude Desktop, crea un **Proyecto** llamado *"Elementor Builder"*.
2. Abre el archivo **`RECETA-ELEMENTOR.md`** (viene en el paquete), copia **todo** su
   contenido y pégalo en las **Instrucciones** del proyecto. Guarda.
3. A partir de ahí, **trabaja siempre dentro de ese proyecto**: Claude ya sabrá
   construir Elementor bien.

## PARTE 4 · Trabajar (cada día)

1. Abre **Claude Desktop**, entra en el proyecto **"Elementor Builder"** y empieza un chat.
2. Comprueba la conexión escribiendo:
   > *Usa wp_ping en el sitio cliente-ceivan.*
   Debe responder con la versión de Elementor. ✅
3. Pídele lo que quieras, en lenguaje normal. Ejemplos:
   > *En el sitio cliente-ceivan, crea una página "Home" con una cabecera y un hero con el título "..." y un botón.*

   > *Añade a esa página una sección de servicios en 3 tarjetas.*

   > *Sube esta imagen de fondo al hero: https://.../foto.jpg*

   > *Haz el título más grande y cambia el botón a azul oscuro.*
4. Claude te dará un enlace para **abrir la página en Elementor** y verla.
5. Ajustes finos (mover cosas, imágenes de la biblioteca) los haces en Elementor como siempre.

---

## PARTE 5 · Añadir otra web

Repite la **PARTE 2** (plugin + contraseña) en la web nueva, y vuelve a hacer
**doble clic en `setup.command`** con los datos de esa web. Podrás elegir cada web
por su nombre al hablar con Claude (*"en el sitio cliente-b, ..."*).

---

## Si algo no va

| Síntoma | Solución |
|---|---|
| El asistente dice "Node no está instalado" | Haz la **Parte 1.1** y vuelve a abrir `setup.command`. |
| "No pude conectar (HTTP 401)" | Usuario o contraseña mal. Revisa que copiaste la **contraseña de aplicación** (no la normal). |
| "No pude conectar (HTTP 404)" | El plugin no está activo, o los enlaces permanentes: en wp-admin, **Ajustes → Enlaces permanentes → Guardar cambios**. |
| En Claude no aparecen las herramientas | ¿Cerraste Claude con **Cmd+Q** y lo reabriste? Si sigue, vuelve a ejecutar `setup.command`. |
| La página sale rara | Cuéntanoslo con una captura; ajustamos la receta. |

---

## Nota de seguridad (para tranquilidad)

- Usas un usuario **Editor** (no administrador): solo puede tocar **contenido**, no
  ajustes ni el servidor.
- La contraseña se guarda **solo en tu ordenador** y se puede **revocar en un clic**
  desde el perfil del usuario en WordPress.
- Todo va por **https** (cifrado).
