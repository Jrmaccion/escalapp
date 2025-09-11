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
  ChevronDown
} from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import UseComodinButton from "@/components/player/UseComodinButton";
import PartyScheduling from "@/components/PartyScheduling";
import { LoadingState, ErrorState, EmptyState, UpdateBadge } from "@/components/ApiStateComponents";

/* =========
   Hook personalizado CORREGIDO - Con soporte para múltiples torneos
   ========= */
function useGroupDataWithTournament(tournamentId?: string) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUpdates, setHasUpdates] = useState(false);
  
  // Referencias estables para evitar dependencias circulares
  const dataRef = useRef<any>(null);
  const tournamentIdRef = useRef<string | undefined>(tournamentId);
  const isMountedRef = useRef(true);
  
  // Función de fetch estable usando useRef
  const fetchDataRef = useRef<(silent?: boolean) => Promise<void>>();
  
  // Actualizar la referencia del tournamentId
  useEffect(() => {
    tournamentIdRef.current = tournamentId;
  }, [tournamentId]);
  
  // Crear función de fetch estable
  fetchDataRef.current = async (silent = false) => {
    if (!isMountedRef.current) return;
    
    if (!silent) {
      setIsLoading(true);
      setHasError(false);
      setError(null);
    }

    try {
      const url = tournamentIdRef.current 
        ? `/api/player/group?tournamentId=${tournamentIdRef.current}`
        : '/api/player/group';
      
      console.log(`[useGroupDataWithTournament] Fetching: ${url}`);
      
      const response = await fetch(url, { 
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!isMountedRef.current) return;
      
      console.log(`[useGroupDataWithTournament] Data received:`, result);
      
      const prev = dataRef.current;
      setData(result);
      dataRef.current = result;
      setHasError(false);
      setError(null);
      
      // Solo marcar updates si hay datos previos y estamos en modo silencioso
      if (silent && prev && JSON.stringify(prev) !== JSON.stringify(result)) {
        setHasUpdates(true);
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      
      console.error('[useGroupDataWithTournament] Error:', err);
      setHasError(true);
      setError(err.message || 'Error al cargar datos del grupo');
      if (!silent) {
        setData(null);
        dataRef.current = null;
      }
    } finally {
      if (!silent && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Funciones estables sin dependencias problemáticas
  const retry = useCallback(() => {
    console.log('[useGroupDataWithTournament] Manual retry triggered');
    fetchDataRef.current?.(false);
  }, []);

  const refresh = useCallback(() => {
    console.log('[useGroupDataWithTournament] Silent refresh triggered');
    fetchDataRef.current?.(true);
  }, []);

  const clearUpdates = useCallback(() => {
    setHasUpdates(false);
  }, []);

  // Fetch inicial solo cuando cambie tournamentId
  useEffect(() => {
    console.log(`[useGroupDataWithTournament] Tournament changed to: ${tournamentId}`);
    fetchDataRef.current?.(false);
  }, [tournamentId]);

  // Cleanup al desmontar
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
    loadingMessage: "Cargando información del grupo..."
  };
}

/* =========
   Tipos
   ========= */
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
  }>;
  party?: {
    id: string;
    groupId: string;
    status: string;
    proposedDate: string | null;
    acceptedDate: string | null;
    acceptedCount: number;
    needsScheduling: boolean;
    canSchedule: boolean;
    allSetsCompleted: boolean;
    completedSets: number;
    totalSets: number;
    sets: Array<{
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
      isPending: boolean;
    }>;
  };
  availableTournaments?: Tournament[];
  allMatches?: Array<any>;
  _metadata?: {
    usePartyData: boolean;
    partyApiVersion: string;
    hasPartyScheduling: boolean;
    tournamentSelectionEnabled: boolean;
  };
};

type MatchType = NonNullable<GroupData["party"]>["sets"][0];
type PlayerType = NonNullable<GroupData["players"]>[0];

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export default function MiGrupoClient() {
  const { data: session } = useSession();
  
  // Estado del torneo seleccionado
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | undefined>(undefined);
  const [showTournamentSelector, setShowTournamentSelector] = useState(false);

  // Hook corregido
  const {
    data,
    isLoading,
    hasError,
    error,
    retry,
    hasUpdates,
    loadingMessage
  } = useGroupDataWithTournament(selectedTournamentId);

  // Estado para manejar refreshTrigger del comodín
  const [comodinRefreshTrigger, setComodinRefreshTrigger] = useState(0);
  const [lastComodinAction, setLastComodinAction] = useState<string | null>(null);
  const [showActionFeedback, setShowActionFeedback] = useState(false);

  // Refs para auto-refresh
  const autoRefreshRef = useRef<NodeJS.Timeout>();
  const hasInitialized = useRef(false);

  const isPreviewMode = !data?.hasGroup;
  const groupData: GroupData = data || { hasGroup: false };

  // Auto-activar selector si hay múltiples torneos (solo una vez)
  useEffect(() => {
    if (data?.availableTournaments?.length > 1 && !selectedTournamentId && !hasInitialized.current) {
      console.log("[MiGrupoClient] Multiple tournaments detected, showing selector");
      setShowTournamentSelector(true);
      hasInitialized.current = true;
    }
  }, [data?.availableTournaments?.length, selectedTournamentId]);

  // Determinar qué datos usar: party o allMatches (fallback legacy)
  const matches = useMemo(() => {
    if (groupData._metadata?.usePartyData && groupData.party?.sets) {
      return groupData.party.sets;
    }
    // Fallback a allMatches si no hay party data
    return (groupData.allMatches || []).map(match => ({
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
      isPending: match.isPending || (!match.isConfirmed && (match.team1Games === null || match.team2Games === null))
    }));
  }, [groupData]);

  // Callback para cambio de torneo
  const handleTournamentChange = useCallback((tournamentId: string) => {
    if (tournamentId !== selectedTournamentId) {
      console.log('[MiGrupoClient] Cambiando a torneo:', tournamentId);
      setSelectedTournamentId(tournamentId);
      setShowTournamentSelector(false);
    }
  }, [selectedTournamentId]);

  // Callback para cuando se usa comodín
  const handleComodinAction = useCallback(() => {
    console.log('[MiGrupoClient] Comodin action triggered');
    
    setComodinRefreshTrigger(prev => prev + 1);
    setLastComodinAction('aplicado');
    setShowActionFeedback(true);
    
    setTimeout(() => {
      setShowActionFeedback(false);
    }, 3000);

    setTimeout(() => {
      console.log('[MiGrupoClient] Triggering group data refresh after comodin');
      retry();
    }, 1500);
  }, [retry]);

  // Callback para actualizar después de programar fecha
  const handlePartyUpdate = useCallback(() => {
    console.log('[MiGrupoClient] Party updated, refreshing data');
    retry();
  }, [retry]);

  // Auto-refresh mejorado sin dependencias problemáticas
  useEffect(() => {
    // Limpiar interval anterior
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
    }
    
    if (!isPreviewMode && data?.hasGroup && !isLoading) {
      console.log('[MiGrupoClient] Setting up auto-refresh timer');
      autoRefreshRef.current = setInterval(() => {
        console.log('[MiGrupoClient] Auto-refresh triggered');
        retry();
      }, 90000); // 90 segundos para reducir la frecuencia
    }
    
    return () => {
      if (autoRefreshRef.current) {
        console.log('[MiGrupoClient] Clearing auto-refresh timer');
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [isPreviewMode, data?.hasGroup, isLoading]); // Solo estas dependencias

  const getMatchStatusInfo = (match: MatchType) => {
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
  };

  const getMovementIcon = (position: number) => {
    if (position === 1) return <ArrowUp className="w-4 h-4 text-green-600" />;
    if (position === 2) return <ArrowUp className="w-4 h-4 text-green-600" />;
    if (position === 3) return <ArrowDown className="w-4 h-4 text-red-600" />;
    if (position === 4) return <ArrowDown className="w-4 h-4 text-red-600" />;
    return <Target className="w-4 h-4 text-blue-600" />;
  };

  const getMovementText = (position: number) => {
    if (position === 1) return "Sube 2 grupos";
    if (position === 2) return "Sube 1 grupo";
    if (position === 3) return "Baja 1 grupo";
    if (position === 4) return "Baja 2 grupos";
    return "Se mantiene";
  };

  const getGroupLevelInfo = (groupNumber: number) => {
    switch (groupNumber) {
      case 1:
        return {
          level: "Superior",
          color: "bg-yellow-100 border-yellow-300 text-yellow-800",
          icon: Crown,
          gradient: "from-yellow-50 to-yellow-100",
        };
      case 2:
        return {
          level: "Medio",
          color: "bg-gray-100 border-gray-300 text-gray-700",
          icon: Target,
          gradient: "from-gray-50 to-gray-100",
        };
      case 3:
        return {
          level: "Inferior",
          color: "bg-orange-100 border-orange-300 text-orange-700",
          icon: Star,
          gradient: "from-orange-50 to-orange-100",
        };
      default:
        return {
          level: "Intermedio",
          color: "bg-blue-100 border-blue-300 text-blue-700",
          icon: Target,
          gradient: "from-blue-50 to-blue-100",
        };
    }
  };

  // Datos memoizados para optimización
  const { completedMatches, groupInfo, GroupIcon } = useMemo(() => {
    const completed = matches.filter((m: MatchType) => m.isConfirmed);
    const info = getGroupLevelInfo(groupData.group?.number || 2);
    
    return {
      completedMatches: completed,
      groupInfo: info,
      GroupIcon: info.icon
    };
  }, [matches, groupData.group?.number]);

  // Estados de carga unificados
  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <LoadingState message="Cargando información del grupo..." />
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

  if (!groupData.hasGroup) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        
        {/* Si hay torneos disponibles pero no grupo actual */}
        {groupData.availableTournaments && groupData.availableTournaments.length > 0 ? (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-6 text-center">
              <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                Selecciona un Torneo
              </h3>
              <p className="text-yellow-700 mb-4">
                Estás participando en {groupData.availableTournaments.length} torneos. 
                Selecciona uno para ver tu grupo:
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
                    {tournament.isActive && (
                      <Badge className="bg-green-100 text-green-700">
                        Activo
                      </Badge>
                    )}
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

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumbs />

      {/* BADGE DE ACTUALIZACIONES DISPONIBLES */}
      <UpdateBadge show={hasUpdates} onRefresh={retry} />

      {/* Feedback visual para acciones de comodín */}
      {showActionFeedback && lastComodinAction && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-300 rounded-lg p-3 shadow-lg animate-in fade-in slide-in-from-right-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              Comodín {lastComodinAction} correctamente
            </span>
          </div>
        </div>
      )}

      {/* Header con botón de refresh manual y selector de torneo */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Mi Grupo
          </h1>
          <p className="text-gray-600 mt-1">
            {groupData.tournament?.title} - Ronda {groupData.tournament?.currentRound}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Selector de torneo (si hay múltiples) */}
          {groupData.availableTournaments && groupData.availableTournaments.length > 1 && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTournamentSelector(!showTournamentSelector)}
                className="flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                Cambiar Torneo
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
                              tournament.isCurrent ? "bg-blue-50 border border-blue-200" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Trophy className="w-4 h-4" />
                                <div>
                                  <div className="font-medium text-sm">
                                    {tournament.title}
                                  </div>
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
                              {tournament.isActive && !tournament.isCurrent && (
                                <Badge className="bg-green-100 text-green-700">
                                  Activo
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

          <Button
            variant="outline"
            size="sm"
            onClick={retry}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* SISTEMA DE PROGRAMACIÓN DE PARTIDO COMPLETO */}
      {groupData.party?.groupId && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Programación del Partido Completo
            </h2>
            <p className="text-sm text-gray-600">
              Coordina una fecha para los 3 sets del partido. Todos los jugadores deben confirmar.
            </p>
          </div>
          <PartyScheduling
            groupId={groupData.party.groupId}
            currentUserId={session?.user?.id || ""}
            isParticipant={true}
            onUpdate={handlePartyUpdate}
            enableRefresh={true}
          />
        </div>
      )}

      {/* Warning si no hay party data */}
      {!groupData.party?.groupId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900">Sistema de programación no disponible</p>
              <p className="text-sm text-yellow-800 mt-1">
                No se pudo cargar la información del partido. Los sets se pueden jugar individualmente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tarjeta de grupo */}
      <Card className={`${groupInfo.color} border-2 bg-gradient-to-br ${groupInfo.gradient} shadow-lg`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <GroupIcon className="w-6 h-6" />
              Grupo {groupData.group?.number} - {groupInfo.level}
            </CardTitle>
            <div className="text-right">
              <Badge variant="outline" className="mb-1">
                {groupData.group?.totalPlayers} jugadores
              </Badge>
              <div className="text-sm opacity-75">
                Progreso: {completedMatches.length}/{matches.length} sets
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Jugadores del grupo */}
            {groupData.players?.map((player: PlayerType) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                  player.isCurrentUser
                    ? "bg-white/90 border-blue-300 shadow-md ring-2 ring-blue-200"
                    : "bg-white/60 border-white/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-lg ${
                      player.position === 1
                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                        : player.position === 2
                        ? "bg-gray-100 text-gray-700 border-gray-300"
                        : player.position === 3
                        ? "bg-orange-100 text-orange-700 border-orange-300"
                        : "bg-red-100 text-red-700 border-red-300"
                    }`}
                  >
                    {player.position === 1
                      ? "🥇"
                      : player.position === 2
                      ? "🥈"
                      : player.position === 3
                      ? "🥉"
                      : player.position}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">
                        {player.name}
                        {player.isCurrentUser && <span className="text-blue-600 text-sm ml-2">(Tú)</span>}
                      </span>
                      {groupData.myStatus?.streak && player.isCurrentUser && groupData.myStatus.streak > 0 && (
                        <div className="flex items-center gap-1">
                          <Flame className="w-4 h-4 text-orange-500" />
                          <span className="text-sm text-orange-600 font-medium">Racha {groupData.myStatus.streak}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">{round1(player.points)} puntos acumulados</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    {getMovementIcon(player.position)}
                    <span
                      className={`text-sm font-medium ${
                        player.position === 1 || player.position === 2
                          ? "text-green-600"
                          : player.position === 3 || player.position === 4
                          ? "text-red-600"
                          : "text-blue-600"
                      }`}
                    >
                      {getMovementText(player.position)}
                    </span>
                  </div>
                  {player.position === 1 && <Badge className="bg-green-100 text-green-700 text-xs">¡Subes 2 grupos!</Badge>}
                  {player.position === 2 && <Badge className="bg-green-100 text-green-700 text-xs">¡Subes 1 grupo!</Badge>}
                  {player.position === 3 && <Badge className="bg-red-100 text-red-700 text-xs">Bajas 1 grupo</Badge>}
                  {player.position === 4 && <Badge className="bg-red-100 text-red-700 text-xs">Bajas 2 grupos</Badge>}
                </div>
              </div>
            ))}
          </div>

          {/* Sistema de comodín */}
          {groupData.roundId && (
            <div className="mt-6">
              <UseComodinButton
                roundId={groupData.roundId}
                refreshTrigger={comodinRefreshTrigger}
                onActionComplete={handleComodinAction}
                className="w-full"
              />
            </div>
          )}

          {/* Mensaje si no hay roundId */}
          {!groupData.roundId && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800">
                    <strong>Comodín no disponible:</strong> No se pudo obtener la información de la ronda actual.
                  </p>
                  <button 
                    onClick={retry}
                    className="text-sm text-amber-700 underline mt-1 hover:text-amber-800"
                  >
                    Reintentar carga
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

       {/* Info de movimientos */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <ArrowUp className="w-4 h-4" />
            Sistema de Escalera
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-blue-700">
            <div className="flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-green-600" />
              <span><strong>1º lugar:</strong> Sube 2 grupos</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-green-600" />
              <span><strong>2º lugar:</strong> Sube 1 grupo</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-red-600" />
              <span><strong>3º lugar:</strong> Baja 1 grupo</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-red-600" />
              <span><strong>4º lugar:</strong> Baja 2 grupos</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{groupData.myStatus?.position}º</div>
            <div className="text-sm text-gray-600">Mi Posición</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{round1(groupData.myStatus?.points || 0)}</div>
            <div className="text-sm text-gray-600">Mis Puntos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {completedMatches.length}/{matches.length}
            </div>
            <div className="text-sm text-gray-600">Sets Completados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{groupData.myStatus?.streak || 0}</div>
            <div className="text-sm text-gray-600">Racha Actual</div>
          </CardContent>
        </Card>
      </div>

      {/* Sets - Solo visualización, sin botones de programación */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Mis Sets de la Ronda
          </CardTitle>
          <p className="text-sm text-gray-600">
            Los 3 sets se programan juntos como un partido completo. 
            Usa el sistema de programación arriba para coordinar la fecha.
          </p>
        </CardHeader>
        <CardContent>
          {matches.length === 0 ? (
            <EmptyState 
              message="No hay sets programados"
              icon={Calendar}
            />
          ) : (
            <div className="space-y-4">
              {matches.map((match: MatchType) => {
                const statusInfo = getMatchStatusInfo(match);
                const StatusIcon = statusInfo.icon;

                return (
                  <div
                    key={match.id}
                    className={`border-2 rounded-lg p-6 hover:shadow-md transition-all ${
                      match.isConfirmed
                        ? "border-green-200 bg-green-50"
                        : match.hasResult
                        ? "border-yellow-200 bg-yellow-50"
                        : "border-gray-200 bg-white hover:border-blue-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-lg px-3 py-1">
                          Set {match.setNumber}
                        </Badge>
                        <Badge className={`${statusInfo.color} border px-3 py-1`}>
                          <StatusIcon className="w-4 h-4 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {/* Solo botón para ver/confirmar resultado */}
                      <Link href={`/match/${match.id}`}>
                        <Button size="sm" variant={match.isConfirmed ? "outline" : "default"}>
                          {match.isConfirmed ? "Ver Resultado" : match.hasResult ? "Confirmar" : "Jugar Set"}
                        </Button>
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="text-center">
                        <div className="font-semibold text-blue-700 mb-1">
                          {match.team1Player1Name} + {match.team1Player2Name}
                        </div>
                        {match.hasResult && <div className="text-2xl font-bold">{match.team1Games}</div>}
                      </div>

                      <div className="text-center">
                        <div className="text-gray-500 text-sm mb-2">vs</div>
                        {match.hasResult ? (
                          <div className="text-3xl font-bold text-gray-400">-</div>
                        ) : (
                          <div className="w-8 h-8 mx-auto bg-gray-200 rounded-full flex items-center justify-center">
                            <Play className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                      </div>

                      <div className="text-center">
                        <div className="font-semibold text-red-700 mb-1">
                          {match.team2Player1Name} + {match.team2Player2Name}
                        </div>
                        {match.hasResult && <div className="text-2xl font-bold">{match.team2Games}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}