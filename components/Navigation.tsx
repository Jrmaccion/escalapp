// components/Navigation.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Users, Trophy, Calendar, Settings, LogOut, Menu, X, ChevronDown, Target } from "lucide-react";
import { useState } from "react";

export default function Navigation() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  const isAdmin = session?.user?.isAdmin;

  const playerRoutes = [
    { href: "/dashboard",   label: "Inicio",      icon: Home },
    { href: "/tournaments", label: "Torneo",      icon: Target },
    { href: "/mi-grupo",    label: "Mi Grupo",    icon: Users },
    { href: "/clasificaciones", label: "Rankings", icon: Trophy },
    { href: "/historial",   label: "Historial",   icon: Calendar },
  ];

  const adminRoutes = [
    { href: "/admin",             label: "Dashboard Admin", icon: Home },
    { href: "/admin/tournaments", label: "Torneos",         icon: Trophy },
    { href: "/admin/rounds",      label: "Rondas",          icon: Calendar },
    { href: "/admin/players",     label: "Jugadores",       icon: Users },
    { href: "/admin/results",     label: "Resultados",      icon: Settings },
    { href: "/admin/rankings",    label: "Rankings",        icon: Trophy },
  ];

  const isActiveRoute = (href: string) => {
    if (href === "/dashboard")    return pathname === "/dashboard";
    if (href === "/admin")        return pathname === "/admin" || pathname.startsWith("/admin/");
    if (href === "/tournaments")  return pathname === "/tournaments" || pathname.startsWith("/tournaments/");
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Escalapp</span>
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center space-x-1">
            {playerRoutes.map((route) => {
              const Icon = route.icon;
              const active = isActiveRoute(route.href);
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    active
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
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
                  onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    pathname.startsWith("/admin")
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Admin
                  <ChevronDown className="w-3 h-3" />
                </button>

                {adminMenuOpen && (
                  <>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                      {adminRoutes.map((route) => {
                        const Icon = route.icon;
                        return (
                          <Link
                            key={route.href}
                            href={route.href}
                            className={`block px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                              isActiveRoute(route.href) ? "bg-purple-50 text-purple-700" : "text-gray-700 hover:bg-gray-50"
                            }`}
                            onClick={() => setAdminMenuOpen(false)}
                          >
                            <Icon className="w-4 h-4" />
                            {route.label}
                          </Link>
                        );
                      })}
                    </div>
                    <div className="fixed inset-0 z-40" onClick={() => setAdminMenuOpen(false)} />
                  </>
                )}
              </div>
            )}
          </div>

          {/* User + mobile toggle */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2">
              <span className="text-sm text-gray-700">
                {session?.user?.name || session?.user?.email}
              </span>
              {isAdmin && <Badge variant="outline" className="text-xs">Admin</Badge>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/auth/login" })} className="text-gray-600 hover:text-gray-900">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Salir</span>
            </Button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {playerRoutes.map((route) => {
                const Icon = route.icon;
                const active = isActiveRoute(route.href);
                return (
                  <Link
                    key={route.href}
                    href={route.href}
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center gap-3 ${
                      active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
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
                  {adminRoutes.map((route) => {
                    const Icon = route.icon;
                    return (
                      <Link
                        key={route.href}
                        href={route.href}
                        className={`block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center gap-3 ${
                          isActiveRoute(route.href) ? "bg-purple-50 text-purple-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        }`}
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

      {adminMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setAdminMenuOpen(false)} />}
    </nav>
  );
}