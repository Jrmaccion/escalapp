// components/PlayerTabbar.tsx - UNIFICADO CON NAVIGATION
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Trophy, Calendar } from "lucide-react";
import clsx from "clsx";

// MISMAS RUTAS QUE EN NAVIGATION.TSX - CONSISTENCIA TOTAL
const TABS = [
  { href: "/dashboard",        label: "Inicio",    icon: Home },
  { href: "/mi-grupo",         label: "Mi Grupo",  icon: Users },
  { href: "/clasificaciones",  label: "Rankings",  icon: Trophy },
  { href: "/historial",        label: "Historial", icon: Calendar },
];

export default function PlayerTabbar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden">
      <ul className="grid grid-cols-4 h-16">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex-1 flex flex-col items-center justify-center py-2 px-1 text-xs transition-colors",
                  active 
                    ? "text-blue-600 font-medium" 
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Icon className={clsx(
                  "w-5 h-5 mb-1",
                  active ? "text-blue-600" : "text-gray-500"
                )} />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}