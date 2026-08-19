/** HTML de ejemplo para probar el pipeline (vars :root, headings, grid de tarjetas). */
export const SAMPLE_HTML = `<!doctype html>
<html>
<head>
<style>
  :root { --color-primary:#2563eb; --color-text:#0f172a; }
  body { font-family: system-ui, sans-serif; color: var(--color-text); margin:0; padding:32px; }
  h1 { font-size:44px; font-weight:800; line-height:1.1; }
  p { font-size:16px; line-height:1.6; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:24px; }
  .card { border:1px solid #e2e8f0; border-radius:12px; padding:16px; }
  .btn { display:inline-block; background:var(--color-primary); color:#fff; padding:10px 16px; border-radius:8px; text-decoration:none; }
</style>
</head>
<body>
  <h1 style="color: var(--color-primary)">Bienvenido</h1>
  <p>Un diseño estático listo para convertirse en Elementor.</p>
  <a href="/comprar" class="btn">Comprar ahora</a>
  <div class="grid">
    <article class="card"><img src="a.jpg" alt="a"><h3>Uno</h3><p>Desc uno</p></article>
    <article class="card"><img src="b.jpg" alt="b"><h3>Dos</h3><p>Desc dos</p></article>
    <article class="card"><img src="c.jpg" alt="c"><h3>Tres</h3><p>Desc tres</p></article>
  </div>
</body>
</html>`;
