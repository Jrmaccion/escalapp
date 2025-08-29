import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, Calendar } from "lucide-react";

export const metadata = {
  title: "Mi Grupo | Escalapp",
  description: "Información de tu grupo actual y próximos partidos",
};

export default async function MiGrupoPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }

  // TODO: Implementar lógica para obtener datos del grupo
  const mockGroupData = {
    groupNumber: 2,
    level: "Intermedio",
    position: 2,
    points: 8.5,
    players: [
      { id: "1", name: "Carlos Martínez", points: 8.5, position: 1, isCurrentUser: true },
      { id: "2", name: "Ana García", points: 7.2, position: 2, isCurrentUser: false },
      { id: "3", name: "Miguel López", points: 6.8, position: 3, isCurrentUser: false },
      { id: "4", name: "Laura Rodríguez", points: 5.1, position: 4, isCurrentUser: false }
    ],
    nextMatches: [
      {
        id: "1",
        setNumber: 3,
        partner: "Ana García",
        opponents: ["Miguel López", "Laura Rodríguez"],
        date: "2025-03-20"
      }
    ]
  };

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">
      <Breadcrumbs />
      
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl md:text-3xl font-semibold">Mi Grupo</h1>
      </div>

      {/* Información del grupo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">Grupo {mockGroupData.groupNumber}</div>
              <div className="text-sm text-gray-600">{mockGroupData.level}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{mockGroupData.position}°</div>
              <div className="text-sm text-gray-600">Mi posición</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{mockGroupData.points}</div>
              <div className="text-sm text-gray-600">Puntos actuales</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jugadores del grupo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Clasificación del Grupo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockGroupData.players.map((player, index) => (
              <div 
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  player.isCurrentUser 
                    ? 'bg-blue-50 border border-blue-200' 
                    : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                    index === 1 ? 'bg-gray-100 text-gray-700' :
                    index === 2 ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {player.position}
                  </div>
                  <span className="font-medium">
                    {player.name}
                    {player.isCurrentUser && (
                      <Badge variant="outline" className="ml-2 text-xs">Tú</Badge>
                    )}
                  </span>
                </div>
                <div className="font-bold">{player.points} pts</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Próximos partidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Próximos Partidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mockGroupData.nextMatches.length === 0 ? (
            <p className="text-gray-600 text-center py-4">
              No tienes partidos programados
            </p>
          ) : (
            <div className="space-y-3">
              {mockGroupData.nextMatches.map((match) => (
                <div key={match.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <Badge>Set {match.setNumber}</Badge>
                    <span className="text-sm text-gray-600">{match.date}</span>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">
                      Tú + {match.partner}
                    </div>
                    <div className="text-gray-600">
                      vs {match.opponents.join(" + ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Información</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Los grupos se reorganizan después de cada ronda</li>
          <li>• El 1º de cada grupo sube, el último baja</li>
          <li>• Los partidos se juegan con rotación automática</li>
        </ul>
      </div>
    </div>
  );
}