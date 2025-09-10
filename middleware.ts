// /middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAdmin = token?.isAdmin;
    const path = req.nextUrl.pathname;

    // --- Skips explícitos para evitar interceptar rutas que deben ser públicas ---
    // Estáticos y metadatos (también ya excluidos en matcher, pero por si acaso)
    if (
      path.startsWith("/_next/") ||
      path.startsWith("/assets") ||
      path.startsWith("/images") ||
      path === "/favicon.ico" ||
      path === "/robots.txt" ||
      path === "/sitemap.xml" ||
      path === "/manifest.webmanifest"
    ) {
      return NextResponse.next();
    }

    // Rutas API públicas o de NextAuth
    if (path.startsWith("/api/auth") || path.startsWith("/api/public")) {
      return NextResponse.next();
    }

    // --- Guards de admin ---
    if (path.startsWith("/admin") && !isAdmin) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
    if (path.startsWith("/api/admin") && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Rutas públicas sin autenticación
        if (
          path === "/" ||
          path.startsWith("/auth") ||
          path.startsWith("/public") ||
          path.startsWith("/api/public") ||
          path.startsWith("/api/auth")
        ) {
          return true;
        }

        // Resto de rutas requieren sesión
        return !!token;
      },
    },
  }
);

// Nota: sin lookaheads en el matcher.
// - Interceptamos todas las páginas (salvo estáticos) y todo /api/*,
//   y luego hacemos los "skip" dentro del middleware.
export const config = {
  matcher: [
    // Páginas app (excluye estáticos comunes)
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|assets|images).*)",
    // Todas las rutas API (filtramos auth/public dentro del middleware)
    "/api/:path*",
  ],
};
