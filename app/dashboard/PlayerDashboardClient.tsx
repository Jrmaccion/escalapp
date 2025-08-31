// app/dashboard/PlayerDashboardClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Target,
  ListChecks
} from "lucide-react";
import Link from "next/link";

type PlayerDashboardData = {
  activeTournament: {
    id: string;
    title: string;
    currentRound: number;
    totalRounds: number;
    roundEndDate: string;
  } | null;
  currentGroup: {
    id: string;
    number: number;
    level: number;
    position: number;
    points: number;
    streak: number;
    players: Array<{
      id: string;
      name: string;
      position: number;
      points: number;
    }>;
  } | null;
  myMatches: Array<{
    id: string;
    setNumber: number;
    team1Player1Name: string;
    team1Player2Name: string;
    team2Player1Name: string;
    team2Player2Name: string;
    team1Games: number | null;
    team2Games: number | null;
    tiebreakScore: string | null;
    isConfirmed: boolean;
    reportedById: string | null;
    groupNumber: number;
  }>;
  ranking: {
    position: number;
    averagePoints: number;
    totalPoints: number;
    roundsPlayed: number;
    ironmanPosition: number;
  } | null;
  stats: {
    matchesPlayed: number;
    matchesPending: number;
    winRate: number;
    currentStreak: number;
  };
};

export default function PlayerDashboardClient() {
  const { data: session } = useSession();
  const [data, setData] = useState<PlayerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/player/dashboard');
      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      } else {
        setError('Error al cargar los datos del dashboard');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchDashboardData();
    }
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center py-20">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchDashboardData}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.activeTournament) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          <h1 className="text-3xl font-bold mb-8">
            Hola, {session?.user?.name ?? session?.user?.email}
          </h1>
          
          <div className="text-center py-20">
            <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No hay torneos activos</h2>
            <p className="text-gray-600 mb-6">Actualmente no estás inscrito en ningún torneo activo.</p>
            <p className="text-sm text-gray-500 mb-4">Contacta con el administrador para unirte a un torneo.</p>
          </div>

          {/* Mantener tarjetas originales como fallback */}
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
                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-secondary text-secondary-foreground">
                  Sin torneo activo
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition opacity-50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-blue-600" />
                  <CardTitle>Resultados</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Introduce resultados cuando tengas sets.</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition opacity-50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-green-600" />
                  <CardTitle>Rondas</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Fechas de rondas cuando hay torneo activo.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const daysUntilRoundEnd = Math.ceil(
    (new Date(data.activeTournament.roundEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Hola, {session?.user?.name ?? session?.user?.email}
          </h1>
          <p className="text-gray-600">
            {data.activeTournament.title} - Ronda {data.activeTournament.currentRound} de {data.activeTournament.totalRounds}
          </p>
        </div>

        {/* Alert de tiempo restante */}
        {daysUntilRoundEnd <= 3 && daysUntilRoundEnd > 0 && (
          <div className={`mb-6 p-4 rounded-lg border ${
            daysUntilRoundEnd <= 1 
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-yellow-50 border-yellow-200 text-yellow-700'
          }`}>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="font-medium">
                {daysUntilRoundEnd === 1
                  ? 'Último día de la ronda'
                  : `Quedan ${daysUntilRoundEnd} días para terminar la ronda`
                }
              </span>
            </div>
          </div>
        )}

        {/* Stats principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Mi Posición</p>
                  <p className="text-2xl font-bold">
                    {data.currentGroup?.position || '-'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Grupo {data.currentGroup?.number || '-'}
                  </p>
                </div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Mis Puntos</p>
                  <p className="text-2xl font-bold">
                    {data.currentGroup?.points?.toFixed(1) || '0.0'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Racha: {data.currentGroup?.streak || 0}
                  </p>
                </div>
                <Trophy className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ranking</p>
                  <p className="text-2xl font-bold">
                    #{data.ranking?.position || '-'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Media: {data.ranking?.averagePoints?.toFixed(1) || '0.0'}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Sets</p>
                  <p className="text-2xl font-bold">
                    {data.stats.matchesPlayed}
                  </p>
                  <p className="text-xs text-gray-500">
                    {data.stats.matchesPending} pendientes
                  </p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contenido en tabs */}
        <Tabs defaultValue="matches" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="matches">Mis Sets ({data.stats.matchesPending})</TabsTrigger>
            <TabsTrigger value="group">Mi Grupo</TabsTrigger>
            <TabsTrigger value="ranking">Clasificación</TabsTrigger>
          </TabsList>

          <TabsContent value="matches" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Sets de Esta Ronda</h2>
              <div className="flex gap-2">
                <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  data.stats.matchesPending > 0 
                    ? 'border-transparent bg-destructive text-destructive-foreground' 
                    : 'border-transparent bg-primary text-primary-foreground'
                }`}>
                  {data.stats.matchesPending} pendientes
                </div>
                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground">
                  {data.stats.matchesPlayed} completados
                </div>
              </div>
            </div>

            {data.myMatches.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No tienes sets programados en esta ronda.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {data.myMatches.map((match) => (
                  <Card key={match.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium mb-1">Set {match.setNumber}</div>
                          <div className="text-sm text-gray-600">
                            {match.team1Player1Name} + {match.team1Player2Name}
                            <br />
                            vs
                            <br />
                            {match.team2Player1Name} + {match.team2Player2Name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">
                            {match.team1Games !== null && match.team2Games !== null
                              ? `${match.team1Games}-${match.team2Games}${match.tiebreakScore ? ` (TB ${match.tiebreakScore})` : ''}`
                              : 'Sin resultado'
                            }
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {match.isConfirmed ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-xs text-green-600">Confirmado</span>
                              </>
                            ) : match.reportedById ? (
                              <>
                                <Clock className="h-4 w-4 text-yellow-600" />
                                <span className="text-xs text-yellow-600">Pendiente</span>
                              </>
                            ) : (
                              <>
                                <Calendar className="h-4 w-4 text-gray-600" />
                                <span className="text-xs text-gray-600">Sin reportar</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {!match.isConfirmed && (
                        <div className="mt-3 pt-3 border-t">
                          <Link href={`/match/${match.id}`}>
                            <Button className="w-full">
                              {match.reportedById ? 'Ver/Confirmar Set' : 'Reportar Resultado del Set'}
                            </Button>
                          </Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="group" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Grupo {data.currentGroup?.number} - Nivel {data.currentGroup?.level}
              </h2>
              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground">
                Ronda {data.activeTournament.currentRound}
              </div>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {data.currentGroup?.players
                    ?.sort((a, b) => a.position - b.position)
                    ?.map((player, index) => (
                    <div key={player.id} className={`flex items-center justify-between p-3 rounded-lg ${
                      player.id === session?.user?.playerId 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {player.position}
                        </div>
                        <span className={`font-medium ${
                          player.id === session?.user?.playerId ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {player.name}
                          {player.id === session?.user?.playerId && ' (Tú)'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{player.points.toFixed(1)} pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ranking" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Ranking Oficial
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Posición:</span>
                    <span className="font-bold">#{data.ranking?.position || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Media:</span>
                    <span className="font-bold">{data.ranking?.averagePoints?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rondas:</span>
                    <span className="font-bold">{data.ranking?.roundsPlayed || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    Ranking Ironman
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Posición:</span>
                    <span className="font-bold">#{data.ranking?.ironmanPosition || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-bold">{data.ranking?.totalPoints?.toFixed(1) || '0.0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Racha:</span>
                    <span className="font-bold">{data.stats.currentStreak}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}