// app/mi-grupo/MiGrupoClient.tsx - CORREGIDO Y COMPLETO
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
  Minus,
  Medal,
  Award,
  Zap,
  Eye,
  EyeOff,
} from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import UseComodinButton from "@/components/player/UseComodinButton";
import PartyScheduling from "@/components/PartyScheduling";
import PointsPreviewCard from "@/components/PointsPreviewCard";
import TournamentOverviewCard from "@/components/dashboard/TournamentOverviewCard";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  UpdateBadge,
} from "@/components/ApiStateComponents";

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
        const hasChanges = Boolean(
          silent && lastDataRef.current && lastDataRef.current !== resultStr
        );
        setData(result);
        lastDataRef.current = resultStr;
        setHasError(false);
        setError(null);
        setHasUpdates(hasChanges);
      } catch (err: any) {
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
    movement?: {
      type: "maintain" | "up" | "down";
      text: string;
      groups: number;
      color: string;
      bgColor: string;
    };
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

// Función de desempates
const sortPlayersWithTiebreakers = (players: PlayerType[]) => {
  return [...players].sort((a, b) => {
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
    const interval = setInterval(() => retry(), 120000);
    return () => clearInterval(interval);
  }, [data?.hasGroup, isLoading, retry]);

  const groupData: GroupData = data || { hasGroup: false };

  // Matches
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
      hasResult:
        match.hasResult || (match.team1Games !== null && match.team2Games !== null),
      isPending:
        match.isPending ||
        (!match.isConfirmed &&
          (match.team1Games === null || match.team2Games === null)),
    }));
  }, [groupData]);

  // Callbacks
  const handleTournamentChange = useCallback((tournamentId: string) => {
    if (tournamentId !== selectedTournamentId) {
      setSelectedTournamentId(tournamentId);
      setShowTournamentSelector(false);
    }
  }, [selectedTournamentId]);

  const handleComodinAction = useCallback(() => {
    setComodinRefreshTrigger((prev) => prev + 1);
    setShowActionFeedback(true);
    setTimeout(() => setShowActionFeedback(false), 3000);
    setTimeout(() => {
      retry();
      setPreviewRefreshTrigger((prev) => prev + 1);
    }, 1500);
  }, [retry]);

  const handlePartyUpdate = useCallback(() => {
    retry();
    setPreviewRefreshTrigger((prev) => prev + 1);
  }, [retry]);

  // Refresh preview al confirmar sets
  const confirmedSetsCount = matches.filter((m: MatchType) => m.isConfirmed).length;
  useEffect(() => {
    setPreviewRefreshTrigger((prev) => prev + 1);
  }, [confirmedSetsCount]);

  // Helpers
  const getMatchStatusInfo = useCallback((match: MatchType) => {
    if (match.isConfirmed) return { label: "Completado", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle };
    if (match.hasResult) return { label: "Por confirmar", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Calendar };
    return { label: "Pendiente", color: "bg-gray-100 text-gray-700 border-gray-200", icon: Play };
  }, []);

  const getGroupLevelInfo = useCallback((groupNumber: number, groupLevel?: string) => {
    const level = parseInt(groupLevel || groupNumber.toString());
    switch (level) {
      case 1: return { level: "Elite", color: "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-900 border-yellow-300", icon: Crown, gradient: "from-yellow-50 to-amber-100", description: "Nivel élite de la escalera", accent: "border-l-yellow-500" };
      case 2: return { level: "Alto", color: "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-900 border-blue-300", icon: Trophy, gradient: "from-blue-50 to-indigo-100", description: "Nivel alto", accent: "border-l-blue-500" };
      case 3: return { level: "Medio-Alto", color: "bg-gradient-to-r from-green-100 to-green-200 text-green-900 border-green-300", icon: Medal, gradient: "from-green-50 to-emerald-100", description: "Nivel medio-alto", accent: "border-l-green-500" };
      case 4: return { level: "Medio", color: "bg-gradient-to-r from-purple-100 to-purple-200 text-purple-900 border-purple-300", icon: Star, gradient: "from-purple-50 to-violet-100", description: "Nivel medio", accent: "border-l-purple-500" };
      default: return { level: "Intermedio", color: "bg-gradient-to-r from-gray-100 to-slate-200 text-slate-900 border-slate-300", icon: Target, gradient: "from-slate-50 to-gray-100", description: "Nivel intermedio", accent: "border-l-slate-500" };
    }
  }, []);

  // Datos derivados
  const { completedMatches, groupInfo, GroupIcon, userMovement, groupStats, sortedPlayers } = useMemo(() => {
    const completed = matches.filter((m: MatchType) => m.isConfirmed);
    const info = getGroupLevelInfo(groupData.group?.number || 2, groupData.group?.level);
    const sorted = groupData.players ? sortPlayersWithTiebreakers(groupData.players) : [];
    const userPlayer = sorted.find(p => p.isCurrentUser);
    const movement = userPlayer?.movement ?? null;
    const stats = { totalSets: matches.length, completedSets: completed.length, pendingSets: matches.length - completed.length, progress: matches.length > 0 ? Math.round((completed.length / matches.length) * 100) : 0 };
    return { completedMatches: completed, groupInfo: info, GroupIcon: info.icon, userMovement: movement, groupStats: stats, sortedPlayers: sorted };
  }, [matches, groupData.group?.number, groupData.group?.level, groupData.players, getGroupLevelInfo]);

  // Mostrar comodín
  const shouldShowComodin = useMemo(() => {
    return sessionStatus === "authenticated" && session?.user?.id && groupData.roundId && groupData.hasGroup;
  }, [sessionStatus, session?.user?.id, groupData.roundId, groupData.hasGroup]);

  // Render condicional: loading, no auth, error, no group
  if (sessionStatus === "loading") return <LoadingState message="Verificando autenticación..." />;
  if (sessionStatus === "unauthenticated") return <ErrorState error="Debes iniciar sesión" onRetry={() => window.location.href = "/auth/login"} />;
  if (isLoading) return <LoadingState message={loadingMessage} />;
  if (hasError) return <ErrorState error={error} onRetry={retry} />;
  if (!groupData.hasGroup) return <EmptyState message={groupData.message || "No tienes un grupo asignado"} icon={Users} action={<Button onClick={retry}>Reintentar</Button>} />;

  // Render principal
  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumbs />

      {/* Feedback de actualizaciones */}
      <UpdateBadge show={hasUpdates} onRefresh={() => { retry(); clearUpdates(); }} />

      {showActionFeedback && (
        <div className="fixed top-4 right-4 bg-green-100 border border-green-300 rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Comodín aplicado correctamente</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-600" /> Mi Grupo
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-gray-600">{groupData.tournament?.title} - Ronda {groupData.tournament?.currentRound}</p>
            <Badge variant="outline">{groupStats.progress}% completado</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={retry}><RefreshCw className="w-4 h-4" />Actualizar</Button>
        </div>
      </div>

      {/* Overview */}
      {showTournamentOverview && <TournamentOverviewCard tournamentId={groupData.tournament?.id} currentUserId={sortedPlayers.find(p => p.isCurrentUser)?.id} />}
      {showPreviewCard && groupData.group?.id && <PointsPreviewCard groupId={groupData.group.id} currentUserId={sortedPlayers.find(p => p.isCurrentUser)?.id} refreshTrigger={previewRefreshTrigger} />}

      {/* Party scheduling */}
      {groupData.party?.groupId && (
        <PartyScheduling groupId={groupData.party.groupId} currentUserId={sortedPlayers.find(p => p.isCurrentUser)?.id ?? ""} isParticipant={true} onUpdate={handlePartyUpdate} />
      )}

      {/* Jugadores */}
      <Card className={`${groupInfo.color} border-2`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GroupIcon className="w-6 h-6" /> Grupo {groupData.group?.number} - {groupInfo.level}</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedPlayers.map((player: PlayerType, index: number) => {
            const movement = player.movement ?? { type: "maintain", groups: 0, text: "Se mantiene", color: "text-gray-600", bgColor: "bg-gray-50 border-gray-200" };
            return (
              <div key={player.id} className="flex justify-between p-2 border rounded">
                <div>
                  <strong>{player.name}</strong> {player.isCurrentUser && "(Tú)"}
                  <div>{round1(player.points)} puntos</div>
                </div>
                <div className={`${movement.color}`}>{movement.text}</div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
