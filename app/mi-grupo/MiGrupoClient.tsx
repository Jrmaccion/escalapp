// app/mi-grupo/MiGrupoClient.tsx - OPTIMIZADO CON LÓGICA MEJORADA DE MOVIMIENTOS
"use client";

import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  CheckCircle,
  Play,
  ArrowUp,
  ArrowDown,
  Target,
  Flame,
  RefreshCw,
  Crown,
  Star,
  AlertTriangle,
  Trophy,
  ChevronDown,
  Info,
  Settings,
  HelpCircle,
  Clock,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Medal,
  Award,
  Zap,
  Eye,
  EyeOff
} from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import UseComodinButton from "@/components/player/UseComodinButton";
import PartyScheduling from "@/components/PartyScheduling";
import PointsPreviewCard from "@/components/PointsPreviewCard";
import TournamentOverviewCard from "@/components/dashboard/TournamentOverviewCard";
import { LoadingState, ErrorState, EmptyState, UpdateBadge } from "@/components/ApiStateComponents";

// Hook personalizado optimizado
function useGroupDataWithTournament(tournamentId?: string) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUpdates, setHasUpdates] = useState(false);

  const isMountedRef = useRef(true);
  const lastDataRef = useRef<string>("");

  const fetchData = useCallback(
    async (silent = false) => {
      if (!isMountedRef.current) return;

      console.log("🚀 Fetch group data optimizado", { tournamentId, silent });

      if (!silent) {
        setIsLoading(true);
        setHasError(false);
        setError(null);
      }

      try {
        const url = tournamentId
          ? `/api/player/group?tournamentId=${tournamentId}`
          : "/api/player/group";

        const response = await fetch(url, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!isMountedRef.current) return;

        const resultStr = JSON.stringify(result);
        const hasChanges = Boolean(silent && lastDataRef.current && lastDataRef.current !== resultStr);
        setData(result);
        lastDataRef.current = resultStr;
        setHasError(false);
        setError(null);
        setHasUpdates(hasChanges);
      } catch (err: any) {
        console.error("⌐ Error fetch group data:", err);

        if (!isMountedRef.current) return;

        setHasError(true);
        setError(err.message || "Error al cargar datos del grupo");
        if (!silent) {
          setData(null);
          lastDataRef.current = "";
        }
      } finally {
        if (!silent && isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [tournamentId]
  );

  const retry = useCallback(() => {
    fetchData(false);
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const clearUpdates = useCallback(() => {
    setHasUpdates(false);
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    data,
    isLoading,
    hasError,
    error,
    retry,
    refresh,
    hasUpdates,
    clearUpdates,
    loadingMessage: "Cargando información del grupo...",
  };
}

// Tipos optimizados
type Tournament = {
  id: string;
  title: string;
  isActive: boolean;
  isCurrent: boolean;
};

type GroupData = {
  hasGroup: boolean;
  roundId?: string;
  message?: string;
  tournament?: {
    id: string;
    title: string;
    currentRound: number;
  };
  group?: {
    id: string;
    number: number;
    level: string;
    totalPlayers: number;
  };
  myStatus?: {
    position: number;
    points: number;
    streak: number;
  };
  players?: Array<{
    id: string;
    name: string;
    points: number;
    position: number;
    isCurrentUser: boolean;
    sets?: number;
    games?: number;
    gamesLost?: number;
    setsWon?: number;
  }>;
  party?: any;
  availableTournaments?: Tournament[];
  allMatches?: Array<any>;
  _metadata?: any;
};

type MatchType = any;
type PlayerType = any;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// Función mejorada para calcular movimientos con desempates
const calculateMovementWithTiebreakers = (
  position: number, 
  groupNumber: number, 
  totalGroups: number = 10
) => {
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
        groups: 0,
        type: "maintain"
      };
    } else if (isSecondGroup) {
      return {
        icon: <TrendingUp className="w-4 h-4 text-green-600" />,
        text: "Sube al grupo élite",
        color: "text-green-600",
        bgColor: "bg-green-50 border-green-200",
        groups: 1,
        type: "up"
      };
    } else {
      return {
        icon: <ArrowUp className="w-4 h-4 text-green-600" />,
        text: "Sube 2 grupos",
        color: "text-green-600",
        bgColor: "bg-green-50 border-green-200",
        groups: 2,
        type: "up"
      };
    }
  } else if (position === 2) {
    if (isTopGroup) {
      return {
        icon: <Crown className="w-4 h-4 text-yellow-600" />,
        text: "Se mantiene en el grupo élite",
        color: "text-yellow-600",
        bgColor: "bg-yellow-50 border-yellow-200",
        groups: 0,
        type: "maintain"
      };
    } else {
      return {
        icon: <TrendingUp className="w-4 h-4 text-green-600" />,
        text: "Sube 1 grupo",
        color: "text-green-600",
        bgColor: "bg-green-50 border-green-200",
        groups: 1,
        type: "up"
      };
    }
  } else if (position === 3) {
    if (isBottomGroup) {
      return {
        icon: <Target className="w-4 h-4 text-blue-600" />,
        text: "Se mantiene en el grupo inferior",
        color: "text-blue-600",
        bgColor: "bg-blue-50 border-blue-200",
        groups: 0,
        type: "maintain"
      };
    } else {
      return {
        icon: <TrendingDown className="w-4 h-4 text-orange-600" />,
        text: "Baja 1 grupo",
        color: "text-orange-600",
        bgColor: "bg-orange-50 border-orange-200",
        groups: 1,
        type: "down"
      };
    }
  } else if (position === 4) {
    if (isBottomGroup) {
      return {
        icon: <Target className="w-4 h-4 text-blue-600" />,
        text: "Se mantiene en el grupo inferior",
        color: "text-blue-600",
        bgColor: "bg-blue-50 border-blue-200",
        groups: 0,
        type: "maintain"
      };
    } else if (isPenultimateGroup) {
      return {
        icon: <TrendingDown className="w-4 h-4 text-red-600" />,
        text: "Baja al grupo inferior",
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200",
        groups: 1,
        type: "down"
      };
    } else {
      return {
        icon: <ArrowDown className="w-4 h-4 text-red-600" />,
        text: "Baja 2 grupos",
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200",
        groups: 2,
        type: "down"
      };
    }
  } else {
    return {
      icon: <Minus className="w-4 h-4 text-gray-600" />,
      text: "Se mantiene",
      color: "text-gray-600",
      bgColor: "bg-gray-50 border-gray-200",
      groups: 0,
      type: "maintain"
    };
  }
};

// Función mejorada para aplicar desempates
const sortPlayersWithTiebreakers = (players: PlayerType[]) => {
  return [...players].sort((a, b) => {
    // 1. Puntos (descendente)
    if (a.points !== b.points) return b.points - a.points;
    
    // 2. Sets ganados (descendente)
    const aSetsWon = a.setsWon || a.sets || 0;
    const bSetsWon = b.setsWon || b.sets || 0;
    if (aSetsWon !== bSetsWon) return bSetsWon - aSetsWon;
    
    // 3. Diferencia de juegos (descendente)
    const aGames = a.games || 0;
    const bGames = b.games || 0;
    const aGamesLost = a.gamesLost || 0;
    const bGamesLost = b.gamesLost || 0;
    const aDiff = aGames - aGamesLost;
    const bDiff = bGames - bGamesLost;
    if (aDiff !== bDiff) return bDiff - aDiff;
    
    // 4. Juegos ganados totales (descendente)
    if (aGames !== bGames) return bGames - aGames;
    
    return 0; // Empate total
  });
};

export default function MiGrupoClient() {
  const { data: session, status: sessionStatus } = useSession();

  // Estados principales
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | undefined>(undefined);
  const [showTournamentSelector, setShowTournamentSelector] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showPreviewCard, setShowPreviewCard] = useState(true);
  const [showTournamentOverview, setShowTournamentOverview] = useState(false);

  // Hook de datos
  const { data, isLoading, hasError, error, retry, hasUpdates, clearUpdates, loadingMessage } =
    useGroupDataWithTournament(selectedTournamentId);

  // Estados para comodín y acciones
  const [comodinRefreshTrigger, setComodinRefreshTrigger] = useState(0);
  const [showActionFeedback, setShowActionFeedback] = useState(false);
  const [previewRefreshTrigger, setPreviewRefreshTrigger] = useState(0);

  // Auto-refresh cada 2 minutos
  useEffect(() => {
    if (!data?.hasGroup || isLoading) return;

    const interval = setInterval(() => {
      console.log("🔄 Auto-refresh");
      retry();
    }, 120000);

    return () => clearInterval(interval);
  }, [data?.hasGroup, isLoading, retry]);

  // Datos derivados
  const groupData: GroupData = data || { hasGroup: false };

  // Determinar datos de sets
  const matches = useMemo(() => {
    if (groupData._metadata?.usePartyData && groupData.party?.sets) {
      return groupData.party.sets;
    }
    return (groupData.allMatches || []).map((match) => ({
      id: match.id,
      setNumber: match.setNumber,
      team1Player1Name: match.team1Player1Name || "",
      team1Player2Name: match.team1Player2Name || "",
      team2Player1Name: match.team2Player1Name || "",
      team2Player2Name: match.team2Player2Name || "",
      team1Games: match.team1Games,
      team2Games: match.team2Games,
      tiebreakScore: match.tiebreakScore || null,
      isConfirmed: match.isConfirmed || false,
      hasResult: match.hasResult || (match.team1Games !== null && match.team2Games !== null),
      isPending:
        match.isPending || (!match.isConfirmed && (match.team1Games === null || match.team2Games === null)),
    }));
  }, [groupData]);

  // Callbacks
  const handleTournamentChange = useCallback(
    (tournamentId: string) => {
      console.log("🔄 Cambio torneo:", tournamentId);
      if (tournamentId !== selectedTournamentId) {
        setSelectedTournamentId(tournamentId);
        setShowTournamentSelector(false);
      }
    },
    [selectedTournamentId]
  );

  const handleComodinAction = useCallback(() => {
    console.log("🎲 Acción comodín completada");
    setComodinRefreshTrigger((prev) => prev + 1);
    setShowActionFeedback(true);

    setTimeout(() => setShowActionFeedback(false), 3000);
    setTimeout(() => {
      retry();
      setPreviewRefreshTrigger((prev) => prev + 1);
    }, 1500);
  }, [retry]);

  const handlePartyUpdate = useCallback(() => {
    console.log("🎉 Party actualizado");
    retry();
    setPreviewRefreshTrigger((prev) => prev + 1);
  }, [retry]);

  // Trigger preview refresh cuando hay cambios en matches
  const confirmedSetsCount = matches.filter((m: MatchType) => m.isConfirmed).length;
  useEffect(() => {
    setPreviewRefreshTrigger((prev) => prev + 1);
  }, [confirmedSetsCount]);

  // Helpers mejorados
  const getMatchStatusInfo = useCallback((match: MatchType) => {
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
  }, []);

  const getGroupLevelInfo = useCallback((groupNumber: number, groupLevel?: string) => {
    const level = parseInt(groupLevel || groupNumber.toString());
    
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
  }, []);

  // Datos memoizados con lógica mejorada
  const { completedMatches, groupInfo, GroupIcon, userMovement, groupStats, sortedPlayers } = useMemo(() => {
    const completed = matches.filter((m: MatchType) => m.isConfirmed);
    const info = getGroupLevelInfo(groupData.group?.number || 2, groupData.group?.level);
    
    // Ordenar jugadores con criterios de desempate
    const sorted = groupData.players ? sortPlayersWithTiebreakers(groupData.players) : [];
    const userPlayer = sorted.find(p => p.isCurrentUser);
    const userPosition = userPlayer ? sorted.findIndex(p => p.isCurrentUser) + 1 : 0;
    
    const movement = userPosition > 0 ? calculateMovementWithTiebreakers(
      userPosition, 
      groupData.group?.number || 2
    ) : null;
    
    const stats = {
      totalSets: matches.length,
      completedSets: completed.length,
      pendingSets: matches.length - completed.length,
      progress: matches.length > 0 ? Math.round((completed.length / matches.length) * 100) : 0
    };

    return {
      completedMatches: completed,
      groupInfo: info,
      GroupIcon: info.icon,
      userMovement: movement,
      groupStats: stats,
      sortedPlayers: sorted
    };
  }, [matches, groupData.group?.number, groupData.group?.level, groupData.players, getGroupLevelInfo]);

  // Verificar si el comodín debe mostrarse
  const shouldShowComodin = useMemo(() => {
    const hasValidSession = sessionStatus === "authenticated" && session?.user?.id;
    const hasValidRoundId = groupData.roundId && groupData.roundId !== "";
    const hasGroup = groupData.hasGroup;

    return hasValidSession && hasValidRoundId && hasGroup;
  }, [sessionStatus, session?.user?.id, groupData.roundId, groupData.hasGroup]);

  // Esperar autenticación
  if (sessionStatus === "loading") {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <LoadingState message="Verificando autenticación..." />
      </div>
    );
  }

  // Sin autenticación
  if (sessionStatus === "unauthenticated") {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <ErrorState 
          error="Debes iniciar sesión para ver tu grupo" 
          onRetry={() => window.location.href = "/auth/login"} 
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <LoadingState message={loadingMessage} />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <ErrorState error={error} onRetry={retry} />
      </div>
    );
  }

  // Estado sin grupo
  if (!groupData.hasGroup) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />

        {groupData.availableTournaments && groupData.availableTournaments.length > 0 ? (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-6 text-center">
              <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Selecciona un Torneo</h3>
              <p className="text-yellow-700 mb-4">
                Estás participando en {groupData.availableTournaments.length} torneos. Selecciona uno para ver tu grupo:
              </p>

              <div className="space-y-2 max-w-md mx-auto">
                {groupData.availableTournaments.map((tournament) => (
                  <Button
                    key={tournament.id}
                    variant={tournament.isActive ? "default" : "outline"}
                    className="w-full justify-between"
                    onClick={() => handleTournamentChange(tournament.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4" />
                      {tournament.title}
                    </div>
                    {tournament.isActive && <Badge className="bg-green-100 text-green-700">Activo</Badge>}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState 
            message={groupData.message || "No tienes un grupo asignado"} 
            icon={Users} 
            action={<Button onClick={retry}>Reintentar</Button>} 
          />
        )}
      </div>
    );
  }

  // Vista principal optimizada
  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumbs />

      {/* Feedback visual para acciones */}
      <UpdateBadge
        show={hasUpdates}
        onRefresh={() => {
          retry();
          clearUpdates();
        }}
      />

      {showActionFeedback && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-300 rounded-lg p-3 shadow-lg animate-in slide-in-from-right-5 duration-300">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Comodín aplicado correctamente</span>
          </div>
        </div>
      )}

      {/* Header mejorado */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-600" />
            Mi Grupo en la Escalera
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-gray-600">
              {groupData.tournament?.title} - Ronda {groupData.tournament?.currentRound}
            </p>
            <Badge variant="outline" className="text-xs">
              {groupStats.progress}% completado
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Selector de torneo */}
          {groupData.availableTournaments && groupData.availableTournaments.length > 1 && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTournamentSelector(!showTournamentSelector)}
                className="flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Cambiar Torneo</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showTournamentSelector ? "rotate-180" : ""}`} />
              </Button>

              {showTournamentSelector && (
                <div className="absolute top-full right-0 z-50 mt-1 w-80">
                  <Card className="border shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-sm">Seleccionar Torneo</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        {groupData.availableTournaments.map((tournament) => (
                          <button
                            key={tournament.id}
                            onClick={() => handleTournamentChange(tournament.id)}
                            className={`w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors ${
                              tournament.id === selectedTournamentId ? "bg-blue-50 border border-blue-200" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Trophy className="w-4 h-4" />
                                <div>
                                  <div className="font-medium text-sm">{tournament.title}</div>
                                  <div className="text-xs text-gray-500">
                                    {tournament.isActive ? "Torneo activo" : "Torneo finalizado"}
                                  </div>
                                </div>
                              </div>
                              {tournament.isCurrent && (
                                <Badge className="bg-blue-100 text-blue-700">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Actual
                                </Badge>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* Botones de vista */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTournamentOverview(!showTournamentOverview)}
            className="flex items-center gap-2"
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">Vista General</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreviewCard(!showPreviewCard)}
            className="flex items-center gap-2"
          >
            {showPreviewCard ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline">Preview</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              retry();
              clearUpdates();
              setPreviewRefreshTrigger(prev => prev + 1);
            }}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
        </div>
      </div>

      {/* Vista general del torneo */}
      {showTournamentOverview && (
        <TournamentOverviewCard 
          tournamentId={groupData.tournament?.id}
          currentUserId={sortedPlayers.find(p => p.isCurrentUser)?.id}
          compact={false}
        />
      )}

      {/* Preview de Puntos optimizado */}
      {showPreviewCard && groupData.group?.id && (
        <PointsPreviewCard
          groupId={groupData.group.id}
          currentUserId={sortedPlayers.find(p => p.isCurrentUser)?.id}
          showAllPlayers={false}
          compact={false}
          refreshTrigger={previewRefreshTrigger}
          className="mb-6"
        />
      )}

      {/* Sistema de programación UNIFICADO */}
      {groupData.party?.groupId && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Calendar className="w-5 h-5" />
              Programar Partido Completo
            </CardTitle>
            <div className="flex items-start justify-between">
              <p className="text-sm text-blue-700">Coordina una fecha para los 3 sets. Todos los jugadores deben confirmar.</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-white">
                  {groupData.party.completedSets}/{groupData.party.totalSets} completados
                </Badge>
                <button
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                  title="Información adicional"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PartyScheduling
              groupId={groupData.party.groupId}
              currentUserId={sortedPlayers.find(p => p.isCurrentUser)?.id ?? ""}
              isParticipant={true}
              onUpdate={handlePartyUpdate}
              enableRefresh={true}
            />

            {showAdvancedOptions && (
              <div className="mt-4 p-4 bg-white rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <Settings className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-gray-900">Información Adicional</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Los sets se pueden jugar individualmente si no se programa una fecha común</p>
                  <p>• El sistema de programación conjunto simplifica la coordinación</p>
                  <p>• Los resultados se confirman individualmente por set</p>
                  <p>• Una vez programado, todos los jugadores ven la misma fecha</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Warning si no hay party data */}
      {!groupData.party?.groupId && (
        <Card className="bg-yellow-50 border border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900">Sistema de programación no disponible</p>
                <p className="text-sm text-yellow-800 mt-1">
                  No se pudo cargar la información del partido. Los sets se pueden jugar individualmente usando los enlaces
                  directos de cada set.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grupo principal con escalera visual mejorada */}
      <Card className={`${groupInfo.color} border-2 bg-gradient-to-br ${groupInfo.gradient} shadow-lg relative overflow-hidden`}>
        {/* Indicador visual de nivel mejorado */}
        <div className={`absolute left-0 top-0 bottom-0 w-2 ${groupInfo.accent}`}></div>
        <div className="absolute top-4 right-4 opacity-20">
          <GroupIcon className="w-16 h-16" />
        </div>
        
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <GroupIcon className="w-6 h-6" />
              Grupo {groupData.group?.number} - {groupInfo.level}
            </CardTitle>
            <div className="text-right">
              <Badge variant="outline" className="mb-2 bg-white/80">
                {groupData.group?.totalPlayers} jugadores
              </Badge>
              <div className="text-sm opacity-75 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>{completedMatches.length}/{matches.length} sets</span>
                </div>
                <div className="text-xs bg-white/60 px-2 py-1 rounded">
                  {groupStats.progress}%
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm opacity-80">{groupInfo.description}</p>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {/* Jugadores del grupo con escalera visual y desempates */}
            {sortedPlayers.map((player: PlayerType, index: number) => {
              const position = index + 1;
              const movement = calculateMovementWithTiebreakers(position, groupData.group?.number || 2);
              
              return (
                <div
                  key={player.id}
                  className={`group relative flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${
                    player.isCurrentUser 
                      ? "bg-white/95 border-indigo-300 shadow-md ring-2 ring-indigo-200/50" 
                      : "bg-white/70 border-white/60 hover:bg-white/85"
                  }`}
                >
                  {/* Indicador de movimiento en el lado izquierdo */}
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
                      
                      {/* Indicador de movimiento superpuesto */}
                      {movement.groups > 0 && (
                        <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          movement.type === 'up' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {movement.groups === 2 ? '2' : '1'}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg">
                          {player.name}
                          {player.isCurrentUser && <span className="text-blue-600 text-sm ml-2 font-normal">(Tú)</span>}
                        </span>
                        {groupData.myStatus?.streak && player.isCurrentUser && groupData.myStatus.streak > 0 && (
                          <div className="flex items-center gap-1 bg-orange-100 px-2 py-1 rounded-full">
                            <Flame className="w-3 h-3 text-orange-500" />
                            <span className="text-xs text-orange-600 font-medium">{groupData.myStatus.streak}</span>
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
                        {movement.groups > 0 ? 
                          `${movement.type === 'up' ? 'Sube' : 'Baja'} ${movement.groups}` : 
                          'Mantiene'
                        }
                      </span>
                    </div>
                    <div className="text-xs opacity-75">
                      {movement.groups === 2 ? 'Doble salto' : 
                       movement.groups === 1 ? 'Un grupo' : 
                       'Mismo nivel'}
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

          {/* Sets de la ronda con mejor visualización */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Sets de esta Ronda
              </h4>
              <Badge variant="outline" className="bg-white/60">
                {completedMatches.length} de {matches.length} completados
              </Badge>
            </div>
            
            <div className="grid gap-3">
              {matches.map((match: MatchType) => {
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
                        <Link href={`/set/${match.id}`}>
                          <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
                            <Play className="w-4 h-4 mr-2" />
                            Introducir Resultado
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sistema de comodín mejorado */}
          {shouldShowComodin ? (
            <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-purple-600" />
                <h4 className="font-medium text-purple-900">Sistema de Comodín</h4>
              </div>
              <UseComodinButton
                roundId={groupData.roundId!}
                refreshTrigger={comodinRefreshTrigger}
                onActionComplete={handleComodinAction}
                className="w-full"
              />
            </div>
          ) : (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800">
                    <strong>Comodín no disponible:</strong> {
                      sessionStatus !== "authenticated" 
                        ? "No has iniciado sesión"
                        : !groupData.roundId 
                        ? "No se pudo obtener la información de la ronda actual"
                        : "Sistema no disponible"
                    }
                  </p>
                  {sessionStatus === "authenticated" && (
                    <button onClick={retry} className="text-sm text-amber-700 underline mt-1 hover:text-amber-800">
                      Reintentar carga
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats compactas mejoradas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Award className="w-5 h-5 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">{groupData.myStatus?.position}°</div>
            </div>
            <div className="text-sm text-gray-600">Mi Posición</div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-green-500">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Star className="w-5 h-5 text-green-600" />
              <div className="text-2xl font-bold text-green-600">{round1(groupData.myStatus?.points || 0)}</div>
            </div>
            <div className="text-sm text-gray-600">Mis Puntos</div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-orange-500">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Flame className="w-5 h-5 text-orange-600" />
              <div className="text-2xl font-bold text-orange-600">{groupData.myStatus?.streak || 0}</div>
            </div>
            <div className="text-sm text-gray-600">Mi Racha</div>
          </CardContent>
        </Card>
        
        {userMovement && (
          <Card className={`hover:shadow-md transition-all duration-200 border-l-4 ${
            userMovement.type === 'up' ? 'border-l-green-600' : 
            userMovement.type === 'down' ? 'border-l-red-600' : 
            'border-l-blue-600'
          }`}>
            <CardContent className="p-4 text-center">
              <div className={`flex items-center justify-center gap-2 mb-1`}>
                {userMovement.icon}
                <div className={`text-2xl font-bold ${userMovement.color}`}>
                  {userMovement.groups > 0 ? `±${userMovement.groups}` : "="}
                </div>
              </div>
              <div className="text-sm text-gray-600">Mi Movimiento</div>
            </CardContent>
          </Card>
        )}
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
            <Link href="/historial">
              <Button variant="outline" size="sm" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Mi Historial
              </Button>
            </Link>
            {groupData.group?.id && (
              <Link href={`/grupo/${groupData.group.id}`}>
                <Button variant="outline" size="sm" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  Vista Detallada del Grupo
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}