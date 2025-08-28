// app/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, ListChecks, Users, Calendar, Settings, BarChart } from "lucide-react";
import PlayerDashboardClient from "./PlayerDashboardClient";

export const metadata = { title: "Dashboard | Escalapp" };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  // Si es admin, mostrar dashboard de administración
  if (session.user?.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">
              Panel de Administración
            </h1>
            <Badge className="bg-red-50 text-red-700 border-red-200">
              Administrador
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/admin/tournaments" className="block">
              <Card className="hover:shadow-lg transition">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <CardTitle>Torneos</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">Crear y gestionar torneos.</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/results" className="block">
              <Card className="hover:shadow-lg transition">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-blue-600" />
                    <CardTitle>Resultados</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">Validar y corregir resultados.</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/rounds" className="block">
              <Card className="hover:shadow-lg transition">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-green-600" />
                    <CardTitle>Rondas</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">Gestionar fechas y rondas.</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/players" className="block">
              <Card className="hover:shadow-lg transition">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    <CardTitle>Jugadores</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">Gestionar jugadores.</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/rankings" className="block">
              <Card className="hover:shadow-lg transition">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart className="w-5 h-5 text-indigo-600" />
                    <CardTitle>Rankings</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">Ver clasificaciones.</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin" className="block">
              <Card className="hover:shadow-lg transition">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-600" />
                    <CardTitle>Admin Panel</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">Panel completo de admin.</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Si es jugador normal, mostrar dashboard de jugador
  return <PlayerDashboardClient />;
}