import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
    const isApiRoute = req.nextUrl.pathname.startsWith('/api')
    const isAdminRoute = req.nextUrl.pathname.startsWith('/admin')
    const isPublicRoute = req.nextUrl.pathname === '/' || req.nextUrl.pathname.startsWith('/public')

    if (isPublicRoute) {
      return NextResponse.next()
    }

    if (isAuthPage && isAuth) {
      if (token?.isAdmin) {
        return NextResponse.redirect(new URL('/admin/dashboard', req.url))
      }
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    if (!isAuth && !isAuthPage && !isApiRoute) {
      let from = req.nextUrl.pathname
      if (req.nextUrl.search) {
        from += req.nextUrl.search
      }
      
      return NextResponse.redirect(
        new URL(`/auth/login?from=${encodeURIComponent(from)}`, req.url)
      )
    }

    if (isAdminRoute && isAuth && !token?.isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const isPublicRoute = req.nextUrl.pathname === '/' || 
                             req.nextUrl.pathname.startsWith('/public') ||
                             req.nextUrl.pathname.startsWith('/auth')
        
        if (isPublicRoute) return true
        
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|uploads).*)',
  ]
}
