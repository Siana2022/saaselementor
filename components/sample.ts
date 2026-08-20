/** HTML de ejemplo (estilo por CLASES, como un sitio real) para probar el motor de fidelidad. */
export const SAMPLE_HTML = `<!doctype html>
<html>
<head>
<style>
  body { margin:0; font-family: Georgia, serif; color:#0f172a; background:#ffffff; }
  .hero { display:flex; flex-direction:column; gap:16px; padding:48px; background-color:#01125B; border-radius:24px; }
  .hero__title { font-family: Montserrat, sans-serif; font-size:56px; font-weight:700; line-height:1.1; color:#ffffff; text-align:center; }
  .hero__subtitle { font-size:18px; color:#8ACDCF; text-align:center; }
  .btn { font-family: Montserrat, sans-serif; font-weight:600; font-size:16px; color:#01125B; background-color:#8ACDCF; padding:14px 28px; border-radius:999px; }
  .cards { display:flex; gap:24px; padding:32px; }
  .card { display:flex; flex-direction:column; gap:8px; padding:24px; background-color:#F7F5F0; border-radius:16px; }
  .card__title { font-family: Montserrat, sans-serif; font-size:22px; font-weight:600; color:#01125B; }
  .card__text { font-size:15px; color:#334155; }
</style>
</head>
<body>
  <section class="hero">
    <h1 class="hero__title">Formación médica avanzada</h1>
    <p class="hero__subtitle">Del conocimiento técnico a la integración en clínica.</p>
    <a href="/formaciones" class="btn">Encuentra tu formación</a>
  </section>
  <div class="cards">
    <article class="card"><h3 class="card__title">Láser</h3><p class="card__text">Fundamentos y práctica.</p></article>
    <article class="card"><h3 class="card__title">Seguridad</h3><p class="card__text">Protocolos clínicos.</p></article>
    <article class="card"><h3 class="card__title">Integración</h3><p class="card__text">En tu consulta real.</p></article>
  </div>
</body>
</html>`;
