import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ancla la raíz de Turbopack a este proyecto (evita ambigüedad con
  // lockfiles fuera del repositorio git).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
