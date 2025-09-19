// components/PointsPreviewCard.tsx - CORREGIDO CON VALIDACIÓN ROBUSTA
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Eye, 
  RefreshCw, 
  CheckCircle,
  Clock,
  AlertTriangle,
  Zap,
  Crown,
  Flame,
  Info,
  ArrowUp,
  ArrowDown,
  Target,
  Trophy,
  Medal,
  Award,
  Users
} from "lucide-react";
import { usePointsPreview } from "@/hooks/usePointsPreview";

// Tipos seguros con validación
type SafePlayer = {
  playerId: string;
  playerName: string;
  currentPoints: number;
  provisionalPoints: number;
  deltaPoints: number;
  setsWon: number;
  setsPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDifference: number;
  h2hWins: number;
  headToHeadRecord?: {
    wins: number;
    losses: number;
  };
  currentPosition: number;
  provisionalPosition: number;
  deltaPosition: number;
  streak: number;
  usedComodin: boolean;
  movement: {
    type: 'up' | 'down' | 'same';
    groups: number;
    description: string;
  };
};

type SafePreview = {
  groupId: string;
  groupNumber: number;
  groupLevel: number;
  completedSets: number;
  totalSets: number;
  pendingSets: number;
  completionRate: number;
  isComplete: boolean;
  players: SafePlayer[];
  movements: Record<string, SafePlayer['movement']>;
  ladderInfo: {
    isTopGroup: boolean;
    isBottomGroup: boolean;
    totalGroups: number;
  };
  lastUpdated: string;
};

type Props = {
  groupId: string;
  currentUserId?: string;
  showAllPlayers?: boolean;
  compact?: boolean;
  className?: string;
  refreshTrigger?: number;
};

// Función de validación y transformación segura
function validateAndTransformPreview(rawPreview: any): SafePreview | null {
  if (!rawPreview || typeof rawPreview !== 'object') {
    console.warn("Preview data is invalid:", rawPreview);
    return null;
  }

  try {
    // Validar propiedades principales
    const groupId = rawPreview.groupId || '';
    const groupNumber = Number(rawPreview.groupNumber) || 0;
    const groupLevel = Number(rawPreview.groupLevel || rawPreview.level) || 1;
    const completedSets = Number(rawPreview.completedSets) || 0;
    const totalSets = Number(rawPreview.totalSets) || 0;
    const pendingSets = Number(rawPreview.pendingSets) || Math.max(0, totalSets - completedSets);
    const completionRate = Number(rawPreview.completionRate) || (totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0);
    const isComplete = Boolean(rawPreview.isComplete) || completionRate === 100;

    // Validar jugadores
    const rawPlayers = Array.isArray(rawPreview.players) ? rawPreview.players : [];
    const validPlayers: SafePlayer[] = [];

    for (const player of rawPlayers) {
      if (!player || typeof player !== 'object' || !player.playerId) {
        console.warn("Invalid player data:", player);
        continue;
      }

      const safeBPlayer: SafePlayer = {
        playerId: String(player.playerId),
        playerName: String(player.playerName || player.name || 'Jugador desconocido'),
        currentPoints: Number(player.currentPoints || player.points) || 0,
        provisionalPoints: Number(player.provisionalPoints || player.projectedPoints || player.currentPoints || player.points) || 0,
        deltaPoints: Number(player.deltaPoints) || 0,
        setsWon: Number(player.setsWon || player.sets) || 0,
        setsPlayed: Number(player.setsPlayed || player.setsTotal) || 0,
        gamesWon: Number(player.gamesWon || player.games) || 0,
        gamesLost: Number(player.gamesLost) || 0,
        gamesDifference: Number(player.gamesDifference) || 0,
        h2hWins: Number(player.h2hWins) || 0,
        headToHeadRecord: player.headToHeadRecord ? {
          wins: Number(player.headToHeadRecord.wins) || 0,
          losses: Number(player.headToHeadRecord.losses) || 0
        } : undefined,
        currentPosition: Number(player.currentPosition || player.position) || 0,
        provisionalPosition: Number(player.provisionalPosition || player.projectedPosition) || 0,
        deltaPosition: Number(player.deltaPosition) || 0,
        streak: Number(player.streak) || 0,
        usedComodin: Boolean(player.usedComodin),
        movement: {
          type: (player.movement?.type || 'same') as 'up' | 'down' | 'same',
          groups: Number(player.movement?.groups) || 0,
          description: String(player.movement?.description || player.movement?.text || 'Se mantiene')
        }
      };

      // Calcular deltas si no están disponibles
      if (!safeBPlayer.deltaPoints) {
        safeBPlayer.deltaPoints = safeBPlayer.provisionalPoints - safeBPlayer.currentPoints;
      }
      if (!safeBPlayer.deltaPosition) {
        safeBPlayer.deltaPosition = safeBPlayer.currentPosition - safeBPlayer.provisionalPosition;
      }
      if (!safeBPlayer.gamesDifference) {
        safeBPlayer.gamesDifference = safeBPlayer.gamesWon - safeBPlayer.gamesLost;
      }

      validPlayers.push(safeBPlayer);
    }

    // Validar movements
    const movements: Record<string, SafePlayer['movement']> = {};
    if (rawPreview.movements && typeof rawPreview.movements === 'object') {
      for (const [playerId, movement] of Object.entries(rawPreview.movements)) {
        if (movement && typeof movement === 'object') {
          movements[playerId] = {
            type: (movement as any).type || 'same',
            groups: Number((movement as any).groups) || 0,
            description: String((movement as any).description || (movement as any).text || 'Se mantiene')
          };
        }
      }
    }

    // Validar ladderInfo
    const ladderInfo = {
      isTopGroup: Boolean(rawPreview.ladderInfo?.isTopGroup) || groupLevel === 1,
      isBottomGroup: Boolean(rawPreview.ladderInfo?.isBottomGroup),
      totalGroups: Number(rawPreview.ladderInfo?.totalGroups) || 10
    };

    return {
      groupId,
      groupNumber,
      groupLevel,
      completedSets,
      totalSets,
      pendingSets,
      completionRate,
      isComplete,
      players: validPlayers,
      movements,
      ladderInfo,
      lastUpdated: rawPreview.lastUpdated || new Date().toISOString()
    };

  } catch (error) {
    console.error("Error validating preview data:", error, rawPreview);
    return null;
  }
}

function PointsPreviewCard({ 
  groupId, 
  currentUserId, 
  showAllPlayers = false, 
  compact = false,
  className = "",
  refreshTrigger
}: Props) {
  const { 
    preview: rawPreview, 
    isLoading, 
    error, 
    hasChanges, 
    refresh, 
    clearChanges 
  } = usePointsPreview(groupId, {
    enabled: true,
    refreshInterval: 30000,
    autoRefreshOnSetConfirmation: true
  });

  // Validar y transformar datos de forma segura
  const preview = React.useMemo(() => {
    if (!rawPreview) return null;
    return validateAndTransformPreview(rawPreview);
  }, [rawPreview]);

  // Trigger refresh when parent requests it
  React.useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refresh();
    }
  }, [refreshTrigger, refresh]);

  if (isLoading && !preview) {
    return (
      <Card className={`border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 ${className}`}>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
          <p className="text-sm text-indigo-700">Calculando preview de puntos...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !preview) {
    return (
      <Card className={`border-amber-200 bg-amber-50 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-amber-800 font-medium">
                Preview no disponible
              </p>
              <p className="text-xs text-amber-700 mt-1">
                {error || "No se pudo procesar los datos del preview"}
              </p>
              <Button 
                onClick={refresh} 
                size="sm" 
                variant="outline" 
                className="mt-2 text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Reintentar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getMovementIcon = (movement: SafePlayer['movement']) => {
    if (!movement || movement.type === 'same') {
      return <Minus className="w-4 h-4 text-blue-600" />;
    }
    if (movement.type === 'up') {
      return <ArrowUp className="w-4 h-4 text-green-600" />;
    }
    if (movement.type === 'down') {
      return <ArrowDown className="w-4 h-4 text-red-600" />;
    }
    return <Target className="w-4 h-4 text-gray-600" />;
  };

  const getMovementBadgeColor = (movement: SafePlayer['movement']) => {
    if (!movement || movement.type === 'same') {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    if (movement.type === 'up') {
      return 'bg-green-100 text-green-700 border-green-200';
    }
    if (movement.type === 'down') {
      return 'bg-red-100 text-red-700 border-red-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2: return <Medal className="w-5 h-5 text-gray-500" />;
      case 3: return <Award className="w-5 h-5 text-orange-500" />;
      default: return <Target className="w-4 h-4 text-blue-500" />;
    }
  };

  const getPositionBgColor = (position: number, isCurrentUser: boolean) => {
    const baseClasses = isCurrentUser 
      ? "bg-white border-indigo-300 ring-2 ring-indigo-200 shadow-lg" 
      : "bg-white border-gray-200";
    
    switch (position) {
      case 1: return `${baseClasses} border-yellow-300 bg-gradient-to-br from-yellow-50 to-yellow-100`;
      case 2: return `${baseClasses} border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100`;
      case 3: return `${baseClasses} border-orange-300 bg-gradient-to-br from-orange-50 to-orange-100`;
      default: return baseClasses;
    }
  };

  const getLevelBadgeInfo = (level: number) => {
    if (level === 1) {
      return {
        text: "Grupo Superior",
        className: "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-300",
        icon: <Crown className="w-3 h-3" />
      };
    } else if (level <= 3) {
      return {
        text: `Grupo Nivel ${level}`,
        className: "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-blue-300",
        icon: <Trophy className="w-3 h-3" />
      };
    } else {
      return {
        text: `Grupo Nivel ${level}`,
        className: "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border-gray-300",
        icon: <Users className="w-3 h-3" />
      };
    }
  };

  // Filtrar y ordenar jugadores - VALIDACIÓN SEGURA
  const playersToShow = showAllPlayers 
    ? preview.players 
    : preview.players.filter(p => p.playerId === currentUserId);

  if (playersToShow.length === 0 && currentUserId) {
    return (
      <Card className={`border-amber-200 bg-amber-50 ${className}`}>
        <CardContent className="p-4 text-center">
          <Info className="w-6 h-6 text-amber-600 mx-auto mb-2" />
          <p className="text-sm text-amber-800">
            No se encontraron datos para tu jugador en este grupo
          </p>
          <Button onClick={refresh} size="sm" className="mt-2">
            <RefreshCw className="w-3 h-3 mr-1" />
            Actualizar datos
          </Button>
        </CardContent>
      </Card>
    );
  }

  const levelInfo = getLevelBadgeInfo(preview.groupLevel);

  return (
    <Card className={`border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg ${className}`}>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <div className="flex items-center justify-between">
          <CardTitle className={`flex items-center gap-2 ${compact ? 'text-base' : 'text-lg'}`}>
            <Eye className="w-5 h-5 text-indigo-600" />
            {preview.isComplete ? "Resultados Finales" : "Preview de Puntos"}
            {hasChanges && (
              <Badge className="bg-green-500 text-white animate-pulse">
                <Zap className="w-3 h-3 mr-1" />
                Actualizado
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Badge className={`text-xs border ${levelInfo.className}`}>
              {levelInfo.icon}
              <span className="ml-1">{levelInfo.text}</span>
            </Badge>
            
            <Badge 
              variant="outline" 
              className={`text-xs ${preview.isComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
            >
              {preview.isComplete ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Completo
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3 mr-1" />
                  {preview.completionRate}%
                </>
              )}
            </Badge>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                refresh();
                clearChanges();
              }}
              disabled={isLoading}
              className="h-6 w-6 p-0"
              title="Actualizar preview"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {!showAllPlayers && currentUserId && !preview.isComplete && (
          <p className="text-xs text-indigo-600">
            Puntos calculados con sets confirmados. Sistema de escalera actualizado.
          </p>
        )}
      </CardHeader>
      
      <CardContent className={compact ? "pt-0" : undefined}>
        {preview.completionRate === 0 ? (
          <div className="text-center py-6">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600 font-medium">
              Sin sets confirmados aún
            </p>
            <p className="text-xs text-gray-500 mt-2">
              El preview aparecerá cuando se confirmen resultados
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {playersToShow.map((player) => {
              // Validación adicional del jugador
              if (!player || !player.playerId) {
                console.warn("Invalid player in render:", player);
                return null;
              }

              const movement = preview.movements[player.playerId] || player.movement;
              const MovementIcon = getMovementIcon(movement);
              const isCurrentUser = player.playerId === currentUserId;
              
              return (
                <div
                  key={player.playerId}
                  className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${getPositionBgColor(
                    player.provisionalPosition,
                    isCurrentUser
                  )}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border-2 border-indigo-200 flex items-center justify-center font-bold text-lg shadow-sm">
                        {player.provisionalPosition === 1 ? "🥇" : 
                         player.provisionalPosition === 2 ? "🥈" : 
                         player.provisionalPosition === 3 ? "🥉" : 
                         `#${player.provisionalPosition}`}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {showAllPlayers ? player.playerName : "Tu posición"}
                          </span>
                          {isCurrentUser && (
                            <Badge className="bg-indigo-600 text-white text-xs">
                              Tú
                            </Badge>
                          )}
                          {player.provisionalPosition === 1 && (
                            <Crown className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-600 space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              {preview.isComplete ? (
                                <>
                                  <span className="text-gray-500">Puntos finales:</span>
                                  <span className="font-bold text-indigo-700">
                                    {player.provisionalPoints.toFixed(1)} pts
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-500">Puntos:</span>
                                  <span className="line-through text-gray-400">
                                    {player.currentPoints.toFixed(1)}
                                  </span>
                                  →
                                  <span className="font-bold text-indigo-700">
                                    {player.provisionalPoints.toFixed(1)}
                                  </span>
                                  {player.deltaPoints > 0 && (
                                    <span className="text-green-600 font-medium">
                                      (+{player.deltaPoints.toFixed(1)})
                                    </span>
                                  )}
                                </>
                              )}
                            </span>
                            
                            {player.streak > 0 && (
                              <span className="flex items-center gap-1 text-orange-600">
                                <Flame className="w-3 h-3" />
                                x{player.streak}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs">
                            <span>
                              <span className="text-gray-500">Sets:</span> {player.setsWon}/{player.setsPlayed}
                            </span>
                            <span>
                              <span className="text-gray-500">Juegos:</span> {player.gamesWon}-{player.gamesLost}
                            </span>
                            {player.headToHeadRecord && (
                              <span>
                                <span className="text-gray-500">H2H:</span> {player.headToHeadRecord.wins}-{player.headToHeadRecord.losses}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <Badge 
                        className={`${getMovementBadgeColor(movement)} border text-xs mb-1`}
                      >
                        {MovementIcon}
                        <span className="ml-1">
                          {movement ? movement.description : "Se mantiene"}
                        </span>
                      </Badge>
                      
                      <div className="text-xs text-gray-500 mt-1">
                        {preview.isComplete ? "Posición final" : "Posición actual"}: {player.provisionalPosition}°
                      </div>
                      
                      {player.deltaPosition !== 0 && !preview.isComplete && (
                        <div className="text-xs text-gray-500">
                          {player.deltaPosition > 0 
                            ? `↗ ${player.deltaPosition} pos.` 
                            : `↘ ${Math.abs(player.deltaPosition)} pos.`
                          }
                        </div>
                      )}
                      
                      {player.usedComodin && (
                        <div className="text-xs text-purple-600 font-medium mt-1">
                          Comodín usado
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }).filter(Boolean)}
            
            {/* Footer con información del preview mejorado */}
            <div className="mt-4 p-3 bg-white/60 rounded-lg border border-indigo-100">
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-4 text-indigo-700">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    <strong>{preview.completedSets}</strong>/{preview.totalSets} sets
                  </span>
                  <span>
                    {preview.isComplete ? "Ronda completa" : `${Math.round(preview.completionRate)}% completado`}
                  </span>
                  {preview.pendingSets > 0 && (
                    <span className="text-amber-600">
                      {preview.pendingSets} pendientes
                    </span>
                  )}
                </div>
                <div className="text-right text-gray-500">
                  <div>Actualizado:</div>
                  <div className="font-mono">
                    {preview.lastUpdated && new Date(preview.lastUpdated).toLocaleTimeString('es-ES', { 
                      hour: '2-digit', 
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
              
              {/* Sistema de escalera explicado */}
              <div className="mt-2 pt-2 border-t border-indigo-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-indigo-600">
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3 text-green-600" />
                    <span>1°: Sube {preview.ladderInfo.isTopGroup ? "0" : preview.groupLevel === 2 ? "1" : "2"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3 text-green-600" />
                    <span>2°: Sube {preview.ladderInfo.isTopGroup ? "0" : "1"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowDown className="w-3 h-3 text-red-600" />
                    <span>3°: Baja {preview.ladderInfo.isBottomGroup ? "0" : "1"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowDown className="w-3 h-3 text-red-600" />
                    <span>4°: Baja {preview.ladderInfo.isBottomGroup ? "0" : preview.groupLevel === preview.ladderInfo.totalGroups - 1 ? "1" : "2"}</span>
                  </div>
                </div>
              </div>
              
              {preview.isComplete ? (
                <div className="mt-2 pt-2 border-t border-indigo-100">
                  <p className="text-xs text-indigo-600">
                    <Info className="w-3 h-3 inline mr-1" />
                    Movimientos aplicados al cerrar la ronda oficialmente
                  </p>
                </div>
              ) : (
                <div className="mt-2 pt-2 border-t border-indigo-100">
                  <p className="text-xs text-indigo-600">
                    <Info className="w-3 h-3 inline mr-1" />
                    Los movimientos se actualizarán conforme se confirmen más sets
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PointsPreviewCard;