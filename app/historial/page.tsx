import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ArrowUp, ArrowDown, Minus, Calendar } from "lucide-react";

export const metadata = {
  title: "Historial | Escalapp",
  description: "Tu recorrido ronda a ronda y movimientos en el torneo",
};

export default async function HistorialPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }

  // TODO: Implementar lógica para obtener datos reales del historial
  const mockHistoryData = {
    rounds: [
      {
        round: 1,
        group: 3,
        position: 2,
        points: 7.0,
        movement: 'up' as const,
        date: '2025-02-15',
        matches: [
          { vs: 'Ana + Miguel', result: '4-2', points: 5 },
          { vs: 'Laura + Pablo', result: '3-4', points: 3 },
          { vs: 'Ana + Pablo', result: '4-1', points: 5 }
        ]
      },
      {
        round: 2,
        group: 2,
        position: 3,
        points: 6.5,
        movement: 'same' as const,
        date: '2025-03-01',
        matches: [
          { vs: 'David + Elena', result: '2-4', points: 2 },
          { vs: 'Javier + María', result: '4-3', points: 5 },
          { vs: 'David + Javier', result: '4-2', points: 5 }
        ]
      },
      {
        round: 3,
        group: 2,
        position: 1,
        points: 9.0,
        movement: 'up' as const,
        date: '2025-03-15',
        matches: [
          { vs: 'Ana + Miguel', result: '4-1', points: 5 },
          { vs: 'Elena + Javier', result: '4-0', points: 5 },
          { vs: 'Ana + Elena', result: '4-3', points: 5 }
        ]
      },
      {
        round: 4,
        group: 1,
        position: 2,
        points: 8.5,
        movement: 'same' as const,
        date: '2025-03-29',
        matches: [
          { vs: 'David + Elena', result: '3-4', points: 3 },
          { vs: 'Javier + María', result: '4-2', points: 5 },
          { vs: 'David + Javier', result: '4-4 (TB 7-5)', points: 5 }
        ]
      },
      {
        round: 5,
        group: 1,
        position: 2,
        points: 8.0,
        movement: 'same' as const,
        date: '2025-04-12',
        matches: [
          { vs: 'David + Elena', result: 'Pendiente', points: 0 },
          { vs: 'Javier + María', result: 'Sin jugar', points: 0 },
          { vs: 'David + Javier', result: 'Sin jugar', points: 0 }
        ]
      }
    ],
    totalStats: {
      totalRounds: 5,
      totalPoints: 39.0,
      averagePoints: 8.5,
      bestRound: { round: 3, points: 9.0 },
      currentStreak: 0,
      bestStreak: 2
    }
  };

  const getMovementIcon = (movement: 'up' | 'down' | 'same') => {
    switch (movement) {
      case 'up':
        return <ArrowUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <ArrowDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-blue-600" />;
    }
  };

  const getMovementText = (movement: 'up' | 'down' | 'same') => {
    switch (movement) {
      case 'up': return 'Subió';
      case 'down': return 'Bajó';
      default: return 'Se mantuvo';
    }
  };

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumbs />
      
      <div className="flex items-center gap-3">
        <History className="w-6 h-6 text-purple-600" />
        <h1 className="text-2xl md:text-3xl font-semibold">Mi Historial</h1>
      </div>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{mockHistoryData.totalStats.totalRounds}</div>
              <div className="text-sm text-gray-600">Rondas jugadas</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{mockHistoryData.totalStats.averagePoints}</div>
              <div className="text-sm text-gray-600">Media de puntos</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{mockHistoryData.totalStats.totalPoints}</div>
              <div className="text-sm text-gray-600">Puntos totales</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{mockHistoryData.totalStats.bestRound.points}</div>
              <div className="text-sm text-gray-600">Mejor ronda</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historial por rondas */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Evolución por Rondas</h2>
        
        {mockHistoryData.rounds.map((roundData) => (
          <Card key={roundData.round}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Ronda {roundData.round}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">
                    {new Date(roundData.date).toLocaleDateString('es-ES')}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {getMovementIcon(roundData.movement)}
                    <span className="text-sm">{getMovementText(roundData.movement)}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600">Grupo</div>
                  <div className="font-bold">Grupo {roundData.group}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Posición Final</div>
                  <div className="font-bold">{roundData.position}°</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Puntos Obtenidos</div>
                  <div className="font-bold">{roundData.points} pts</div>
                </div>
              </div>
              
              {/* Partidos de la ronda */}
              <div>
                <h4 className="font-medium mb-3">Partidos jugados:</h4>
                <div className="space-y-2">
                  {roundData.matches.map((match, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm">
                        <span className="font-medium">vs {match.vs}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={
                          match.result === 'Pendiente' ? 'secondary' :
                          match.result === 'Sin jugar' ? 'outline' :
                          match.result.startsWith('4') && !match.result.startsWith('4-4') ? 'default' : 'secondary'
                        }>
                          {match.result}
                        </Badge>
                        <span className="text-sm font-medium">{match.points} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico de evolución - placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Evolución de Puntos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center text-gray-500">
              <div className="text-lg font-medium">Gráfico de evolución</div>
              <div className="text-sm">Próximamente disponible</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información adicional */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-medium text-purple-900 mb-2">Información del Historial</h4>
        <ul className="text-sm text-purple-700 space-y-1">
          <li>• Los movimientos se aplican al final de cada ronda</li>
          <li>• El primer puesto sube de grupo, el último baja</li>
          <li>• Los puntos por racha se añaden automáticamente</li>
          <li>• Las estadísticas se actualizan tras confirmar resultados</li>
        </ul>
      </div>
    </div>
  );
}