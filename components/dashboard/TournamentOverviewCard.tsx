// components/dashboard/TournamentOverviewCard.tsx - MEJORADO
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Users,
  Clock,
  CheckCircle,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Crown,
  Medal,
  Star,
  Target,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Flame,
  ArrowUp,
  ArrowDown,
  Activity,
  Eye,
  EyeOff,
} from "lucide-react";

// Tipos
type PlayerMovement = {
  type: 'up' | 'down' | 'same';
  groups: number;
  description: string;
};

type PlayerInGroup = {
  playerId: string;
  name: string;
  position: number;
  points: number;
  streak: number;
  setsWon: number;
  gamesWon: number;
  gamesLost: number;
  h2hWins: number;
  isCurrentUser: boolean;
  movement: PlayerMovement;
};

type MatchResult = {
  id: string;
  setNumber: number;
  team1Player1Id: string;
  team1Player2Id: string;
  team2Player1Id: string;
  team2Player2Id: string;
  team1Games: number | null;
  team2Games: number | null;
  tiebreakScore: string | null;
  isConfirmed: boolean;
  status: string;
};

type GroupOverview = {
  groupId: string;
  groupNumber: number;
  level: number;
  players: PlayerInGroup[];
  matches: MatchResult[];
  scheduleStatus: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED";
  scheduledDate: string | null;
  completedSets: number;
  totalSets: number;
  needsAction: boolean;
  completionPercentage: number;
};

type TournamentOverviewData = {
  tournamentId: string;
  tournamentTitle: string;
  currentRound: number;
  totalRounds: number;
  groups: GroupOverview[];
  userCurrentGroupId?: string;
  stats: {
    totalGroups: number;
    scheduledGroups: number;
    completedGroups: number;
    userPendingActions: number;
    averageCompletion: number;
  };
};

type Props = {
  tournamentId?: string;
  currentUserId?: string;
  compact?: boolean;
  showOnlyUserGroup?: boolean;
  refreshTrigger?: number;
};

// Helpers
const getGroupLevelInfo = (level: number) => {
  switch (level) {
    case 1:
      return {
        name: "Elite",
        color: "bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-900 border-yellow-300",
        icon: Crown,
        accent: "border-l-yellow-500"
      };
    case 2:
      return {
        name: "Alto",
        color: "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-900 border-blue-300",
        icon: Trophy,
        accent: "border-l-blue-500"
      };
    case 3:
      return {
        name: "Medio-Alto",
        color: "bg-gradient-to-r from-green-100 to-emerald-100 text-green-900 border-green-300",
        icon: Medal,
        accent: "border-l-green-500"
      };
    case 4:
      return {
        name: "Medio",
        color: "bg-gradient-to-r from-purple-100 to-violet-100 text-purple-900 border-purple-300",
        icon: Star,
        accent: "border-l-purple-500"
      };
    default:
      return {
        name: level > 4 ? "Desarrollo" : "Intermedio",
        color: "bg-gradient-to-r from-gray-100 to-slate-100 text-slate-900 border-slate-300",
        icon: Target,
        accent: "border-l-slate-500"
      };
  }
};

const getStatusInfo = (status: string) => {
  switch (status) {
    case "COMPLETED":
      return {
        label: "Completado",
        color: "bg-green-100 text-green-800 border-green-300",
        icon: CheckCircle
      };
    case "SCHEDULED":
      return {
        label: "Programado",
        color: "bg-blue-100 text-blue-800 border-blue-300",
        icon: Calendar
      };
    case "DATE_PROPOSED":
      return {
        label: "Fecha Propuesta",
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        icon: Clock
      };
    default:
      return {
        label: "Pendiente",
        color: "bg-gray-100 text-gray-800 border-gray-300",
        icon: Clock
      };
  }
};

const getMovementIcon = (movement: PlayerMovement) => {
  switch (movement.type) {
    case 'up':
      return <ArrowUp className="w-4 h-4 text-green-600" />;
    case 'down':
      return <ArrowDown className="w-4 h-4 text-red-600" />;
    default:
      return <Minus className="w-4 h-4 text-blue-600" />;
  }
};

const getMovementColor = (movement: PlayerMovement) => {
  switch (movement.type) {
    case 'up':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'down':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-blue-600 bg-blue-50 border-blue-200';
  }
};

export default function TournamentOverviewCard({
  tournamentId,
  currentUserId,
  compact = false,
  showOnlyUserGroup = false,
  refreshTrigger = 0
}: Props) {
  const [data, setData] = useState<TournamentOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllGroups, setShowAllGroups] = useState(!compact);
  const [showMovementDetails, setShowMovementDetails] = useState(!compact);
  
  const fetchData = useCallback(async () => {
    if (!tournamentId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/overview`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Error cargando datos del torneo');
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-600">Cargando vista del torneo...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-gray-500">
            No hay datos del torneo disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  const userGroup = data.groups.find(g => g.groupId === data.userCurrentGroupId);
  const groupsToShow = showOnlyUserGroup && userGroup ? [userGroup] : data.groups;
  const visibleGroups = showAllGroups ? groupsToShow : groupsToShow.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-blue-600" />
              {data.tournamentTitle} - Ronda {data.currentRound}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMovementDetails(!showMovementDetails)}
                className="flex items-center gap-1"
              >
                {showMovementDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">Movimientos</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{data.stats.totalGroups}</div>
              <div className="text-sm text-gray-600">Grupos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data.stats.completedGroups}</div>
              <div className="text-sm text-gray-600">Completados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{data.stats.scheduledGroups}</div>
              <div className="text-sm text-gray-600">Programados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{data.stats.userPendingActions}</div>
              <div className="text-sm text-gray-600">Tus Pendientes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{data.stats.averageCompletion}%</div>
              <div className="text-sm text-gray-600">Progreso</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grupos */}
      <div className="space-y-4">
        {visibleGroups.map((group) => {
          const levelInfo = getGroupLevelInfo(group.level);
          const statusInfo = getStatusInfo(group.scheduleStatus);
          const LevelIcon = levelInfo.icon;
          const StatusIcon = statusInfo.icon;
          const isUserGroup = group.groupId === data.userCurrentGroupId;

          return (
            <Card 
              key={group.groupId} 
              className={`${levelInfo.color} border-2 ${isUserGroup ? 'ring-2 ring-blue-300 shadow-lg' : ''} relative overflow-hidden`}
            >
              {/* Indicador visual de nivel */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${levelInfo.accent}`}></div>
              
              {/* Badge de grupo del usuario */}
              {isUserGroup && (
                <div className="absolute top-2 right-2">
                  <Badge className="bg-blue-600 text-white">Tu Grupo</Badge>
                </div>
              )}

              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <LevelIcon className="w-5 h-5" />
                    <span>Grupo {group.groupNumber}</span>
                    <span className="text-sm opacity-75">- {levelInfo.name}</span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={`${statusInfo.color} border text-xs flex items-center gap-1`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-white/60">
                      {group.completedSets}/{group.totalSets} sets
                    </Badge>
                  </div>
                </div>
                
                {/* Barra de progreso */}
                <div className="w-full bg-white/50 rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full bg-white/90"
                    style={{ width: `${group.completionPercentage}%` }}
                  />
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-3">
                  {group.players.map((player, index) => (
                    <div
                      key={player.playerId}
                      className={`group flex items-center justify-between p-3 rounded-lg border-2 transition-all hover:shadow-sm ${
                        player.isCurrentUser
                          ? 'bg-white/95 border-indigo-300 ring-1 ring-indigo-200'
                          : 'bg-white/70 border-white/60 hover:bg-white/85'
                      }`}
                    >
                      {/* Información del jugador */}
                      <div className="flex items-center gap-3 flex-1">
                        {/* Posición */}
                        <div
                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm shadow-sm ${
                            player.position === 1
                              ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-400'
                              : player.position === 2
                              ? 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 border-gray-400'
                              : player.position === 3
                              ? 'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700 border-orange-400'
                              : 'bg-gradient-to-br from-red-100 to-red-200 text-red-700 border-red-400'
                          }`}
                        >
                          {player.position === 1 ? '🥇' : 
                           player.position === 2 ? '🥈' : 
                           player.position === 3 ? '🥉' : 
                           `#${player.position}`}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-medium ${player.isCurrentUser ? 'font-bold' : ''}`}>
                              {player.name}
                              {player.isCurrentUser && (
                                <span className="text-blue-600 text-sm ml-2">(Tú)</span>
                              )}
                            </span>
                            {player.streak > 0 && (
                              <div className="flex items-center gap-1 bg-orange-100 px-2 py-0.5 rounded-full">
                                <Flame className="w-3 h-3 text-orange-500" />
                                <span className="text-xs text-orange-600 font-medium">{player.streak}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span className="font-medium">{player.points.toFixed(1)} pts</span>
                            {!compact && (
                              <>
                                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                                  {player.setsWon} sets
                                </span>
                                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                                  {player.gamesWon}-{player.gamesLost} juegos
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Movimiento predicho */}
                      {showMovementDetails && (
                        <div className={`text-right p-2 rounded-lg border ${getMovementColor(player.movement)} min-w-[120px]`}>
                          <div className="flex items-center gap-1 justify-end mb-1">
                            {getMovementIcon(player.movement)}
                            <span className="text-sm font-medium">
                              {player.movement.groups > 0 
                                ? `${player.movement.type === 'up' ? 'Sube' : 'Baja'} ${player.movement.groups}`
                                : 'Mantiene'
                              }
                            </span>
                          </div>
                          <div className="text-xs opacity-75">
                            {player.movement.groups === 2 ? 'Doble salto' : 
                             player.movement.groups === 1 ? 'Un grupo' : 
                             'Mismo nivel'}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Acciones del grupo */}
                {group.needsAction && isUserGroup && (
                  <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">
                        Tienes acciones pendientes en este grupo
                      </span>
                    </div>
                  </div>
                )}

                {group.scheduledDate && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-800">
                        Programado: {new Date(group.scheduledDate).toLocaleDateString('es-ES', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                )}

                {/* Confirmed Match Results */}
                {group.matches && group.matches.some(m => m.isConfirmed) && (
                  <div className="mt-4">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Resultados Confirmados
                    </h4>
                    <div className="space-y-2">
                      {group.matches
                        .filter(match => match.isConfirmed && match.team1Games !== null && match.team2Games !== null)
                        .map(match => {
                          const team1Player1 = group.players.find(p => p.playerId === match.team1Player1Id);
                          const team1Player2 = group.players.find(p => p.playerId === match.team1Player2Id);
                          const team2Player1 = group.players.find(p => p.playerId === match.team2Player1Id);
                          const team2Player2 = group.players.find(p => p.playerId === match.team2Player2Id);

                          const team1Won = (match.team1Games || 0) > (match.team2Games || 0);

                          return (
                            <div
                              key={match.id}
                              className="p-3 bg-white/90 border border-gray-200 rounded-lg text-sm"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-500 font-medium">Set {match.setNumber}</span>
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Confirmado
                                </Badge>
                              </div>

                              <div className="space-y-2">
                                {/* Team 1 */}
                                <div className={`flex items-center justify-between p-2 rounded ${
                                  team1Won ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                                }`}>
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900">
                                      {team1Player1?.name || 'Jugador'} / {team1Player2?.name || 'Jugador'}
                                    </div>
                                  </div>
                                  <div className={`text-lg font-bold px-3 ${team1Won ? 'text-green-700' : 'text-gray-600'}`}>
                                    {match.team1Games}
                                  </div>
                                </div>

                                {/* Team 2 */}
                                <div className={`flex items-center justify-between p-2 rounded ${
                                  !team1Won ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                                }`}>
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900">
                                      {team2Player1?.name || 'Jugador'} / {team2Player2?.name || 'Jugador'}
                                    </div>
                                  </div>
                                  <div className={`text-lg font-bold px-3 ${!team1Won ? 'text-green-700' : 'text-gray-600'}`}>
                                    {match.team2Games}
                                  </div>
                                </div>
                              </div>

                              {/* Tiebreak score if exists */}
                              {match.tiebreakScore && (
                                <div className="mt-2 text-xs text-gray-600 text-center">
                                  Tiebreak: {match.tiebreakScore}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Botón para mostrar más grupos */}
        {!showAllGroups && groupsToShow.length > 6 && (
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => setShowAllGroups(true)}
              className="flex items-center gap-2"
            >
              <ChevronDown className="w-4 h-4" />
              Mostrar {groupsToShow.length - 6} grupos más
            </Button>
          </div>
        )}

        {showAllGroups && groupsToShow.length > 6 && (
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => setShowAllGroups(false)}
              className="flex items-center gap-2"
            >
              <ChevronUp className="w-4 h-4" />
              Mostrar menos grupos
            </Button>
          </div>
        )}
      </div>

      {/* Leyenda de movimientos */}
      {showMovementDetails && (
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Leyenda de Movimientos de Escalera
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <ArrowUp className="w-4 h-4 text-green-600" />
                <span><strong>Sube:</strong> 1° lugar (2 grupos), 2° lugar (1 grupo)</span>
              </div>
              <div className="flex items-center gap-2">
                <Minus className="w-4 h-4 text-blue-600" />
                <span><strong>Mantiene:</strong> Grupos límite conservan posición</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowDown className="w-4 h-4 text-red-600" />
                <span><strong>Baja:</strong> 3° lugar (1 grupo), 4° lugar (2 grupos)</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              * Los movimientos se aplican al cerrar la ronda. Empates se resuelven por: puntos → sets → diferencia de juegos → head-to-head.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}