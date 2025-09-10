import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  ListChecks, 
  Trophy, 
  History, 
  Settings, 
  Shuffle, 
  Calendar, 
  UserCog,
  Play,
  Clock
} from "lucide-react";

export const metadata = {
  title: "Dashboard | Escalapp",
  description: "Panel principal del jugador y acceso rápido a funciones.",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }

  const isAdmin = !!session.user?.isAdmin;

  // 👇 Ruta segura para el card "Resultados"
  const resultsHref = isAdmin ? "/admin/results" : "/mi-grupo";

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-8">
      <Breadcrumbs />
      
      {/* Cabecera con acciones rápidas */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">
            Bienvenido{session?.user?.name ? `, ${session.user.name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Accede rápidamente a tu grupo, resultados y clasificaciones.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button asChild variant="outline">
              <Link href="/admin">
                <Settings className="w-4 h-4 mr-2" />
                Panel Admin
              </Link>
            </Button>
          )}
          <Badge variant={isAdmin ? "default" : "outline"} className="text-xs">
            {isAdmin ? "Administrador" : "Jugador"}
          </Badge>
        </div>
      </div>

      {/* Acciones rápidas destacadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:bg-muted/40 transition-colors border-blue-200 bg-blue-50/50">
          <Link href="/mi-grupo" className="block">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-blue-900">Mi grupo</CardTitle>
              </div>
              <CardDescription>
                Ver composición del grupo y próximos partidos
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
        
        {isAdmin && (         
        <Card className="hover:bg-muted/40 transition-colors border-green-200 bg-green-50/50">
          {/* 👇 Antes era "/resultados/pendientes" (causaba 404) */}
          <Link href={resultsHref} className="block">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-green-600" />
                <CardTitle className="text-green-900">Resultados</CardTitle>
              </div>
              <CardDescription>
                Introduce o confirma resultados pendientes
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
        )}

        <Card className="hover:bg-muted/40 transition-colors border-yellow-200 bg-yellow-50/50">
          <Link href="/clasificaciones" className="block">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-600" />
                <CardTitle className="text-yellow-900">Clasificaciones</CardTitle>
              </div>
              <CardDescription>
                Oficial por media e Ironman por puntos totales
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="hover:bg-muted/40 transition-colors border-purple-200 bg-purple-50/50">
          <Link href="/historial" className="block">
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                <CardTitle className="text-purple-900">Historial</CardTitle>
              </div>
              <CardDescription>
                Tu recorrido ronda a ronda y movimientos
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
      </div>

      {/* Área Admin */}
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
              <Link href="/admin">
                Ver todo
              </Link>
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
              <Link href="/admin/settings" className="block">
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
