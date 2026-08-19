import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold">HTML → Elementor SaaS AI</h1>
      <p className="max-w-xl text-neutral-400">
        Motor de compilación de dos fases (Two-Pass) que traduce diseños HTML/CSS
        estáticos a paquetes Elementor Template Kits mediante un AST universal.
      </p>
      <Link
        href="/editor"
        className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
      >
        Abrir el editor →
      </Link>
    </main>
  );
}
