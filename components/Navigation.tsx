"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Logo from "@/components/brand/logo";
import {
  Home, Users, Trophy, Calendar, Settings, LogOut,
  ChevronDown, BookOpen, Bell, Zap, Clock, AlertTriangle, CheckCircle
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

/* =========================
   Hook de notificaciones - MEJORADO
   ========================= */
function usePlayerNotifications() {
  const [notifications, setNotifications] = useState({
    pendingMatches: 0,
    pendingConfirmations: 0,
    unreadUpdates: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  
  // Ref para evitar múltiples llamadas simultáneas
  const fetchingRef = useRef(false);
  const markingAsReadRef = useRef(false);

  const fetchNotifications = useCallback(async (silent = false) => {
    // Evitar llamadas múltiples simultáneas
    if (fetchingRef.current) {
      console.log("🔔 Fetch ya en progreso, saltando...");
      return;
    }
    
    fetchingRef.current = true;
    
    try {
      if (!silent) {
        setLoading(true);
      }
      
      console.log("🔔 Fetching notifications...");
      
      const res = await fetch("/api/player/notifications", { 
        cache: "no-store",
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log("📊 Notifications data:", data);
        
        const pendingMatches = data.pendingMatches || 0;
        const pendingConfirmations = data.pendingConfirmations || 0;
        const unreadUpdates = data.unreadUpdates || 0;
        const total = pendingMatches + pendingConfirmations + unreadUpdates;
        
        setNotifications({
          pendingMatches,
          pendingConfirmations,
          unreadUpdates,
          total
        });
        
        setLastFetch(new Date());
        console.log("✅ Notifications actualizadas:", { total, pendingMatches, pendingConfirmations, unreadUpdates });
      } else {
        console.error("❌ Error fetch notifications:", res.status);
      }
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  }, []);

  const markAsRead = useCallback(async () => {
    // Evitar múltiples llamadas simultáneas
    if (markingAsReadRef.current) {
      console.log("🧹 Mark as read ya en progreso, saltando...");
      return;
    }
    
    markingAsReadRef.current = true;
    
    try {
      console.log("🧹 Marcando notificaciones como leídas...");
      
      const res = await fetch("/api/player/notifications", { 
        method: "PATCH",
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log("📊 Response después de marcar como leídas:", data);
        
        // Actualizar estado inmediatamente con la respuesta del servidor
        const pendingMatches = data.pendingMatches || 0;
        const pendingConfirmations = data.pendingConfirmations || 0;
        const unreadUpdates = 0; // Siempre 0 después de marcar como leídas
        const total = pendingMatches + pendingConfirmations + unreadUpdates;
        
        setNotifications({
          pendingMatches,
          pendingConfirmations, 
          unreadUpdates,
          total
        });
        
        console.log("✅ Notificaciones marcadas como leídas. Nuevo total:", total);
      } else {
        console.error("❌ Error marcando como leídas:", res.status);
      }
    } catch (error) {
      console.error('❌ Error marking notifications as read:', error);
    } finally {
      markingAsReadRef.current = false;
    }
  }, []);

  // Fetch inicial y periódico
  useEffect(() => {
    console.log("🔔 Iniciando sistema de notificaciones");
    fetchNotifications();
    
    // Intervalo cada 2 minutos
    const interval = setInterval(() => {
      console.log("⏰ Auto-refresh notifications");
      fetchNotifications(true);
    }, 120000);
    
    return () => {
      console.log("🔔 Limpiando sistema de notificaciones");
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  return { 
    notifications, 
    loading, 
    refresh: fetchNotifications, 
    markAsRead, 
    lastFetch 
  };
}

/* =========================
   Rutas
   ========================= */
const PLAYER_ROUTES = [
  { 
    href: "/dashboard", 
    label: "Inicio", 
    icon: Home, 
    priority: "primary", 
    description: "Tu resumen personal" 
  },
  { 
    href: "/mi-grupo", 
    label: "Mi Grupo", 
    icon: Users, 
    priority: "primary", 
    description: "Grupo actual y partidos" 
  },
  { 
    href: "/clasificaciones", 
    label: "Rankings", 
    icon: Trophy, 
    priority: "secondary", 
    description: "Clasificación general" 
  },
  { 
    href: "/historial", 
    label: "Historial", 
    icon: Calendar, 
    priority: "secondary", 
    description: "Tus partidos anteriores" 
  },
  { 
    href: "/guia-rapida", 
    label: "Guía", 
    icon: BookOpen, 
    priority: "tertiary", 
    description: "Aprende cómo funciona" 
  },
];

const ADMIN_ROUTES = [
  { 
    href: "/admin", 
    label: "Dashboard", 
    icon: Settings, 
    description: "Panel de control" 
  },
  { 
    href: "/admin/tournaments", 
    label: "Torneos", 
    icon: Trophy, 
    description: "Gestionar torneos" 
  },
  { 
    href: "/admin/rounds", 
    label: "Rondas", 
    icon: Calendar, 
    description: "Rondas activas" 
  },
  { 
    href: "/admin/players", 
    label: "Jugadores", 
    icon: Users, 
    description: "Gestionar jugadores" 
  },
];

/* =========================
   Componente
   ========================= */
export default function Navigation() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const { notifications, markAsRead, refresh, lastFetch } = usePlayerNotifications();

  useEffect(() => setMounted(true), []);
  
  useEffect(() => {
    // Al cambiar de ruta, cierra desplegables
    setShowMore(false);
    setShowNotifications(false);
    setShowAdmin(false);
  }, [pathname]);

  // MEJORADO: Manejar apertura del panel de notificaciones
  const handleNotificationClick = useCallback(async () => {
    console.log("🔔 Click en notificaciones, estado actual:", {
      isOpen: showNotifications,
      total: notifications.total,
      unreadUpdates: notifications.unreadUpdates
    });
    
    if (!showNotifications) {
      // Abrir panel
      setShowNotifications(true);
      
      // Solo marcar como leídas si hay unreadUpdates
      if (notifications.unreadUpdates > 0) {
        console.log("🧹 Hay updates no leídas, marcando como leídas...");
        await markAsRead();
      }
    } else {
      // Cerrar panel
      setShowNotifications(false);
    }
  }, [showNotifications, notifications.unreadUpdates, markAsRead]);

  // Auto-cerrar panel si no hay notificaciones
  useEffect(() => {
    if (showNotifications && notifications.total === 0) {
      console.log("📭 No hay notificaciones, auto-cerrando panel");
      setTimeout(() => {
        setShowNotifications(false);
      }, 2000);
    }
  }, [showNotifications, notifications.total]);

  // Detección robusta de admin + fallback si ya estás en /admin
  const userAny = session?.user as any;
  const isAdminFlag = !!(
    userAny?.isAdmin || 
    userAny?.role === "ADMIN" || 
    userAny?.role === "admin" || 
    userAny?.roles?.includes?.("admin")
  );
  const forceAdminByPath = pathname.startsWith("/admin");
  const canSeeAdmin = isAdminFlag || forceAdminByPath;

  const isActiveRoute = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/");
    return pathname.startsWith(href);
  };

  const primaryRoutes = PLAYER_ROUTES.filter((r) => r.priority === "primary");
  const secondaryRoutes = PLAYER_ROUTES.filter((r) => r.priority === "secondary");

  const Brand = (
    <div className="flex items-center gap-2">
      <Logo size={40} />
      <span className="text-xl font-extrabold text-gray-900">Escalapp</span>
    </div>
  );

  if (!mounted || status === "loading") {
    return (
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">{Brand}</div>
            <div className="animate-pulse flex space-x-4">
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/dashboard" className="flex items-center space-x-2">
            {Brand}
          </Link>

          {/* Navegación principal (desktop) */}
          <div className="hidden md:flex items-center space-x-2">
            {primaryRoutes.map((route) => {
              const Icon = route.icon;
              const active = isActiveRoute(route.href);
              // Solo acciones que requieren ir a Mi Grupo
              const badgeCount = route.href === "/mi-grupo" ? notifications.pendingMatches : 0;
              
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 group ${
                    active 
                      ? "bg-primary text-white shadow-md" 
                      : "text-gray-700 hover:text-primary hover:bg-primary/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {route.label}
                  {badgeCount > 0 && (
                    <Badge className="bg-red-500 text-white text-xs min-w-[18px] h-4 p-0 flex items-center justify-center animate-pulse">
                      {badgeCount}
                    </Badge>
                  )}
                </Link>
              );
            })}

            {/* Más (secundario) */}
            <div className="relative">
              <button
                onClick={() => setShowMore(!showMore)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-primary hover:bg-primary/5 flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Más
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {showMore && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border py-2 z-50">
                  {secondaryRoutes.map((route) => {
                    const Icon = route.icon;
                    const active = isActiveRoute(route.href);
                    
                    return (
                      <Link
                        key={route.href}
                        href={route.href}
                        className={`block px-4 py-3 text-sm transition-colors hover:bg-gray-50 ${
                          active 
                            ? "text-primary bg-primary/5 border-r-2 border-primary" 
                            : "text-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4" />
                          <div>
                            <div className="font-medium">{route.label}</div>
                            <div className="text-xs text-gray-500">{route.description}</div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Admin (dropdown) */}
            {canSeeAdmin && (
              <div className="relative">
                <button
                  onClick={() => setShowAdmin(!showAdmin)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    pathname.startsWith("/admin")
                      ? "bg-orange-100 text-orange-700"
                      : "text-gray-600 hover:text-orange-600 hover:bg-orange-50"
                  }`}
                  title="Administración"
                >
                  <Settings className="w-4 h-4" />
                  Admin
                  <ChevronDown className="w-3 h-3" />
                </button>
                
                {showAdmin && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border py-2 z-50">
                    {ADMIN_ROUTES.map((route) => {
                      const Icon = route.icon;
                      const active = isActiveRoute(route.href);
                      
                      return (
                        <Link
                          key={route.href}
                          href={route.href}
                          className={`block px-4 py-3 text-sm transition-colors hover:bg-gray-50 ${
                            active 
                              ? "text-orange-700 bg-orange-50 border-r-2 border-orange-400" 
                              : "text-gray-700"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4" />
                            <div>
                              <div className="font-medium">{route.label}</div>
                              <div className="text-xs text-gray-500">{route.description}</div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lado derecho */}
          <div className="flex items-center space-x-3">
            {/* Notificaciones - MEJORADAS */}
            <div className="relative">
              <button
                className="relative p-2 text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                onClick={handleNotificationClick}
                aria-label="Ver notificaciones"
                title={`${notifications.total} notificaciones${notifications.total !== 1 ? 's' : ''}`}
              >
                <Bell className="w-5 h-5" />
                {notifications.total > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                    {notifications.total > 9 ? "9+" : notifications.total}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border py-2 z-50">
                  <div className="px-4 py-2 border-b flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">Notificaciones</h3>
                    {lastFetch && (
                      <span className="text-xs text-gray-500">
                        {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {notifications.total === 0 ? (
                      <div className="px-4 py-6 text-center text-gray-500">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p className="text-sm font-medium">¡Todo al día!</p>
                        <p className="text-xs">No tienes notificaciones pendientes</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {notifications.pendingMatches > 0 && (
                          <Link
                            href="/mi-grupo"
                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                            onClick={() => setShowNotifications(false)}
                          >
                            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                              <Clock className="w-4 h-4 text-orange-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {notifications.pendingMatches} set{notifications.pendingMatches > 1 ? "s" : ""} pendiente{notifications.pendingMatches > 1 ? "s" : ""}
                              </p>
                              <p className="text-xs text-gray-500">Tienes partidos por jugar</p>
                            </div>
                            <Badge className="bg-orange-100 text-orange-700 animate-pulse">
                              {notifications.pendingMatches}
                            </Badge>
                          </Link>
                        )}

                        {notifications.pendingConfirmations > 0 && (
                          <Link
                            href="/mi-grupo"
                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                            onClick={() => setShowNotifications(false)}
                          >
                            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                              <AlertTriangle className="w-4 h-4 text-yellow-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {notifications.pendingConfirmations} resultado{notifications.pendingConfirmations > 1 ? "s" : ""} por confirmar
                              </p>
                              <p className="text-xs text-gray-500">Revisa y confirma los resultados</p>
                            </div>
                            <Badge className="bg-yellow-100 text-yellow-700">
                              {notifications.pendingConfirmations}
                            </Badge>
                          </Link>
                        )}

                        {notifications.unreadUpdates > 0 && (
                          <Link
                            href="/dashboard"
                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                            onClick={() => setShowNotifications(false)}
                          >
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <Zap className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">Nuevas actualizaciones</p>
                              <p className="text-xs text-gray-500">Hay cambios en el torneo</p>
                            </div>
                            <Badge className="bg-blue-100 text-blue-700 animate-pulse">Nuevo</Badge>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer con botón de refresh */}
                  <div className="border-t px-4 py-2">
                    <button
                      onClick={() => {
                        console.log("🔄 Refresh manual de notificaciones");
                        refresh();
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      🔄 Actualizar notificaciones
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Usuario + salir */}
            <div className="hidden sm:flex items-center space-x-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {session?.user?.name || "Usuario"}
                </div>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => signOut({ callbackUrl: "/" })} 
              className="text-gray-600 hover:text-red-600"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Salir</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}