// app/grupo/[id]/GroupDetailClient.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Trophy,
  Star,
  Medal,
  Target,
  Crown,
  CheckCircle,
  Play,
  ArrowLeft,
  Calendar,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertTriangle,
  Clock,
  Award,
  Flame,
  Info,
  Eye,
  Settings,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { LoadingState, ErrorState } from "@/components/ApiStateComponents";
import PartyScheduling from "@/components/PartyScheduling";

interface Player {
  id: string;
  name: string;
  points: number;
  position: number;
  isCurrentUser: boolean;
  streak?: number;
  sets?: number;
  games?: number;
  gamesLost?: number;
  setsWon?: number;
}

interface Match {
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
  hasResult: boolean;
  status: string;
}

interface GroupData {
  id: string;
  number: number;
  level: string;
  roundNumber: number;
  tournamentTitle: string;
  tournamentId: string;
  players: Player[];
  matches: Match[];
  party?: {
    groupId: string;
    totalSets: number;
    completedSets: number;
  };
  stats: {
    totalPlayers: number;
    completedSets: number;
    totalSets: number;
    progress: number;
  };
}

function useGroupDetail(groupId: string) {
  const [data, setData] = useState<GroupData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/groups/${groupId}/stats`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Grupo no encontrado");
        }
        if (response.status === 403) {
          throw new Error("No tienes acceso a este grupo");
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error("Error fetching group data:", err);
      setError(err.message || "Error al cargar los datos del grupo");
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  const retry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, retry };
}

function getGroupLevelInfo(groupNumber: number, groupLevel?: string) {
  const level = parseInt(groupLevel || (groupNumber || 1).toString());
  
  switch (level) {
    case 1:
      return {
        level: "Elite",
        color: "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-900 border-yellow-300",
        icon: Crown,
        gradient: "from-yellow-50 to-amber-100",
        description: "Nivel élite de la escalera - Los mejores jugadores",
        accent: "border-l-yellow-500"
      };
    case 2:
      return {
        level: "Alto",
        color: "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-900 border-blue-300",
        icon: Trophy,
        gradient: "from-blue-50 to-indigo-100",
        description: "Nivel alto - Aspirantes al grupo élite",
        accent: "border-l-blue-500"
      };
    case 3:
      return {
        level: "Medio-Alto",
        color: "bg-gradient-to-r from-green-100 to-green-200 text-green-900 border-green-300",
        icon: Medal,
        gradient: "from-green-50 to-emerald-100",
        description: "Nivel medio-alto - Jugadores en progreso",
        accent: "border-l-green-500"
      };
    case 4:
      return {
        level: "Medio",
        color: "bg-gradient-to-r from-purple-100 to-purple-200 text-purple-900 border-purple-300",
        icon: Star,
        gradient: "from-purple-50 to-violet-100",
        description: "Nivel medio - Núcleo del torneo",
        accent: "border-l-purple-500"
      };
    default:
      return {
        level: level > 4 ? "En Desarrollo" : "Intermedio",
        color: "bg-gradient-to-r from-gray-100 to-slate-200 text-slate-900 border-slate-300",
        icon: Target,
        gradient: "from-slate-50 to-gray-100",
        description: level > 4 ? "Nivel de desarrollo - Forjando el futuro" : "Nivel intermedio",
        accent: "border-l-slate-500"
      };
  }
}

function calculateMovement(position: number, groupNumber: number, totalGroups: number = 10) {
  const isTopGroup = groupNumber === 1;
  const isBottomGroup = groupNumber === totalGroups;
  const isSecondGroup = groupNumber === 2;
  const isPenultimateGroup = groupNumber === totalGroups - 1;

  if (position === 1) {
    if (isTopGroup) {
      return {
        icon: <Crown className="w-4 h-4 text-yellow-600" />,
        text: "Se mantiene en el grupo élite",
        color: "text-yellow-600",
        bgColor: "bg-yellow-50 border-yellow-200",
        type: "maintain"
      };
    } else if (isSecondGroup) {
      return {
        icon: <TrendingUp className="w-4 h-4 text-green-600" />,
        text: "Sube al grupo élite",
        color: "text-green-600",
        bgColor: "bg-green-50 border-green-200",
        type: "up"
      };
    } else {
      return {
        icon: <TrendingUp className="w-4 h-4 text-green-600" />,
        text: "Sube 2 grupos",
        color: "text-green-600",
        bgColor: "bg-green-50 border-green-200",
        type: "up"
      };
    }
  } else if (position === 2) {
    return {
      icon: <TrendingUp className="w-4 h-4 text-green-600" />,
      text: "Sube 1 grupo",
      color: "text-green-600",
      bgColor: "bg-green-50 border-green-200",
      type: "up"
    };
  } else if (position === 3) {
    if (isBottomGroup) {
      return {
        icon: <Target className="w-4 h-4 text-blue-600" />,
        text: "Se mantiene",
        color: "text-blue-600",
        bgColor: "bg-blue-50 border-blue-200",
        type: "maintain"
      };
    } else {
      return {
        icon: <TrendingDown className="w-4 h-4 text-orange-600" />,
        text: "Baja 1 grupo",
        color: "text-orange-600",
        bgColor: "bg-orange-50 border-orange-200",
        type: "down"
      };
    }
  } else if (position === 4) {
    if (isBottomGroup) {
      return {
        icon: <Target className="w-4 h-4 text-blue-600" />,
        text: "Se mantiene",
        color: "text-blue-600",
        bgColor: "bg-blue-50 border-blue-200",
        type: "maintain"
      };
    } else if (isPenultimateGroup) {
      return {
        icon: <TrendingDown className="w-4 h-4 text-red-600" />,
        text: "Baja al grupo inferior",
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200",
        type: "down"
      };
    } else {
      return {
        icon: <TrendingDown className="w-4 h-4 text-red-600" />,
        text: "Baja 2 grupos",
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200",
        type: "down"
      };
    }
  }
  
  return {
    icon: <Minus className="w-4 h-4 text-gray-600" />,
    text: "Se mantiene",
    color: "text-gray-600",
    bgColor: "bg-gray-50 border-gray-200",
    type: "maintain"
  };
}

function getMatchStatusInfo(match: Match) {
  if (match.isConfirmed) {
    return {
      label: "Completado",
      color: "bg-green-100 text-green-700 border-green-200",
      icon: CheckCircle,
    };
  }
  if (match.hasResult) {
    return {
      label: "Por confirmar",
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      icon: Calendar,
    };
  }
  return {
    label: "Pendiente",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: Play,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export default function GroupDetailClient({ groupId }: { groupId: string }) {
  const { data: session, status: sessionStatus } = useSession();
  const { data, isLoading, error, retry } = useGroupDetail(groupId);

  const [showPartyScheduling, setShowPartyScheduling] = useState(false);
  const [showMatchDetails, setShowMatchDetails] = useState(true);
  const [showMovementInfo, setShowMovementInfo] = useState(false);

  const handlePartyUpdate = useCallback(() => {
    retry();
  }, [retry]);

  if (sessionStatus === "loading") {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <LoadingState message="Verificando autenticación..." />
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <ErrorState 
          error="Debes iniciar sesión para ver los detalles del grupo" 
          onRetry={() => window.location.href = "/auth/login"} 
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <LoadingState message="Cargando información del grupo..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <ErrorState error={error || "No se pudo cargar la información del grupo"} onRetry={retry} />
      </div>
    );
  }

  const groupInfo = getGroupLevelInfo(data.number || 1, data.level);
  const GroupIcon = groupInfo.icon;
  const currentUser = data.players.find(p => p.isCurrentUser);
  const currentUserId = currentUser?.id || session?.user?.id || "";

  // Ordenar jugadores por puntos con criterios de desempate
  const sortedPlayers = data.players ? [...data.players].sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    
    const aSetsWon = a.setsWon || a.sets || 0;
    const bSetsWon = b.setsWon || b.sets || 0;
    if (aSetsWon !== bSetsWon) return bSetsWon - aSetsWon;
    
    const aGames = a.games || 0;
    const bGames = b.games || 0;
    const aGamesLost = a.gamesLost || 0;
    const bGamesLost = b.gamesLost || 0;
    const aDiff = aGames - aGamesLost;
    const bDiff = bGames - bGamesLost;
    if (aDiff !== bDiff) return bDiff - aDiff;
    
    if (aGames !== bGames) return bGames - aGames;
    
    return 0;
  }) : [];

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/mi-grupo">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Mi Grupo
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GroupIcon className="w-8 h-8" />
            Grupo {data.number || 'Sin asignar'} - {groupInfo.level}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-gray-600">
              {data.tournamentTitle} - Ronda {data.roundNumber}
            </p>
            <Badge variant="outline" className="text-xs">
              {data.stats?.progress || 0}% completado
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {data.party?.groupId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPartyScheduling(!showPartyScheduling)}
              className="flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Programar Partidos</span>
              {showPartyScheduling ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMovementInfo(!showMovementInfo)}
            className="flex items-center gap-2"
          >
            <Info className="w-4 h-4" />
            <span className="hidden sm:inline">Movimientos</span>
            {showMovementInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={retry}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
        </div>
      </div>

      {/* Información de movimientos */}
      {showMovementInfo && (
        <Card className="bg-blue-50 border border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900 text-lg">
              <Info className="w-5 h-5" />
              Sistema de Movimientos en la Escalera
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium text-green-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Ascensos
                </h4>
                <ul className="text-green-700 space-y-1">
                  <li>• 1° lugar: Sube 2 grupos (excepto desde grupo 2 al élite)</li>
                  <li>• 2° lugar: Sube 1 grupo</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-blue-800 flex items-center gap-2">
                  <Minus className="w-4 h-4" />
                  Permanencia
                </h4>
                <ul className="text-blue-700 space-y-1">
                  <li>• Grupo élite: 1° y 2° se mantienen</li>
                  <li>• Grupo inferior: 3° y 4° se mantienen</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-red-800 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Descensos
                </h4>
                <ul className="text-red-700 space-y-1">
                  <li>• 3° lugar: Baja 1 grupo</li>
                  <li>• 4° lugar: Baja 2 grupos (excepto desde penúltimo al inferior)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Programación de partidos */}
      {showPartyScheduling && data.party?.groupId && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Calendar className="w-5 h-5" />
              Programar Partido Completo
            </CardTitle>
            <p className="text-sm text-blue-700">
              Coordina una fecha para los 3 sets. Todos los jugadores deben confirmar.
            </p>
          </CardHeader>
          <CardContent>
            <PartyScheduling
              groupId={data.party.groupId}
              currentUserId={currentUserId}
              isParticipant={!!currentUser}
              onUpdate={handlePartyUpdate}
              enableRefresh={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Información del grupo */}
      <Card className={`${groupInfo.color} border-2 bg-gradient-to-br ${groupInfo.gradient} shadow-lg relative overflow-hidden`}>
        <div className={`absolute left-0 top-0 bottom-0 w-2 ${groupInfo.accent}`}></div>
        <div className="absolute top-4 right-4 opacity-20">
          <GroupIcon className="w-16 h-16" />
        </div>
        
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <GroupIcon className="w-6 h-6" />
              Grupo {data.number || 'Sin asignar'} - {groupInfo.level}
            </CardTitle>
            <div className="text-right">
              <Badge variant="outline" className="mb-2 bg-white/80">
                {data.stats?.totalPlayers || 0} jugadores
              </Badge>
              <div className="text-sm opacity-75 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>{data.stats?.completedSets || 0}/{data.stats?.totalSets || 0} sets</span>
                </div>
                <div className="text-xs bg-white/60 px-2 py-1 rounded">
                  {data.stats?.progress || 0}%
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm opacity-80">{groupInfo.description}</p>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {/* Jugadores del grupo */}
            {sortedPlayers.map((player, index) => {
              const position = index + 1;
              const movement = calculateMovement(position, data.number || 1);
              
              return (
                <div
                  key={player.id}
                  className={`group relative flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${
                    player.isCurrentUser 
                      ? "bg-white/95 border-indigo-300 shadow-md ring-2 ring-indigo-200/50" 
                      : "bg-white/70 border-white/60 hover:bg-white/85"
                  }`}
                >
                  {/* Indicador de movimiento */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-r-full transition-all duration-200 ${
                    movement.type === 'up' ? 'bg-gradient-to-b from-green-400 to-green-600' :
                    movement.type === 'down' ? 'bg-gradient-to-b from-red-400 to-red-600' :
                    'bg-gradient-to-b from-blue-400 to-blue-600'
                  }`}></div>

                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`relative w-14 h-14 rounded-full border-3 flex items-center justify-center font-bold text-lg shadow-sm transition-all duration-200 group-hover:scale-110 ${
                        position === 1
                          ? "bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-400 shadow-yellow-200"
                          : position === 2
                          ? "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 border-gray-400 shadow-gray-200"
                          : position === 3
                          ? "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700 border-orange-400 shadow-orange-200"
                          : "bg-gradient-to-br from-red-100 to-red-200 text-red-700 border-red-400 shadow-red-200"
                      }`}
                    >
                      {position === 1 ? "🥇" : 
                       position === 2 ? "🥈" : 
                       position === 3 ? "🥉" : 
                       `#${position}`}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg">
                          {player.name}
                          {player.isCurrentUser && <span className="text-blue-600 text-sm ml-2 font-normal">(Tú)</span>}
                        </span>
                        {player.streak && player.streak > 0 && (
                          <div className="flex items-center gap-1 bg-orange-100 px-2 py-1 rounded-full">
                            <Flame className="w-3 h-3 text-orange-500" />
                            <span className="text-xs text-orange-600 font-medium">{player.streak}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="font-medium">{round1(player.points)} puntos</span>
                        {player.sets !== undefined && (
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {player.sets} sets ganados
                          </span>
                        )}
                        {player.games !== undefined && (
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {player.games} juegos
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className={`text-right p-3 rounded-lg border ${movement.bgColor}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {movement.icon}
                      <span className={`text-sm font-medium ${movement.color}`}>
                        {movement.text}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Información de desempates */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-900 text-sm">Criterios de Desempate</span>
            </div>
            <div className="text-xs text-blue-700 space-y-1">
              <p>1. Puntos totales • 2. Sets ganados • 3. Diferencia de juegos • 4. Head-to-head • 5. Juegos ganados</p>
            </div>
          </div>

          {/* Sets de la ronda */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Sets de esta Ronda
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMatchDetails(!showMatchDetails)}
                  className="ml-2"
                >
                  {showMatchDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </h4>
              <Badge variant="outline" className="bg-white/60">
                {data.stats?.completedSets || 0} de {data.stats?.totalSets || 0} completados
              </Badge>
            </div>
            
            {showMatchDetails && (
              <div className="grid gap-3">
                {data.matches && data.matches.length > 0 ? data.matches.map((match) => {
                  const statusInfo = getMatchStatusInfo(match);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <div key={match.id} className="bg-white/80 border border-white/60 rounded-lg p-4 hover:bg-white/90 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                            {match.setNumber}
                          </div>
                          Set {match.setNumber}
                        </h5>
                        <Badge className={`${statusInfo.color} text-xs flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="font-medium">{match.team1Player1Name}</span>
                            {match.team1Player2Name && <span> + <span className="font-medium">{match.team1Player2Name}</span></span>}
                          </div>
                          <div className="text-xl font-bold text-blue-600">
                            {match.team1Games ?? '-'}
                          </div>
                        </div>
                        
                        <div className="text-center text-xs text-gray-500 py-1">
                          VS
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="font-medium">{match.team2Player1Name}</span>
                            {match.team2Player2Name && <span> + <span className="font-medium">{match.team2Player2Name}</span></span>}
                          </div>
                          <div className="text-xl font-bold text-blue-600">
                            {match.team2Games ?? '-'}
                          </div>
                        </div>
                        
                        {match.tiebreakScore && (
                          <div className="text-center text-sm text-blue-600 bg-blue-50 py-1 px-2 rounded">
                            Tie-break: {match.tiebreakScore}
                          </div>
                        )}
                      </div>
                      
                      {!match.isConfirmed && !match.hasResult && (
                        <div className="mt-3">
                          <Link href={`/match/${match.id}`}>
                            <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
                              <Play className="w-4 h-4 mr-2" />
                              Introducir Resultado
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <div className="text-center py-8 text-gray-500">
                    <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No hay sets programados para esta ronda</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats del grupo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users className="w-5 h-5 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">{data.stats?.totalPlayers || 0}</div>
            </div>
            <div className="text-sm text-gray-600">Jugadores</div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-green-500">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div className="text-2xl font-bold text-green-600">{data.stats?.completedSets || 0}</div>
            </div>
            <div className="text-sm text-gray-600">Sets Completados</div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-orange-500">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className="w-5 h-5 text-orange-600" />
              <div className="text-2xl font-bold text-orange-600">{(data.stats?.totalSets || 0) - (data.stats?.completedSets || 0)}</div>
            </div>
            <div className="text-sm text-gray-600">Sets Pendientes</div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-purple-500">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Award className="w-5 h-5 text-purple-600" />
              <div className="text-2xl font-bold text-purple-600">{data.stats?.progress || 0}%</div>
            </div>
            <div className="text-sm text-gray-600">Progreso</div>
          </CardContent>
        </Card>
      </div>

      {/* Enlaces rápidos */}
      <Card className="bg-gradient-to-r from-gray-50 to-slate-100 border-gray-200">
        <CardContent className="p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2 text-gray-800">
            <Info className="w-4 h-4" />
            Enlaces Rápidos
          </h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/clasificaciones">
              <Button variant="outline" size="sm" className="text-xs">
                <Trophy className="w-3 h-3 mr-1" />
                Ver Rankings Completos
              </Button>
            </Link>
            <Link href="/mi-grupo">
              <Button variant="outline" size="sm" className="text-xs">
                <Eye className="w-3 h-3 mr-1" />
                Mi Vista de Grupo
              </Button>
            </Link>
            <Link href={`/tournaments/${data.tournamentId}`}>
              <Button variant="outline" size="sm" className="text-xs">
                <Trophy className="w-3 h-3 mr-1" />
                Vista del Torneo
              </Button>
            </Link>
            {currentUser && (
              <Link href="/historial">
                <Button variant="outline" size="sm" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  Mi Historial
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}