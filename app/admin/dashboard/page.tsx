import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, CheckSquare, Calendar } from "lucide-react";

export const metadata = {
  title: "Panel Admin | Escalapp",
  description: "Gestión de torneos y jugadores",
};

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <h1 className="text-3xl font-bold mb-8">Panel de Administración</h1>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <Settings className="w-6 h-6 text-purple-600 mb-2" />
              <CardTitle>Torneos Activos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">1</p>
              <p className="text-sm text-gray-600">Escalera Primavera 2025</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CheckSquare className="w-6 h-6 text-green-600 mb-2" />
              <CardTitle>Resultados Pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">3 por validar</p>
              <a className="underline text-sm text-blue-600" href="/admin/results">
                Revisar resultados
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Calendar className="w-6 h-6 text-orange-600 mb-2" />
              <CardTitle>Próximas Rondas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">Ronda 4 en 5 días</p>
              <a className="underline text-sm text-blue-600" href="/admin/rounds">
                Ver rondas
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
