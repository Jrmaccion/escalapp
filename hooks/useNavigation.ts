import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

export function useNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

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
    
    const titles: Record<string, string> = {
      '/dashboard': 'Inicio',
      '/mi-grupo': 'Mi Grupo',
      '/clasificaciones': 'Clasificaciones',
      '/historial': 'Historial',
      '/admin': 'Dashboard Admin',
      '/admin/tournaments': 'Gestión de Torneos',
      '/admin/rounds': 'Gestión de Rondas',
      '/admin/players': 'Gestión de Jugadores',
      '/admin/results': 'Validación de Resultados',
      '/admin/rankings': 'Rankings y Clasificaciones',
    };

    return titles[currentPath] || 'Escalapp';
  };

  const getBreadcrumbItems = (path?: string) => {
    const currentPath = path || pathname;
    const segments = currentPath.split('/').filter(Boolean);
    
    type BreadcrumbItem = {
      label: string;
      href?: string;
      current?: boolean;
    };
    
    const items: BreadcrumbItem[] = [
      { label: 'Inicio', href: '/dashboard' }
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

  return {
    router,
    pathname,
    navigateWithLoading,
    canAccessAdminRoutes,
    getPageTitle,
    getBreadcrumbItems,
    isAdmin: session?.user?.isAdmin,
    user: session?.user
  };
}