// app/dashboard/PlayerDashboardClient.tsx - VERSIÓN MEJORADA
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
  ListChecks,
  ArrowUp,
  ArrowDown,
  Minus,
  Star,
  Flame
} from "lucide-react";
import Link from "next/link";

// Tipos actuales mantenidos...
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

// Datos de preview para cuando no hay torneo activo
const PREVIEW_DATA: PlayerDashboardData = {
  activeTournament: {
    id: "preview",
    title: "Torneo Escalera Primavera 2025",
    currentRound: 2,
    totalRounds: 8,
    roundEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  currentGroup: {
    id: "preview-group",
    number: 2,
    level: 2,
    position: 1,
    points: 8.5,
    streak: 2,
    players: [
      { id: "preview-you", name: "Tu Nombre", position: 1, points: 8.5 },
      { id: "preview-2", name: "Ana García", position: 2, points: 7.2 },
      { id: "preview-3", name: "Miguel López", position: 3, points: 6.8 },
      { id: "preview-4", name: "Laura Rodríguez", position: 4, points: 5.1 }
    ]
  },
  myMatches: [
    {
      id: "preview-match-1",
      setNumber: 1,
      team1Player1Name: "Tu Nombre",
      team1Player2Name: "Laura Rodríguez",
      team2Player1Name: "Ana García", 
      team2Player2Name: "Miguel López",
      team1Games: 4,
      team2Games: 2,
      tiebreakScore: null,
      isConfirmed: true,
      reportedById: "preview-you",
      groupNumber: 2
    },
    {
      id: "preview-match-2",
      setNumber: 2,
      team1Player1Name: "Tu Nombre",
      team1Player2Name: "Miguel López",
      team2Player1Name: "Ana García",
      team2Player2Name: "Laura Rodríguez",
      team1Games: 5,
      team2Games: 4,
      tiebreakScore: "7-5",
      isConfirmed: false,
      reportedById: "preview-you",
      groupNumber: 2
    },
    {
      id: "preview-match-3",
      setNumber: 3,
      team1Player1Name: "Tu Nombre",
      team1Player2Name: "Ana García",
      team2Player1Name: "Miguel López",
      team2Player2Name: "Laura Rodríguez",
      team1Games: null,
      team2Games: null,
      tiebreakScore: null,
      isConfirmed: false,
      reportedById: null,
      groupNumber: 2
    }
  ],
  ranking: {
    position: 2,
    averagePoints: 8.50,
    totalPoints: 42.5,
    roundsPlayed: 5,
    ironmanPosition: 2
  },
  stats: {
    matchesPlayed: 2,
    matchesPending: 1,
    winRate: 75,
    currentStreak: 2
  }
};

export default function PlayerDashboardClient() {
  const { data: session } = useSession();
  const [data, setData] = useState<PlayerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/player/dashboard');
      if (response.ok) {
        const dashboardData = await response.json();
        if (!dashboardData.activeTournament) {
          setData(PREVIEW_DATA);
          setIsPreviewMode(true);
        } else {
          setData(dashboardData);
          setIsPreviewMode(false);
        }
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

  // Funciones auxiliares
  const getMovementIcon = (position: number) => {
    if (position === 1) return <ArrowUp className="w-4 h-4 text-green-600" />;
    if (position === 4) return <ArrowDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-blue-600" />;
  };

  const getGroupLevelColor = (level: number) => {
    switch (level) {
      case 1: return "bg-yellow-100 border-yellow-200 text-yellow-800";
      case 2: return "bg-gray-100 border-gray-200 text-gray-700";
      case 3: return "bg-orange-100 border-orange-200 text-orange-700";
      default: return "bg-blue-100 border-blue-200 text-blue-700";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-6xl">
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
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center py-20">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchDashboardData}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const daysUntilRoundEnd = Math.ceil(
    (new Date(data.activeTournament!.roundEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className={`min-h-screen bg-gray-50 py-12 ${isPreviewMode ? 'opacity-75' : ''}`}>
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Header con indicador de preview */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Hola, {session?.user?.name ?? session?.user?.email}
              </h1>
              <p className="text-gray-600">
                {data.activeTournament!.title} - Ronda {data.activeTournament!.currentRound} de {data.activeTournament!.totalRounds}
              </p>
            </div>
            {isPreviewMode && (
              <div className="text-right">
                <Badge variant="secondary" className="mb-2">
                  Vista Previa
                </Badge>
                <p className="text-sm text-gray-500">
                  Datos de ejemplo. Únete a un torneo para ver tus datos reales.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Alert de tiempo restante */}
        {!isPreviewMode && daysUntilRoundEnd <= 3 && daysUntilRoundEnd > 0 && (
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

        {/* Stats principales mejoradas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Mi Posición</p>
                  <p className="text-2xl font-bold flex items-center gap-2">
                    #{data.currentGroup?.position || '-'}
                    {data.currentGroup?.position && getMovementIcon(data.currentGroup.position)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Grupo {data.currentGroup?.number || '-'}
                  </p>
                </div>
                <div className="relative">
                  <Target className="h-8 w-8 text-blue-500" />
                  {data.currentGroup?.position === 1 && (
                    <Star className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1" />
                  )}
                </div>
              </div>
              {data.currentGroup?.position === 1 && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-yellow-200 to-yellow-300 rounded-full opacity-20 transform translate-x-4 -translate-y-4"></div>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Mis Puntos</p>
                  <p className="text-2xl font-bold flex items-center gap-2">
                    {data.currentGroup?.points?.toFixed(1) || '0.0'}
                    {data.currentGroup?.streak && data.currentGroup.streak > 0 && (
                      <Flame className="h-5 w-5 text-orange-500" />
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {data.currentGroup?.streak && data.currentGroup.streak > 0 
                      ? `Racha: ${data.currentGroup.streak}`
                      : 'Sin racha'
                    }
                  </p>
                </div>
                <Trophy className="h-8 w-8 text-yellow-500" />
              </div>
              {data.currentGroup?.streak && data.currentGroup.streak > 0 && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-orange-200 to-orange-300 rounded-full opacity-20 transform translate-x-4 -translate-y-4"></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ranking General</p>
                  <p className="text-2xl font-bold">
                    #{data.ranking?.position || '-'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Media: {data.ranking?.averagePoints?.toFixed(2) || '0.00'}
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
                    {data.stats.matchesPlayed}/{data.stats.matchesPlayed + data.stats.matchesPending}
                  </p>
                  <p className="text-xs text-gray-500">
                    {data.stats.winRate}% victoria
                  </p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview de grupo actual */}
        <Card className={`mb-8 ${getGroupLevelColor(data.currentGroup?.level || 2)} border-2`}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                Mi Grupo {data.currentGroup?.number} - Nivel {data.currentGroup?.level}
              </span>
              <Badge variant="outline">
                Ronda {data.activeTournament!.currentRound}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.currentGroup?.players
                ?.sort((a, b) => a.position - b.position)
                ?.map((player) => (
                <div 
                  key={player.id} 
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    player.name === 'Tu Nombre' || player.id === session?.user?.playerId
                      ? 'bg-white/70 border-2 border-blue-300 shadow-md' 
                      : 'bg-white/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                      player.position === 1 ? 'bg-yellow-200 text-yellow-800' :
                      player.position === 2 ? 'bg-gray-200 text-gray-700' :
                      player.position === 3 ? 'bg-orange-200 text-orange-700' :
                      'bg-red-200 text-red-700'
                    }`}>
                      {player.position === 1 ? '🥇' : 
                       player.position === 2 ? '🥈' :
                       player.position === 3 ? '🥉' : player.position}
                    </div>
                    <div>
                      <div className="font-bold text-lg">
                        {player.name}
                        {(player.name === 'Tu Nombre' || player.id === session?.user?.playerId) && 
                          <span className="text-blue-600 text-sm ml-2">(Tú)</span>
                        }
                      </div>
                      <div className="text-sm opacity-75">{player.points} pts</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getMovementIcon(player.position)}
                    <span className="text-sm font-medium">
                      {player.position === 1 ? 'Sube' : 
                       player.position === 4 ? 'Baja' : 'Se mantiene'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Resto del contenido existente en tabs... */}
        <Tabs defaultValue="matches" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="matches">Mis Sets ({data.stats.matchesPending})</TabsTrigger>
            <TabsTrigger value="group">Mi Grupo</TabsTrigger>
            <TabsTrigger value="ranking">Clasificación</TabsTrigger>
          </TabsList>

          <TabsContent value="matches" className="space-y-4">
            {/* Contenido existente de matches... */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Sets de Esta Ronda</h2>
              <div className="flex gap-2">
                <Badge variant={data.stats.matchesPending > 0 ? "destructive" : "default"}>
                  {data.stats.matchesPending} pendientes
                </Badge>
                <Badge variant="outline">
                  {data.stats.matchesPlayed} completados
                </Badge>
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
                  <Card key={match.id} className={`${isPreviewMode ? 'opacity-70' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium mb-1 flex items-center gap-2">
                            Set {match.setNumber}
                            <Badge variant="outline">
                              {match.isConfirmed ? 'Confirmado' : 
                               match.reportedById ? 'Pendiente' : 'Sin resultado'}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            <div className="font-medium text-blue-700">
                              {match.team1Player1Name} + {match.team1Player2Name}
                            </div>
                            <div className="text-center text-xs text-gray-400 my-1">vs</div>
                            <div className="font-medium text-red-700">
                              {match.team2Player1Name} + {match.team2Player2Name}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-2xl">
                            {match.team1Games !== null && match.team2Games !== null
                              ? `${match.team1Games}-${match.team2Games}${match.tiebreakScore ? ` (TB ${match.tiebreakScore})` : ''}`
                              : '-'
                            }
                          </div>
                          <div className="flex items-center gap-1 mt-1 justify-end">
                            {match.isConfirmed ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : match.reportedById ? (
                              <Clock className="h-4 w-4 text-yellow-600" />
                            ) : (
                              <Calendar className="h-4 w-4 text-gray-600" />
                            )}
                          </div>
                        </div>
                      </div>
                      {!match.isConfirmed && !isPreviewMode && (
                        <div className="mt-3 pt-3 border-t">
                          <Link href={`/match/${match.id}`}>
                            <Button className="w-full">
                              {match.reportedById ? 'Ver/Confirmar Set' : 'Reportar Resultado del Set'}
                            </Button>
                          </Link>
                        </div>
                      )}
                      {isPreviewMode && !match.isConfirmed && (
                        <div className="mt-3 pt-3 border-t">
                          <Button className="w-full" disabled>
                            {match.reportedById ? 'Ver/Confirmar Set' : 'Reportar Resultado del Set'}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Resto de tabs existentes... */}
          <TabsContent value="group" className="space-y-4">
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Vista detallada del grupo disponible en "Mi Grupo"</p>
              <Link href="/mi-grupo">
                <Button>Ver Mi Grupo</Button>
              </Link>
            </div>
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
            <div className="text-center mt-6">
              <Link href="/clasificaciones">
                <Button>Ver Clasificaciones Completas</Button>
              </Link>
            </div>
          </TabsContent>
        </Tabs>

        {/* Call to action para modo preview */}
        {isPreviewMode && (
          <Card className="mt-8 border-dashed border-2 border-blue-300 bg-blue-50">
            <CardContent className="p-8 text-center">
              <Trophy className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-blue-900 mb-2">
                ¡Únete a un Torneo Real!
              </h3>
              <p className="text-blue-700 mb-6">
                Estos son datos de ejemplo. Contacta con el administrador para participar en un torneo y ver tus estadísticas reales.
              </p>
              <Button variant="default">
                Contactar Administrador
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}