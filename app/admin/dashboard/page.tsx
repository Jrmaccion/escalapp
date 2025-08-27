// app/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, ListChecks, Users, Calendar } from "lucide-react";

export const metadata = { title: "Dashboard | Escalapp" };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <h1 className="text-3xl font-bold mb-8">
          Hola, {session.user?.name ?? session.user?.email}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-600" />
                <CardTitle>Mi ranking</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">Consulta tu posición y evolución.</p>
              <Badge variant="secondary">Próximamente</Badge>
            </CardContent>
          </Card>

          <Link href="/admin/results" className="block">
            <Card className="hover:shadow-lg transition">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-blue-600" />
                  <CardTitle>Resultados</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Introduce o revisa resultados.</p>
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
                <p className="text-gray-600">Fechas y estado de cada ronda.</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="mt-10">
          <Link href="/admin/tournaments" className="inline-flex items-center gap-2 text-blue-600 hover:underline">
            <Users className="w-4 h-4" />
            Ver torneos
          </Link>
        </div>
      </div>
    </div>
  );
}
