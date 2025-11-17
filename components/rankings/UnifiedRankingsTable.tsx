// components/rankings/UnifiedRankingsTable.tsx - Componente unificado de rankings
"use client";

import React from "react";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Medal,
  Flame,
  Crown,
  Award,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RankingPlayer, RankingType } from "@/lib/hooks/useRankingsData";

type UnifiedRankingsTableProps = {
  officialRankings: RankingPlayer[];
  ironmanRankings: RankingPlayer[];
  tournamentTitle?: string;
  roundNumber?: number;
  compact?: boolean;
  isAdmin?: boolean;
  highlightPlayerId?: string;
};

function getMovementIcon(movement: string) {
  if (movement.includes("⬆") || movement.toLowerCase().includes("sube")) {
    return <TrendingUp className="w-3 h-3 text-green-600" />;
  }
  if (movement.includes("⬇") || movement.toLowerCase().includes("baja")) {
    return <TrendingDown className="w-3 h-3 text-red-600" />;
  }
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function getPositionBadge(position: number, compact = false) {
  const baseClasses = compact ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  if (position === 1) {
    return (
      <Badge className={`${baseClasses} bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-950 font-bold shadow-md`}>
        <Crown className="w-3 h-3 mr-1" />
        {position}º
      </Badge>
    );
  }
  if (position === 2) {
    return (
      <Badge className={`${baseClasses} bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900 font-bold shadow-md`}>
        <Medal className="w-3 h-3 mr-1" />
        {position}º
      </Badge>
    );
  }
  if (position === 3) {
    return (
      <Badge className={`${baseClasses} bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold shadow-md`}>
        <Award className="w-3 h-3 mr-1" />
        {position}º
      </Badge>
    );
  }
  if (position <= 5) {
    return (
      <Badge className={`${baseClasses} bg-blue-100 text-blue-800 font-semibold`}>
        {position}º
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={`${baseClasses} font-medium`}>
      {position}º
    </Badge>
  );
}

function RankingRow({
  player,
  index,
  type,
  compact = false,
  highlightPlayerId,
}: {
  player: RankingPlayer;
  index: number;
  type: RankingType;
  compact?: boolean;
  highlightPlayerId?: string;
}) {
  const position = type === "official" ? player.position : player.ironmanPosition;
  const isHighlighted = highlightPlayerId && player.playerId === highlightPlayerId;
  const isCurrentUser = player.isCurrentUser;

  const rowClasses = `
    transition-all duration-200
    ${compact ? "py-2" : "py-3"}
    ${index % 2 === 0 ? "bg-gray-50/50" : "bg-white"}
    ${isHighlighted || isCurrentUser ? "bg-primary/10 border-l-4 border-primary font-semibold" : ""}
    hover:bg-gray-100/70
  `;

  return (
    <div className={rowClasses}>
      <div className={`grid ${compact ? "grid-cols-4" : "grid-cols-5"} gap-2 items-center px-4`}>
        {/* Posición */}
        <div className="flex items-center gap-2">
          {getPositionBadge(position, compact)}
          {(isHighlighted || isCurrentUser) && (
            <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
          )}
        </div>

        {/* Nombre */}
        <div className={compact ? "col-span-1" : "col-span-2"}>
          <span className={`${isHighlighted || isCurrentUser ? "font-bold text-primary" : "text-gray-900"}`}>
            {player.playerName}
          </span>
          {isCurrentUser && (
            <Badge variant="outline" className="ml-2 text-xs bg-primary/5">
              Tú
            </Badge>
          )}
        </div>

        {/* Puntos */}
        <div className="text-center">
          <div className={`${compact ? "text-sm" : "text-base"} font-bold text-gray-900`}>
            {type === "official"
              ? player.averagePoints.toFixed(2)
              : player.totalPoints.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            {type === "official" ? "media" : "total"}
          </div>
        </div>

        {/* Rondas jugadas */}
        {!compact && (
          <div className="text-center">
            <div className="text-sm text-gray-700">{player.roundsPlayed}</div>
            <div className="text-xs text-gray-500">rondas</div>
          </div>
        )}

        {/* Movimiento */}
        <div className="flex items-center justify-end gap-2">
          {getMovementIcon(player.movement)}
          <span className="text-xs text-gray-600">{player.movement || "="}</span>
        </div>
      </div>
    </div>
  );
}

export default function UnifiedRankingsTable({
  officialRankings,
  ironmanRankings,
  tournamentTitle,
  roundNumber,
  compact = false,
  isAdmin = false,
  highlightPlayerId,
}: UnifiedRankingsTableProps) {
  const [activeTab, setActiveTab] = React.useState<RankingType>("official");

  const currentRankings = activeTab === "official" ? officialRankings : ironmanRankings;

  if (currentRankings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Trophy className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No hay datos de ranking disponibles</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={compact ? "" : "shadow-lg"}>
      {!compact && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Trophy className="w-6 h-6 text-primary" />
                Rankings
              </CardTitle>
              {tournamentTitle && (
                <CardDescription className="mt-1 text-base">
                  {tournamentTitle}
                  {roundNumber && ` - Ronda ${roundNumber}`}
                </CardDescription>
              )}
            </div>
            {isAdmin && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                Modo Admin
              </Badge>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className={compact ? "pt-4" : ""}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RankingType)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="official" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Oficial (Media)
            </TabsTrigger>
            <TabsTrigger value="ironman" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Ironman (Total)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="official" className="mt-0">
            <div className="border rounded-lg overflow-hidden">
              {/* Header */}
              {!compact && (
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
                  <div className="grid grid-cols-5 gap-2 items-center px-4 py-3">
                    <div className="text-xs font-semibold text-gray-700 uppercase">Posición</div>
                    <div className="col-span-2 text-xs font-semibold text-gray-700 uppercase">Jugador</div>
                    <div className="text-xs font-semibold text-gray-700 uppercase text-center">Puntos</div>
                    <div className="text-xs font-semibold text-gray-700 uppercase text-center">Rondas</div>
                  </div>
                </div>
              )}

              {/* Rows */}
              <div className={`divide-y ${compact ? "max-h-96 overflow-y-auto" : ""}`}>
                {currentRankings.map((player, index) => (
                  <RankingRow
                    key={player.playerId}
                    player={player}
                    index={index}
                    type="official"
                    compact={compact}
                    highlightPlayerId={highlightPlayerId}
                  />
                ))}
              </div>
            </div>

            {!compact && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Ranking Oficial:</strong> Ordenado por promedio de puntos (total de puntos dividido por
                  rondas jugadas).
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ironman" className="mt-0">
            <div className="border rounded-lg overflow-hidden">
              {/* Header */}
              {!compact && (
                <div className="bg-gradient-to-r from-orange-100 to-orange-50 border-b">
                  <div className="grid grid-cols-5 gap-2 items-center px-4 py-3">
                    <div className="text-xs font-semibold text-gray-700 uppercase">Posición</div>
                    <div className="col-span-2 text-xs font-semibold text-gray-700 uppercase">Jugador</div>
                    <div className="text-xs font-semibold text-gray-700 uppercase text-center">Puntos</div>
                    <div className="text-xs font-semibold text-gray-700 uppercase text-center">Rondas</div>
                  </div>
                </div>
              )}

              {/* Rows */}
              <div className={`divide-y ${compact ? "max-h-96 overflow-y-auto" : ""}`}>
                {currentRankings.map((player, index) => (
                  <RankingRow
                    key={player.playerId}
                    player={player}
                    index={index}
                    type="ironman"
                    compact={compact}
                    highlightPlayerId={highlightPlayerId}
                  />
                ))}
              </div>
            </div>

            {!compact && (
              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-900">
                  <strong>Ranking Ironman:</strong> Ordenado por total de puntos acumulados. Premia la participación
                  consistente.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {!compact && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600 border-t pt-4">
            <div>
              Total de jugadores: <strong>{currentRankings.length}</strong>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span>Sube</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span>Baja</span>
              </div>
              <div className="flex items-center gap-1">
                <Minus className="w-4 h-4 text-gray-400" />
                <span>Sin cambio</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
