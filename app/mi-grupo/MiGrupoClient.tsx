// app/mi-grupo/MiGrupoClient.tsx - VERSIÓN SIN ERRORES TYPESCRIPT
"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
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
  CalendarPlus,
  ArrowUp,
  ArrowDown,
  Target,
  Flame,
  RefreshCw,
  Crown,
  Star
} from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import UseComodinButton from "@/components/player/UseComodinButton";
import { useGroupData } from "@/hooks/useApiState";
import { LoadingState, ErrorState, EmptyState, UpdateBadge } from "@/components/ApiStateComponents";

/* =========
   Tipos simplificados
   ========= */
type GroupData = {
  hasGroup: boolean;
  roundId?: string;
  message?: string;
  tournament?: {
    title: string;
    currentRound: number;
  };
  group?: {
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
  allMatches?: Array<{
    id: string;
    setNumber: number;
    partner: string;
    opponents: string[];
    hasResult: boolean;
    isPending: boolean;
    isConfirmed: boolean;
    status?: string;
    proposedDate?: string | null;
    acceptedDate?: string | null;
    acceptedCount?: number;
    team1Player1Name?: string;
    team1Player2Name?: string;
    team2Player1Name?: string;
    team2Player2Name?: string;
    team1Games?: number | null;
    team2Games?: number | null;
  }>;
};

// Tipo para los matches con tipos explícitos
type MatchType = NonNullable<GroupData["allMatches"]>[0];
type PlayerType = NonNullable<GroupData["players"]>[0];

/* =========
   Datos de preview
   ========= */
const PREVIEW_DATA: GroupData = {
  hasGroup: true,
  tournament: {
    title: "Torneo Escalera Primavera 2025",
    currentRound: 2,
  },
  group: {
    number: 2,
    level: "Nivel Medio",
    totalPlayers: 4,
  },
  myStatus: {
    position: 1,
    points: 8.5,
    streak: 2,
  },
  players: [
    { id: "you", name: "Tu Nombre", points: 8.5, position: 1, isCurrentUser: true },
    { id: "2", name: "Ana García", points: 7.2, position: 2, isCurrentUser: false },
    { id: "3", name: "Miguel López", points: 6.8, position: 3, isCurrentUser: false },
    { id: "4", name: "Laura Rodríguez", points: 5.1, position: 4, isCurrentUser: false },
  ],
  allMatches: [
    {
      id: "1",
      setNumber: 1,
      partner: "Laura Rodríguez",
      opponents: ["Ana García", "Miguel López"],
      hasResult: true,
      isPending: false,
      isConfirmed: true,
      status: "SCHEDULED",
      team1Player1Name: "Tu Nombre",
      team1Player2Name: "Laura Rodríguez",
      team2Player1Name: "Ana García",
      team2Player2Name: "Miguel López",
      team1Games: 4,
      team2Games: 2,
    },
    {
      id: "2",
      setNumber: 2,
      partner: "Miguel López",
      opponents: ["Ana García", "Laura Rodríguez"],
      hasResult: true,
      isPending: false,
      isConfirmed: false,
      status: "DATE_PROPOSED",
      acceptedCount: 3,
      team1Player1Name: "Tu Nombre",
      team1Player2Name: "Miguel López",
      team2Player1Name: "Ana García",
      team2Player2Name: "Laura Rodríguez",
      team1Games: 5,
      team2Games: 4,
    },
    {
      id: "3",
      setNumber: 3,
      partner: "Ana García",
      opponents: ["Miguel López", "Laura Rodríguez"],
      hasResult: false,
      isPending: true,
      isConfirmed: false,
      status: "PENDING",
      team1Player1Name: "Tu Nombre",
      team1Player2Name: "Ana García",
      team2Player1Name: "Miguel López",
      team2Player2Name: "Laura Rodríguez",
      team1Games: null,
      team2Games: null,
    },
  ],
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export default function MiGrupoClient() {
  const { data: session } = useSession();
  
  // HOOK UNIFICADO
  const {
    data,
    isLoading,
    hasError,
    error,
    retry,
    hasUpdates,
    loadingMessage
  } = useGroupData();

  // CRÍTICO: Estado para manejar refreshTrigger del comodín
  const [comodinRefreshTrigger, setComodinRefreshTrigger] = useState(0);
  const [lastComodinAction, setLastComodinAction] = useState<string | null>(null);
  const [showActionFeedback, setShowActionFeedback] = useState(false);

  const isPreviewMode = !data?.hasGroup;
  const groupData = data?.hasGroup ? data : PREVIEW_DATA;

  // CRÍTICO: Callback corregido para cuando se usa comodín
  const handleComodinAction = useCallback(() => {
    console.log('[MiGrupoClient] Comodin action triggered');
    
    // Incrementar el trigger para forzar refresh en UseComodinButton
    setComodinRefreshTrigger(prev => prev + 1);
    
    // Guardar información de la acción para feedback visual
    setLastComodinAction('aplicado');
    setShowActionFeedback(true);
    
    // Ocultar feedback después de 3 segundos
    setTimeout(() => {
      setShowActionFeedback(false);
    }, 3000);

    // Refresco manual del estado del grupo tras un delay
    setTimeout(() => {
      console.log('[MiGrupoClient] Triggering group data refresh');
      retry();
    }, 1500);
  }, [retry]);

  // Auto-refresh periódico cada 30 segundos si hay datos
  useEffect(() => {
    if (!isPreviewMode && data?.hasGroup) {
      const interval = setInterval(() => {
        retry();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isPreviewMode, data?.hasGroup, retry]);

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

    switch (match.status) {
      case "SCHEDULED":
        return {
          label: "Programado",
          color: "bg-blue-100 text-blue-700 border-blue-200",
          icon: Calendar,
        };
      case "DATE_PROPOSED":
        return {
          label: `Fecha propuesta (${match.acceptedCount || 0}/4)`,
          color: "bg-purple-100 text-purple-700 border-purple-200",
          icon: Calendar,
        };
      default:
        return {
          label: "Sin programar",
          color: "bg-gray-100 text-gray-700 border-gray-200",
          icon: CalendarPlus,
        };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
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
  const { matches, completedMatches, groupInfo, GroupIcon } = useMemo(() => {
    const sortedMatches = (groupData.allMatches || [])
      .slice()
      .sort((a: MatchType, b: MatchType) => a.setNumber - b.setNumber);
    
    const completed = sortedMatches.filter((m: MatchType) => m.isConfirmed);
    const info = getGroupLevelInfo(groupData.group?.number || 2);
    
    return {
      matches: sortedMatches,
      completedMatches: completed,
      groupInfo: info,
      GroupIcon: info.icon
    };
  }, [groupData.allMatches, groupData.group?.number]);

  // Estados de carga unificados
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

  if (!groupData) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <EmptyState 
          message="No se pudo cargar la información del grupo"
          icon={Users}
          action={<Button onClick={retry}>Reintentar</Button>}
        />
      </div>
    );
  }

  return (
    <div className={`px-4 py-6 max-w-6xl mx-auto space-y-6 ${isPreviewMode ? "opacity-75" : ""}`}>
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

      {/* Header con botón de refresh manual */}
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
          {isPreviewMode && (
            <div className="text-right">
              <Badge variant="secondary" className="mb-2">
                Vista Previa
              </Badge>
              <p className="text-sm text-gray-500">Datos de ejemplo</p>
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

          {/* Sistema de comodín - CRÍTICO: Pasar refreshTrigger correctamente */}
          {!isPreviewMode && groupData.roundId && (
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
          {!isPreviewMode && !groupData.roundId && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Comodín no disponible:</strong> No se pudo obtener la información de la ronda actual.
              </p>
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

      {/* Sets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Mis Sets de la Ronda
          </CardTitle>
          <p className="text-sm text-gray-600">Los 4 jugadores del grupo juegan 3 sets con rotación de parejas</p>
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
                      {!isPreviewMode && !match.isConfirmed && (
                        <Link href={`/match/${match.id}`}>
                          <Button size="sm">{match.hasResult ? "Confirmar" : "Jugar/Programar"}</Button>
                        </Link>
                      )}
                      {isPreviewMode && !match.isConfirmed && (
                        <Button size="sm" disabled>
                          {match.hasResult ? "Confirmar" : "Jugar/Programar"}
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="text-center">
                        <div className="font-semibold text-blue-700 mb-1">
                          {match.team1Player1Name || match.partner
                            ? `${match.team1Player1Name} + ${match.team1Player2Name}`
                            : `Tú + ${match.partner}`}
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
                          {match.team2Player1Name && match.team2Player2Name
                            ? `${match.team2Player1Name} + ${match.team2Player2Name}`
                            : match.opponents?.join(" + ") || "Oponentes"}
                        </div>
                        {match.hasResult && <div className="text-2xl font-bold">{match.team2Games}</div>}
                      </div>
                    </div>

                    {/* Información adicional del partido */}
                    {match.status === "SCHEDULED" && match.acceptedDate && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex items-center gap-2 text-blue-700 text-sm">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">Programado para:</span>
                          <span>{formatDate(match.acceptedDate)}</span>
                        </div>
                      </div>
                    )}

                    {match.status === "DATE_PROPOSED" && match.proposedDate && (
                      <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded">
                        <div className="flex items-center gap-2 text-purple-700 text-sm">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">Fecha propuesta:</span>
                          <span>{formatDate(match.proposedDate)}</span>
                        </div>
                        <div className="text-purple-600 text-xs mt-1">
                          Confirmado por {match.acceptedCount || 0} de 4 jugadores
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CTA para preview */}
      {isPreviewMode && (
        <Card className="border-dashed border-2 border-blue-300 bg-blue-50">
          <CardContent className="p-8 text-center">
            <Target className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-blue-900 mb-2">¡Ve Tu Grupo Real!</h3>
            <p className="text-blue-700 mb-6">
              Estos son datos de ejemplo. Únete a un torneo para competir en tu grupo real.
            </p>
            <Button variant="default">Contactar Administrador</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}