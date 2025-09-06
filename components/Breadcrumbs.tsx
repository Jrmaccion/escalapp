// components/Breadcrumbs.tsx - Compatible con páginas públicas
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronRight, Home } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href?: string;
  current?: boolean;
};

type BreadcrumbsProps = {
  items?: BreadcrumbItem[];
};

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  // No mostrar breadcrumbs en páginas públicas
  if (pathname === "/" || !session) {
    return null;
  }

  // Generar breadcrumbs automáticamente si no se proporcionan
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const segments = pathname.split('/').filter(Boolean);
    const isAdmin = session?.user?.isAdmin;
    
    // Punto de inicio basado en el tipo de usuario
    const breadcrumbs: BreadcrumbItem[] = [
      { 
        label: 'Inicio', 
        href: isAdmin && pathname.startsWith('/admin') ? '/admin' : '/dashboard' 
      }
    ];

    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Mapear rutas a nombres amigables
      const routeNames: Record<string, string> = {
        'dashboard': 'Inicio',
        'admin': 'Admin',
        'tournaments': 'Torneos',
        'rounds': 'Rondas', 
        'players': 'Jugadores',
        'results': 'Resultados',
        'rankings': 'Rankings',
        'create': 'Crear',
        'mi-grupo': 'Mi Grupo',
        'clasificaciones': 'Clasificaciones',
        'historial': 'Historial',
        'match': 'Partido',
        'guia-rapida': 'Guía Rápida'
      };

      const label = routeNames[segment] || segment;
      const isLast = index === segments.length - 1;
      
      breadcrumbs.push({
        label,
        href: isLast ? undefined : currentPath,
        current: isLast
      });
    });

    return breadcrumbs;
  };

  const breadcrumbItems = items || generateBreadcrumbs();

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
      <Home className="w-4 h-4" />
      {breadcrumbItems.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
          {item.href && !item.current ? (
            <Link 
              href={item.href} 
              className="hover:text-blue-600 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className={item.current ? "text-gray-900 font-medium" : ""}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}