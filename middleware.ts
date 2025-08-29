// middleware.ts
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
    const isAdminRoute = req.nextUrl.pathname.startsWith('/admin')

    // Si está en página de auth y ya autenticado, redirigir a dashboard
    if (isAuthPage && isAuth) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Si no está autenticado y no está en auth, redirigir a login
    if (!isAuth && !isAuthPage) {
      return NextResponse.redirect(new URL('/auth/login', req.url))
    }

    // Si intenta acceder a admin sin permisos
    if (isAdminRoute && isAuth && !token?.isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Solo permitir auth pages sin token
        if (req.nextUrl.pathname.startsWith('/auth')) {
          return true
        }
        // Todo lo demás requiere token
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|uploads|api/health).*)',
  ]
}