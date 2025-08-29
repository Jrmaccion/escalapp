import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Target, Users, TrendingUp } from "lucide-react";

export const metadata = {
  title: "Clasificaciones | Escalapp",
  description: "Rankings oficial e ironman del torneo",
};

export default async function ClasificacionesPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }

  // TODO: Implementar lógica para obtener datos reales
  const mockRankingData = {
    official: [
      { id: "1", name: "David Sánchez", average: 9.20, rounds: 5, position: 1, isCurrentUser: false },
      { id: "2", name: "Carlos Martínez", average: 8.50, rounds: 5, position: 2, isCurrentUser: true },
      { id: "3", name: "Elena Fernández", average: 8.10, rounds: 5, position: 3, isCurrentUser: false },
      { id: "4", name: "Javier Torres", average: 7.80, rounds: 5, position: 4, isCurrentUser: false },
      { id: "5", name: "Ana García", average: 7.20, rounds: 5, position: 5, isCurrentUser: false }
    ],
    ironman: [
      { id: "1", name: "David Sánchez", totalPoints: 46.0, rounds: 5, position: 1, isCurrentUser: false },
      { id: "2", name: "Carlos Martínez", totalPoints: 42.5, rounds: 5, position: 2, isCurrentUser: true },
      { id: "3", name: "Elena Fernández", totalPoints: 40.5, rounds: 5, position: 3, isCurrentUser: false },
      { id: "4", name: "Javier Torres", totalPoints: 39.0, rounds: 5, position: 4, isCurrentUser: false },
      { id: "5", name: "Ana García", totalPoints: 36.0, rounds: 5, position: 5, isCurrentUser: false }
    ]
  };

  const currentUser = mockRankingData.official.find(p => p.isCurrentUser);

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumbs />
      
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 text-yellow-600" />
        <h1 className="text-2xl md:text-3xl font-semibold">Clasificaciones</h1>
      </div>

      {/* Stats del usuario actual */}
      {currentUser && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600">Posición Oficial</span>
              </div>
              <div className="text-2xl font-bold">#{currentUser.position}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-gray-600">Media</span>
              </div>
              <div className="text-2xl font-bold">{currentUser.average}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">Total Puntos</span>
              </div>
              <div className="text-2xl font-bold">
                {mockRankingData.ironman.find(p => p.isCurrentUser)?.totalPoints}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-600">Rondas</span>
              </div>
              <div className="text-2xl font-bold">{currentUser.rounds}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs de rankings */}
      <Tabs defaultValue="official" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="official">Ranking Oficial</TabsTrigger>
          <TabsTrigger value="ironman">Ranking Ironman</TabsTrigger>
        </TabsList>

        <TabsContent value="official" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Ranking Oficial
              </CardTitle>
              <p className="text-sm text-gray-600">
                Por media de puntos por ronda jugada. Determina el campeón del torneo.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockRankingData.official.map((player, index) => (
                  <div 
                    key={player.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      player.isCurrentUser 
                        ? 'bg-blue-50 border-blue-200' 
                        : index < 3 
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                        index === 0 ? 'bg-yellow-200' :
                        index === 1 ? 'bg-gray-200' :
                        index === 2 ? 'bg-orange-200' :
                        'bg-gray-100'
                      }`}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${player.position}`}
                      </div>
                      <div>
                        <div className="font-bold text-lg">
                          {player.name}
                          {player.isCurrentUser && (
                            <Badge variant="outline" className="ml-2 text-xs">Tú</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {player.average} pts/ronda • {player.rounds} rondas
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">#{player.position}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ironman" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Ranking Ironman
              </CardTitle>
              <p className="text-sm text-gray-600">
                Por puntos totales acumulados. Premia la participación constante.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockRankingData.ironman.map((player, index) => (
                  <div 
                    key={player.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      player.isCurrentUser 
                        ? 'bg-blue-50 border-blue-200' 
                        : index < 3 
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-200 text-yellow-800' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-200 text-orange-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        #{player.position}
                      </div>
                      <div>
                        <div className="font-bold text-lg">
                          {player.name}
                          {player.isCurrentUser && (
                            <Badge variant="outline" className="ml-2 text-xs">Tú</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {player.totalPoints} pts totales • {player.rounds} rondas
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{player.totalPoints}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Información sobre los rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Ranking Oficial</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-blue-700 space-y-2">
              <li>• Media de puntos por ronda jugada</li>
              <li>• Elegible a Campeón si juega ≥50% de rondas</li>
              <li>• Refleja la consistencia y calidad del juego</li>
              <li>• Usado para determinar el ganador del torneo</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-900">Ranking Ironman</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-green-700 space-y-2">
              <li>• Puntos totales acumulados en el torneo</li>
              <li>• Premia la participación constante</li>
              <li>• Reconoce el esfuerzo y la dedicación</li>
              <li>• Premio especial para el líder Ironman</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}