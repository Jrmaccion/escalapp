// components/PointsPreviewCard.tsx - MODIFICADO COMPLETO
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
  Info
} from "lucide-react";
import { usePointsPreview } from "@/hooks/usePointsPreview";
import type { PointsPreview } from "@/lib/points-calculator";

type Props = {
  groupId: string;
  currentUserId?: string;
  showAllPlayers?: boolean;
  compact?: boolean;
  className?: string;
  refreshTrigger?: number;
};

function PointsPreviewCard({ 
  groupId, 
  currentUserId, 
  showAllPlayers = false, 
  compact = false,
  className = "",
  refreshTrigger
}: Props) {
  const { 
    preview, 
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

  // Trigger refresh when parent requests it
  React.useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refresh();
    }
  }, [refreshTrigger, refresh]);

  if (isLoading && !preview) {
    return (
      <Card className={`border-blue-200 bg-blue-50 ${className}`}>
        <CardContent className="p-4 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-blue-700">Calculando preview de puntos...</p>
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
                {error || "No se pudo calcular el preview de puntos"}
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

  const getMovementIcon = (movement: 'up' | 'down' | 'stay') => {
    switch (movement) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Minus className="w-4 h-4 text-blue-600" />;
    }
  };

  const getMovementText = (movement: 'up' | 'down' | 'stay', position: number) => {
    switch (movement) {
      case 'up': return position === 1 ? 'Sube de grupo' : 'Mejora posición';
      case 'down': return 'Baja de grupo';
      default: return 'Se mantiene';
    }
  };

  const getMovementBadgeColor = (movement: 'up' | 'down' | 'stay') => {
    switch (movement) {
      case 'up': return 'bg-green-100 text-green-700 border-green-200';
      case 'down': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
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

  const getPositionBgColor = (position: number, isCurrentUser: boolean) => {
    if (isCurrentUser) {
      return "bg-white border-indigo-300 ring-2 ring-indigo-200 shadow-md";
    }
    
    switch (position) {
      case 1: return "bg-yellow-50 border-yellow-200";
      case 2: return "bg-gray-50 border-gray-200";
      case 3: return "bg-orange-50 border-orange-200";
      default: return "bg-white border-gray-200";
    }
  };

  // Filtrar y ordenar jugadores
  const playersToShow = showAllPlayers 
    ? preview.players 
    : preview.players.filter(p => p.playerId === currentUserId);

  if (playersToShow.length === 0 && currentUserId) {
    return (
      <Card className={`border-amber-200 bg-amber-50 ${className}`}>
        <CardContent className="p-4 text-center">
          <Info className="w-6 h-6 text-amber-600 mx-auto mb-2" />
          <p className="text-sm text-amber-800">
            No se encontraron datos para tu jugador
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg ${className}`}>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <div className="flex items-center justify-between">
          <CardTitle className={`flex items-center gap-2 ${compact ? 'text-base' : 'text-lg'}`}>
            <Eye className="w-5 h-5 text-indigo-600" />
            {preview.isComplete ? "Puntos de la Ronda" : "Preview de Puntos"}
            {hasChanges && (
              <Badge className="bg-green-500 text-white animate-pulse">
                <Zap className="w-3 h-3 mr-1" />
                Actualizado
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
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
            Puntos calculados con sets confirmados. Preview provisional.
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
              const movement = preview.movements[player.playerId] || 'stay';
              const MovementIcon = getMovementIcon(movement);
              const isCurrentUser = player.playerId === currentUserId;
              
              return (
                <div
                  key={player.playerId}
                  className={`p-4 rounded-lg border-2 transition-all hover:shadow-sm ${getPositionBgColor(
                    player.provisionalPosition,
                    isCurrentUser
                  )}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border-2 border-indigo-200 flex items-center justify-center font-bold text-sm shadow-sm">
                        {getPositionIcon(player.provisionalPosition)}
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
                                  <span className="text-gray-500">Puntos ganados:</span>
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
                              <span className="text-gray-500">Sets ganados:</span> {player.setsWon}/{player.setsPlayed}
                            </span>
                            <span>
                              <span className="text-gray-500">Juegos:</span> {player.gamesWon}
                            </span>
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
                          {getMovementText(movement, player.provisionalPosition)}
                        </span>
                      </Badge>
                      
                      <div className="text-xs text-gray-500 mt-1">
                        {preview.isComplete ? "Posición final" : "Posición actual"}: {player.provisionalPosition}°
                      </div>
                      
                      {player.deltaPosition !== 0 && !preview.isComplete && (
                        <div className="text-xs text-gray-500">
                          {player.deltaPosition > 0 
                            ? `↑ ${player.deltaPosition} pos.` 
                            : `↓ ${Math.abs(player.deltaPosition)} pos.`
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
            })}
            
            {/* Footer con información del preview */}
            <div className="mt-4 p-3 bg-white/60 rounded-lg border border-indigo-100">
              <div className="flex items-center justify-between text-xs">
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