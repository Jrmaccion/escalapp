// components/Navigation.tsx - Añade enlace a "Guía" en navegación (público y autenticado)
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Logo from "@/components/brand/logo";
import {
  Home,
  Users,
  Trophy,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  LogIn,
  UserPlus,
  BookOpen,
} from "lucide-react";
import { useState, useEffect } from "react";

// RUTAS UNIFICADAS - Usadas en desktop y móvil
const PLAYER_ROUTES = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/mi-grupo", label: "Mi Grupo", icon: Users },
  { href: "/clasificaciones", label: "Rankings", icon: Trophy },
  { href: "/historial", label: "Historial", icon: Calendar },
  { href: "/guia-rapida", label: "Guía", icon: BookOpen },
] as const;

const ADMIN_ROUTES = [
  { href: "/admin", label: "Dashboard", icon: Home },
  { href: "/admin/tournaments", label: "Torneos", icon: Trophy },
  { href: "/admin/rounds", label: "Rondas", icon: Calendar },
  { href: "/admin/players", label: "Jugadores", icon: Users },
  { href: "/admin/results", label: "Resultados", icon: Settings },
] as const;

export default function Navigation() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Cerrar menús al hacer click fuera
  useEffect(() => {
    const handleClickOutside = () => {
      setAdminMenuOpen(false);
      setMobileMenuOpen(false);
    };
    if (adminMenuOpen || mobileMenuOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [adminMenuOpen, mobileMenuOpen]);

  const isPublicPage = pathname === "/";

  const Brand = (
    <div className="flex items-center gap-2">
      <Logo size={40} />
      <span className="text-xl font-extrabold text-gray-900">PadelRise</span>
    </div>
  );

  // Loading skeleton (pre-hidratación)
  if (!mounted) {
    return (
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div className="h-4 bg-gray-200 rounded w-24" />
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Navegación pública (home o sin sesión)
  if (isPublicPage || (!session && status !== "loading")) {
    return (
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              {Brand}
            </Link>

            {/* Desktop - Public */}
            <div className="hidden md:flex items-center space-x-2">
              <Link href="/guia-rapida" className="mobile-button-sm">
                <Button variant="ghost" size="sm">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Guía
                </Button>
              </Link>
              <Link href="/clasificaciones">
                <Button variant="ghost" size="sm" className="mobile-button-sm">
                  <Trophy className="w-4 h-4 mr-2" />
                  Rankings
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="ghost" size="sm" className="mobile-button-sm">
                  <LogIn className="w-4 h-4 mr-2" />
                  Iniciar Sesión
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button
                  size="sm"
                  className="mobile-button-sm bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Registrarse
                </Button>
              </Link>
            </div>

            {/* Mobile toggle - Public */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMobileMenuOpen(!mobileMenuOpen);
              }}
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile menu - Public */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 bg-white">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <Link
                  href="/guia-rapida"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <BookOpen className="w-5 h-5" />
                  Guía
                </Link>
                <Link
                  href="/clasificaciones"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Trophy className="w-5 h-5" />
                  Rankings
                </Link>
                <Link
                  href="/auth/login"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <LogIn className="w-5 h-5" />
                  Iniciar Sesión
                </Link>
                <Link
                  href="/auth/register"
                  className="block px-3 py-2 rounded-md text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <UserPlus className="w-5 h-5" />
                  Registrarse
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>
    );
  }

  // Loading para usuarios autenticados
  if (status === "loading") {
    return (
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">{Brand}</div>
            <div className="animate-pulse flex space-x-4">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-4 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Navegación para usuarios autenticados
  const isAdmin = (session?.user as any)?.isAdmin;

  const isActiveRoute = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center space-x-2">
            {Brand}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {PLAYER_ROUTES.map((route) => {
              const Icon = route.icon;
              const active = isActiveRoute(route.href);
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={[
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                    active
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <Icon className="w-4 h-4" />
                  {route.label}
                </Link>
              );
            })}

            {/* Admin dropdown */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAdminMenuOpen(!adminMenuOpen);
                  }}
                  className={[
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                    pathname.startsWith("/admin")
                      ? "bg-accent/10 text-accent border border-accent/20"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <Settings className="w-4 h-4" />
                  Admin
                  <ChevronDown className="w-3 h-3" />
                </button>

                {adminMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                    {ADMIN_ROUTES.map((route) => {
                      const Icon = route.icon;
                      const active = isActiveRoute(route.href);
                      return (
                        <Link
                          key={route.href}
                          href={route.href}
                          className={[
                            "block px-4 py-2 text-sm transition-colors flex items-center gap-2",
                            active
                              ? "bg-accent/10 text-accent"
                              : "text-gray-700 hover:bg-gray-50",
                          ].join(" ")}
                          onClick={() => setAdminMenuOpen(false)}
                        >
                          <Icon className="w-4 h-4" />
                          {route.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User info + mobile toggle */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2">
              <span className="text-sm text-gray-700 max-w-32 truncate">
                {session?.user?.name || session?.user?.email}
              </span>
              {isAdmin && (
                <Badge variant="outline" className="text-xs">
                  Admin
                </Badge>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-gray-600 hover:text-gray-900"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Salir</span>
            </Button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setMobileMenuOpen(!mobileMenuOpen);
              }}
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {PLAYER_ROUTES.map((route) => {
                const Icon = route.icon;
                const active = isActiveRoute(route.href);
                return (
                  <Link
                    key={route.href}
                    href={route.href}
                    className={[
                      "block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center gap-3",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                    ].join(" ")}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    {route.label}
                  </Link>
                );
              })}

              {isAdmin && (
                <div className="border-t border-gray-200 mt-2 pt-2">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Administración
                  </div>
                  {ADMIN_ROUTES.map((route) => {
                    const Icon = route.icon;
                    const active = isActiveRoute(route.href);
                    return (
                      <Link
                        key={route.href}
                        href={route.href}
                        className={[
                          "block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center gap-3",
                          active
                            ? "bg-accent/10 text-accent"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                        ].join(" ")}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Icon className="w-5 h-5" />
                        {route.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
