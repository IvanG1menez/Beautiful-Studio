import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // El proxy de Next.js corre en el mismo servidor que Django (localhost).
    // SIEMPRE apuntar a localhost:8000 directamente, NO a la URL de ngrok.
    // ngrok es sólo para acceso externo entrante; el proxy es interno.
    const backendUrl = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:8000';
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*/`,
      },
    ];
  },
};

export default nextConfig;
