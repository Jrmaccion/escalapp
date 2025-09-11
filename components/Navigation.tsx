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

// Rutas simplificadas sin badge problemático
const PLAYER_ROUTES = [
  { href: "/dashboard", label: "Inicio", icon: Home, priority: 1 },
  { href: "/mi-grupo", label: "Mi Grupo", icon: Users, priority: 1 },
  { href: "/clasificaciones", label: "Rankings", icon: Trophy, priority: 2 },
  { href: "/historial", label: "Historial", icon: Calendar, priority: 3 },
  { href: "/guia-rapida", label: "Guía", icon: BookOpen, priority: 3 },
];

const ADMIN_ROUTES = [
  { href: "/admin", label: "Dashboard", icon: Home },
  { href: "/admin/tournaments", label: "Torneos", icon: Trophy },
  { href: "/admin/rounds", label: "Rondas", icon: Calendar },
  { href: "/admin/players", label: "Jugadores", icon: Users },
  { href: "/admin/results", label: "Resultados", icon: Settings },
];

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
      <span className="text-xl font-extrabold text-gray-900">Escalapp</span>
    </div>
  );

  // Loading skeleton
  if (!mounted) {
    return (
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Navegación pública
  if (isPublicPage || (!session && status !== "loading")) {
    return (
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              {Brand}
            </Link>

            <div className="hidden md:flex items-center space-x-2">
              <Link href="/guia-rapida">
                <Button variant="ghost" size="sm">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Guía
                </Button>
              </Link>
              <Link href="/clasificaciones">
                <Button variant="ghost" size="sm">
                  <Trophy className="w-4 h-4 mr-2" />
                  Rankings
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">
                  <LogIn className="w-4 h-4 mr-2" />
                  Iniciar Sesión
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Registrarse
                </Button>
              </Link>
            </div>

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
    <>
      {/* DESKTOP NAVIGATION */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center space-x-2">
              {Brand}
            </Link>

            {/* Desktop Navigation - Prioridades visuales mejoradas */}
            <div className="hidden md:flex items-center space-x-1">
              {PLAYER_ROUTES.filter(route => route.priority <= 2).map((route) => {
                const Icon = route.icon;
                const active = isActiveRoute(route.href);
                
                return (
                  <Link
                    key={route.href}
                    href={route.href}
                    className={[
                      "relative px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                      active
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : route.priority === 1 
                        ? "text-gray-900 hover:text-primary hover:bg-primary/5 font-semibold"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <Icon className="w-4 h-4" />
                    {route.label}
                    {/* Badge para Mi Grupo */}
                    {route.href === "/mi-grupo" && (
                      <Badge className="bg-red-500 text-white text-xs min-w-[20px] h-5 flex items-center justify-center p-0">
                        1
                      </Badge>
                    )}
                  </Link>
                );
              })}

              {/* Menú "Más" para rutas secundarias */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAdminMenuOpen(!adminMenuOpen);
                  }}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  Más
                  <ChevronDown className="w-3 h-3" />
                </button>

                {adminMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                    {PLAYER_ROUTES.filter(route => route.priority === 3).map((route) => {
                      const Icon = route.icon;
                      const active = isActiveRoute(route.href);
                      return (
                        <Link
                          key={route.href}
                          href={route.href}
                          className={[
                            "block px-4 py-2 text-sm transition-colors flex items-center gap-2",
                            active
                              ? "bg-primary/10 text-primary"
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

              {/* Admin dropdown si es admin */}
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
                        ? "bg-orange-100 text-orange-700 border border-orange-200"
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
                                ? "bg-orange-100 text-orange-700"
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

            {/* User info + logout */}
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
                        "relative flex items-center justify-between px-3 py-3 rounded-md text-base font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                      ].join(" ")}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        {route.label}
                      </div>
                      {route.href === "/mi-grupo" && (
                        <Badge className="bg-red-500 text-white text-xs">
                          1
                        </Badge>
                      )}
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
                              ? "bg-orange-100 text-orange-700"
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

      {/* MOBILE BOTTOM TAB BAR - Solo rutas prioritarias */}
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden">
        <ul className="grid grid-cols-4 h-16">
          {PLAYER_ROUTES.filter(route => route.priority <= 2).map((route) => {
            const active = isActiveRoute(route.href);
            const Icon = route.icon;
            
            return (
              <li key={route.href} className="flex">
                <Link
                  href={route.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative flex-1 flex flex-col items-center justify-center py-2 px-1 text-xs transition-colors",
                    active 
                      ? "text-primary font-medium" 
                      : "text-gray-500 hover:text-gray-700"
                  ].join(" ")}
                >
                  <Icon className={[
                    "w-5 h-5 mb-1",
                    active ? "text-primary" : "text-gray-500"
                  ].join(" ")} />
                  <span className="truncate">{route.label}</span>
                  {route.href === "/mi-grupo" && (
                    <div className="absolute -top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      1
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}