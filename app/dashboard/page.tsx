import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, TrendingUp } from "lucide-react";

export const metadata = {
  title: "Panel de Jugador | Escalapp",
  description: "Tu espacio personal en Escalapp",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <h1 className="text-3xl font-bold mb-8">
          Hola, {session.user?.name ?? session.user?.email}
        </h1>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <Trophy className="w-6 h-6 text-yellow-500 mb-2" />
              <CardTitle>Mi Ranking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">Grupo 2</p>
              <p className="text-sm text-gray-600">Posición provisional</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="w-6 h-6 text-blue-600 mb-2" />
              <CardTitle>Próximos Partidos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">Aún no programados</p>
              <a className="underline text-sm text-blue-600" href="/tournament">
                Ver calendario
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="w-6 h-6 text-green-600 mb-2" />
              <CardTitle>Progreso</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">+12 pts</p>
              <p className="text-sm text-gray-600">Esta ronda</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10">
          <Card>
            <CardHeader>
              <CardTitle>Accesos rápidos</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm">
                {session.user?.isAdmin && (
                  <li>
                    <a className="underline" href="/admin/dashboard">
                      Ir al panel de admin
                    </a>
                  </li>
                )}
                <li>
                  <a className="underline" href="/auth/login?callbackUrl=%2Fdashboard">
