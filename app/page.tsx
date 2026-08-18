export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold">HTML → Elementor SaaS AI</h1>
      <p className="max-w-xl text-neutral-400">
        Motor de compilación de dos fases (Two-Pass) que traduce diseños HTML/CSS
        estáticos a paquetes Elementor Template Kits mediante un AST universal.
      </p>
      <p className="text-sm text-neutral-600">Fase actual: PASO 1 — Andamiaje y diseño del AST.</p>
    </main>
  );
}
