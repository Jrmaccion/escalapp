// components/PlayerTabbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Target, Trophy, User } from "lucide-react";
import clsx from "clsx";

const TABS = [
  { href: "/dashboard",   label: "Inicio",          icon: Home },
  { href: "/tournaments", label: "Torneo",          icon: Target }, // ← plural
  { href: "/mi-grupo",    label: "Mi grupo",        icon: Users },
  { href: "/clasificaciones", label: "Clasificación", icon: Trophy },
  { href: "/perfil",      label: "Perfil",          icon: User },
];

export default function PlayerTabbar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/tournaments") {
      // activo en /tournaments y /tournaments/[id]
      return pathname === "/tournaments" || pathname.startsWith("/tournaments/");
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex flex-col items-center justify-center py-2 text-xs transition-colors",
                  active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-5 mb-1" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
