// hooks/useNavigation.ts - Compatible con páginas públicas
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

export function useNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const navigateWithLoading = async (path: string, showLoading = true) => {
    if (showLoading) {
      toast.loading('Navegando...', { id: 'navigation' });
    }
    
    try {
      router.push(path);
      // Limpiar toast después de un momento
      setTimeout(() => {
        toast.dismiss('navigation');
      }, 1000);
    } catch (error) {
      toast.error('Error al navegar');
      console.error('Navigation error:', error);
    }
  };

  const canAccessAdminRoutes = () => {
    return session?.user?.isAdmin === true;
  };

  const getPageTitle = (path?: string): string => {
    const currentPath = path || pathname;
    
    // Títulos para páginas públicas
    if (currentPath === "/" || !session) {
      return 'PadelRise - Torneos de Pádel';
    }
    
    const titles: Record<string, string> = {
      '/dashboard': 'Inicio',
      '/mi-grupo': 'Mi Grupo',
      '/clasificaciones': 'Clasificaciones',
      '/historial': 'Historial',
      '/guia-rapida': 'Guía Rápida',
      '/tournaments': 'Torneos',
      '/admin': 'Dashboard Admin',
      '/admin/tournaments': 'Gestión de Torneos',
      '/admin/rounds': 'Gestión de Rondas',
      '/admin/players': 'Gestión de Jugadores',
      '/admin/results': 'Validación de Resultados',
      '/admin/rankings': 'Rankings y Clasificaciones',
    };

    return titles[currentPath] || 'PadelRise';
  };

  const getBreadcrumbItems = (path?: string) => {
    const currentPath = path || pathname;
    
    // No generar breadcrumbs para páginas públicas
    if (currentPath === "/" || !session) {
      return [];
    }
    
    const segments = currentPath.split('/').filter(Boolean);
    
    type BreadcrumbItem = {
      label: string;
      href?: string;
      current?: boolean;
    };
    
    const isAdmin = session?.user?.isAdmin;
    const items: BreadcrumbItem[] = [
      { 
        label: 'Inicio', 
        href: isAdmin && currentPath.startsWith('/admin') ? '/admin' : '/dashboard' 
      }
    ];

    let buildPath = '';
    segments.forEach((segment, index) => {
      buildPath += `/${segment}`;
      
      const routeNames: Record<string, string> = {
        'dashboard': 'Inicio',
        'admin': 'Administración',
        'tournaments': 'Torneos',
        'rounds': 'Rondas',
        'players': 'Jugadores',
        'results': 'Resultados',
        'rankings': 'Rankings',
        'mi-grupo': 'Mi Grupo',
        'clasificaciones': 'Clasificaciones',
        'historial': 'Historial',
        'guia-rapida': 'Guía Rápida',
        'create': 'Crear',
        'manage': 'Gestionar',
        'settings': 'Configuración'
      };

      const label = routeNames[segment] || segment;
      const isLast = index === segments.length - 1;

      items.push({
        label,
        href: isLast ? undefined : buildPath,
        current: isLast
      });
    });

    return items;
  };

  // Función segura para obtener datos del usuario
  const getUserInfo = () => {
    if (status === "loading") {
      return {
        isLoading: true,
        isLoggedIn: false,
        user: null,
        isAdmin: false
      };
    }

    return {
      isLoading: false,
      isLoggedIn: !!session,
      user: session?.user || null,
      isAdmin: session?.user?.isAdmin || false
    };
  };

  // Función para verificar si estamos en página pública
  const isPublicPage = () => {
    return pathname === "/" || (!session && status !== "loading");
  };

  return {
    router,
    pathname,
    navigateWithLoading,
    canAccessAdminRoutes,
    getPageTitle,
    getBreadcrumbItems,
    getUserInfo,
    isPublicPage,
    // Propiedades directas (mantener compatibilidad)
    isAdmin: session?.user?.isAdmin || false,
    user: session?.user || null,
    isLoading: status === "loading"
  };
}