// /next.config.mjs
/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// Construimos la CSP según entorno.
// En dev añadimos 'unsafe-eval' y permitimos ws/wss para HMR.
const csp = [
  "default-src 'self'",
  // En dev añadimos 'unsafe-eval'
  `script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // En dev permitimos ws/wss para Fast Refresh
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-src 'self'"
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  // Si usas App Router, no hace falta experimental especial aquí
  async headers() {
    return [
      {
        // Aplica a todas las rutas
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
