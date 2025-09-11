// app/dashboard/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Breadcrumbs from "@/components/Breadcrumbs";
import PlayerDashboardClient from "./PlayerDashboardClient";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Shuffle,
  Calendar,
  ListChecks,
  UserCog,
  Trophy,
} from "lucide-react";

export const metadata = {
  title: "Dashboard | PadelRise",
  description: "Panel principal del jugador y acceso rápido a funciones.",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }

  const isAdmin = !!session.user?.isAdmin;

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-8">
      <Breadcrumbs />

      {/* ▶️ Nuevo dashboard dinámico del jugador */}
      <PlayerDashboardClient />

      {/* Área Admin (solo si es admin) */}
      {isAdmin && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Panel de Administración</h2>
              <p className="text-sm text-muted-foreground">
                Gestiona torneos, rondas y jugadores
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/admin">Ver todo</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="hover:bg-muted/40 transition-colors">
              <Link href="/admin/tournaments" className="block">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-5 h-5 text-blue-600" />
                    <CardTitle>Torneos</CardTitle>
                  </div>
                  <CardDescription>
                    Crear, activar y configurar torneos
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            <Card className="hover:bg-muted/40 transition-colors">
              <Link href="/admin/rounds" className="block">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-green-600" />
                    <CardTitle>Rondas</CardTitle>
                  </div>
                  <CardDescription>
                    Fechas, grupos y generación automática
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            <Card className="hover:bg-muted/40 transition-colors">
              <Link href="/admin/results" className="block">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-orange-600" />
                    <CardTitle>Resultados</CardTitle>
                  </div>
                  <CardDescription>
                    Validación y corrección de actas
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            <Card className="hover:bg-muted/40 transition-colors">
              <Link href="/admin/players" className="block">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <UserCog className="w-5 h-5 text-purple-600" />
                    <CardTitle>Jugadores</CardTitle>
                  </div>
                  <CardDescription>
                    Altas, bajas y asignaciones
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            <Card className="hover:bg-muted/40 transition-colors">
              <Link href="/admin/rankings" className="block">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <CardTitle>Rankings</CardTitle>
                  </div>
                  <CardDescription>
                    Recalcular y exportar clasificaciones
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            <Card className="hover:bg-muted/40 transition-colors">
              <Link href="/admin" className="block">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-600" />
                    <CardTitle>Configuración</CardTitle>
                  </div>
                  <CardDescription>
                    Recordatorios y opciones avanzadas
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
