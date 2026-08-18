import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HTML → Elementor SaaS AI",
  description:
    "Convierte diseños HTML/CSS estáticos en paquetes Elementor Template Kits mediante un AST universal y edición por IA.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
