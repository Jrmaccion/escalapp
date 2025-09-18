// components/dashboard/TournamentOverviewCard.tsx - CON PREVIEW GLOBAL DE PUNTOS
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Trophy, Users, Calendar, Clock, CheckCircle, Play, 
  ChevronDown, ChevronUp, Flame, Crown, Eye, EyeOff,
  TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle,
  Maximize2, Target, Star, Zap
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePointsPreview } from "@/hooks/usePointsPreview";

type GroupPlayer = {
  playerId: string;
  name: string;
  position: number;
  points: number;
  streak: number;
  isCurrentUser: boolean;
};

type GroupOverview = {
  groupId: string;
  groupNumber: number;
  level: number;
  players: GroupPlayer[];
  scheduleStatus: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED";
  scheduledDate: string | null;
  completedSets: number;
  totalSets: number;
  needsAction: boolean;
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
  };
};

type Props = {
  tournamentId: string;
};

// Componente para mostrar preview de un grupo específico
function GroupPointsPreview({ groupId, groupNumber }: { groupId: string; groupNumber: number }) {
  const { preview, isLoading, error } = usePointsPreview(groupId, {
    enabled: true,
    refreshInterval: 60000, // Más lento para vista global
    silentRefresh: true
  });

  const getMovementIcon = (movement: 'up' | 'down' | 'stay') => {
    switch (movement) {
      case 'up': return <TrendingUp className="w-3 h-3 text-green-600" />;
      case 'down': return <TrendingDown className="w-3 h-3 text-red-600" />;
      default: return <Minus className="w-3 h-3 text-blue-600" />;
    }
  };

  const getMovementText = (movement: 'up' | 'down' | 'stay') => {
    switch (movement) {
      case 'up': return 'Sube';
      case 'down': return 'Baja';
      default: return 'Se mantiene';
    }
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return "🥇";
      case 2: return "🥈"; 
      case 3: return "🥉";
      default: return `#${position}`;
    }
  };

  if (isLoading || !preview || preview.completionRate === 0) {
    return (
      <div className="text-center py-2 text-gray-500 text-xs">
        {isLoading ? "Calculando..." : "Sin sets confirmados"}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header con progreso */}
      <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
        <span>{preview.completedSets}/{preview.totalSets} sets</span>
        <span className={preview.isComplete ? "text-green-600 font-medium" : ""}>
          {preview.isComplete ? "Completo" : `${Math.round(preview.completionRate)}%`}
        </span>
      </div>

      {/* Grid de jugadores con puntos y movimientos */}
      <div className="grid grid-cols-2 gap-2">
        {preview.players
          .sort((a, b) => a.provisionalPosition - b.provisionalPosition)
          .map((player) => {
            const movement = preview.movements[player.playerId] || 'stay';
            const MovementIcon = getMovementIcon(movement);
            
            return (
              <div
                key={player.playerId}
                className="p-2 rounded-lg text-xs border transition-all bg-white border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200 flex items-center justify-center text-xs font-bold">
                      {getPositionIcon(player.provisionalPosition)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs truncate">
                        {player.playerName}
                      </div>
                      <div className="text-xs text-gray-600">
                        {player.provisionalPoints.toFixed(1)} pts
                        {player.setsWon > 0 && (
                          <span className="text-green-600 ml-1">
                            • {player.setsWon} sets
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`flex items-center gap-1 ${
                      movement === 'up' ? 'text-green-600' : 
                      movement === 'down' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {MovementIcon}
                      <span className="text-xs font-medium">
                        {getMovementText(movement)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function TournamentOverviewCard({ tournamentId }: Props) {
  const [data, setData] = useState<TournamentOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [showOnlyMyActions, setShowOnlyMyActions] = useState(false);
  const [showPreviewMode, setShowPreviewMode] = useState(true);

  const fetchTournamentOverview = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/tournaments/${tournamentId}/overview`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al cargar datos del torneo');
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentOverview();
    }
  }, [tournamentId]);

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Cargando información del torneo...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-md border-red-200">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <Button onClick={fetchTournamentOverview} size="sm" variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const filteredGroups = data.groups.filter((group: GroupOverview) => {
    if (showOnlyMyActions) {
      return group.needsAction || group.groupId === data.userCurrentGroupId;
    }
    return true;
  });

  const groupsToShow = showAllGroups ? filteredGroups : filteredGroups.slice(0, 3);

  return (
    <>
      <Card className="shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-orange-600" />
              Todos los grupos del torneo
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={showPreviewMode ? "default" : "outline"}
                size="sm"
                onClick={() => setShowPreviewMode(!showPreviewMode)}
              >
                {showPreviewMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="ml-2 hidden sm:inline">
                  {showPreviewMode ? "Con Preview" : "Vista Simple"}
                </span>
              </Button>
              <Badge className="bg-orange-100 text-orange-800">
                {data.stats.totalGroups} grupos
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchTournamentOverview}
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Estadísticas resumidas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-700">{data.stats.totalGroups}</div>
              <div className="text-xs text-blue-600">Grupos totales</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-700">{data.stats.scheduledGroups}</div>
              <div className="text-xs text-green-600">Programados</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-700">{data.stats.completedGroups}</div>
              <div className="text-xs text-purple-600">Completados</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-lg font-bold text-orange-700">{data.stats.userPendingActions}</div>
              <div className="text-xs text-orange-600">Mis acciones</div>
            </div>
          </div>

          {/* Controles de filtrado */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant={showOnlyMyActions ? "default" : "outline"}
                size="sm"
                onClick={() => setShowOnlyMyActions(!showOnlyMyActions)}
              >
                {showOnlyMyActions ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                {showOnlyMyActions ? "Mis grupos" : "Todos los grupos"}
              </Button>
            </div>
            <div className="text-xs text-gray-500">
              {filteredGroups.length} grupos
            </div>
          </div>

          {/* Vista de grupos con preview */}
          <div className="space-y-6">
            {groupsToShow.map((group: GroupOverview) => {
              const isUserGroup = group.groupId === data.userCurrentGroupId;

              return (
                <div key={group.groupId} className="space-y-3">
                  {/* Header del grupo */}
                  <div className={`flex items-center justify-between p-4 rounded-lg ${
                    isUserGroup 
                      ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200" 
                      : "bg-gray-50 border border-gray-200"
                  }`}>
                    <div className="flex items-center gap-3">
                      <Badge className={`font-semibold text-lg px-3 py-1 ${
                        group.level <= 2 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                        group.level <= 4 ? 'bg-blue-100 text-blue-800 border-blue-300' :
                        'bg-gray-100 text-gray-800 border-gray-300'
                      } border`}>
                        Grupo {group.groupNumber}
                      </Badge>
                      <span className="text-sm text-gray-600">Nivel: {group.level}</span>
                      {isUserGroup && (
                        <Badge className="bg-blue-600 text-white">
                          <Target className="w-3 h-3 mr-1" />
                          Tu grupo
                        </Badge>
                      )}
                      {group.needsAction && (
                        <Badge className="bg-orange-500 text-white animate-pulse">
                          <Zap className="w-3 h-3 mr-1" />
                          Acción requerida
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500">
                        {group.completedSets}/{group.totalSets} sets ({Math.round((group.completedSets / group.totalSets) * 100)}%)
                      </div>
                    </div>
                  </div>

                  {/* Preview de puntos del grupo */}
                  {showPreviewMode ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <GroupPointsPreview 
                        groupId={group.groupId} 
                        groupNumber={group.groupNumber}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {group.players
                        .sort((a: GroupPlayer, b: GroupPlayer) => a.position - b.position)
                        .map((player: GroupPlayer) => (
                          <div
                            key={player.playerId}
                            className={`p-3 rounded-lg border transition-all ${
                              player.isCurrentUser 
                                ? "bg-blue-50 border-blue-200" 
                                : "bg-white border-gray-200"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">
                                {player.position === 1 ? "🥇" : player.position === 2 ? "🥈" : player.position === 3 ? "🥉" : `#${player.position}`}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {player.name}
                                  {player.isCurrentUser && (
                                    <span className="text-blue-600 text-xs ml-1">(Tú)</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {player.points.toFixed(1)} pts
                                  {player.streak > 0 && (
                                    <span className="text-orange-600 ml-1">• x{player.streak}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Botón para mostrar/ocultar más grupos */}
          {filteredGroups.length > 3 && (
            <div className="text-center pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllGroups(!showAllGroups)}
                className="w-full sm:w-auto"
              >
                {showAllGroups ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Ver todos los grupos ({filteredGroups.length - 3} más)
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export { TournamentOverviewCard };