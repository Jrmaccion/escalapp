"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, TrendingUp, Star, Calendar, Users, Crown, Medal, Award, 
  Target, Flame, RefreshCw, Zap, ChevronUp, ChevronDown, Minus,
  ArrowUp, ArrowDown, Eye, TrendingDown
} from "lucide-react";
import { useApiState } from "@/hooks/useApiState";
import { LoadingState, ErrorState } from "@/components/ApiStateComponents";

type RankingRow = {
  id: string;
  name: string;
  position: number;
  totalPoints: number;
  roundsPlayed: number;
  averagePoints: number;
  movement?: 'up' | 'down' | 'same' | 'new';
  movementPositions?: number;
};

type Tournament = {
  id: string;
  title: string;
  isActive: boolean;
  hasData: boolean;
};

type RankingsData = {
  hasActiveTournament: boolean;
  hasRankings: boolean;
  message?: string;
  tournaments: Tournament[];
  selectedTournament: { id: string; title: string } | null;
  official: RankingRow[];
  ironman: RankingRow[];
};

const PREVIEW_DATA: RankingsData = {
  hasActiveTournament: true,
  hasRankings: true,
  tournaments: [
    { id: "preview", title: "Torneo Escalera Primavera 2025", isActive: true, hasData: true }
  ],
  selectedTournament: { id: "preview", title: "Torneo Escalera Primavera 2025" },
  official: [
    { id: "1", name: "David Sánchez", position: 1, totalPoints: 46.0, roundsPlayed: 5, averagePoints: 9.20, movement: 'same' },
    { id: "2", name: "Tu Nombre", position: 2, totalPoints: 42.5, roundsPlayed: 5, averagePoints: 8.50, movement: 'up', movementPositions: 1 },
    { id: "3", name: "Elena Fernández", position: 3, totalPoints: 40.5, roundsPlayed: 5, averagePoints: 8.10, movement: 'down', movementPositions: 1 },
    { id: "4", name: "Javier Torres", position: 4, totalPoints: 39.0, roundsPlayed: 5, averagePoints: 7.80, movement: 'same' },
    { id: "5", name: "Ana García", position: 5, totalPoints: 36.0, roundsPlayed: 5, averagePoints: 7.20, movement: 'up', movementPositions: 2 },
    { id: "6", name: "Miguel López", position: 6, totalPoints: 34.0, roundsPlayed: 5, averagePoints: 6.80, movement: 'down', movementPositions: 1 },
    { id: "7", name: "Laura Rodríguez", position: 7, totalPoints: 31.0, roundsPlayed: 5, averagePoints: 6.20, movement: 'new' },
    { id: "8", name: "Pablo Ruiz", position: 8, totalPoints: 28.5, roundsPlayed: 5, averagePoints: 5.70, movement: 'down', movementPositions: 3 }
  ],
  ironman: [
    { id: "1", name: "David Sánchez", position: 1, totalPoints: 46.0, roundsPlayed: 5, averagePoints: 9.20, movement: 'same' },
    { id: "2", name: "Tu Nombre", position: 2, totalPoints: 42.5, roundsPlayed: 5, averagePoints: 8.50, movement: 'same' },
    { id: "3", name: "Elena Fernández", position: 3, totalPoints: 40.5, roundsPlayed: 5, averagePoints: 8.10, movement: 'same' },
    { id: "4", name: "Javier Torres", position: 4, totalPoints: 39.0, roundsPlayed: 5, averagePoints: 7.80, movement: 'same' },
    { id: "5", name: "Ana García", position: 5, totalPoints: 36.0, roundsPlayed: 5, averagePoints: 7.20, movement: 'same' },
    { id: "6", name: "Miguel López", position: 6, totalPoints: 34.0, roundsPlayed: 5, averagePoints: 6.80, movement: 'same' },
    { id: "7", name: "Laura Rodríguez", position: 7, totalPoints: 31.0, roundsPlayed: 5, averagePoints: 6.20, movement: 'same' },
    { id: "8", name: "Pablo Ruiz", position: 8, totalPoints: 28.5, roundsPlayed: 5, averagePoints: 5.70, movement: 'same' }
  ]
};

function getRankingIcon(position: number, isCurrentUser = false) {
  if (position === 1) return <Crown className={`w-6 h-6 ${isCurrentUser ? 'text-yellow-400' : 'text-yellow-500'}`} />;
  if (position === 2) return <Medal className={`w-6 h-6 ${isCurrentUser ? 'text-gray-300' : 'text-gray-400'}`} />;
  if (position === 3) return <Award className={`w-6 h-6 ${isCurrentUser ? 'text-orange-400' : 'text-orange-500'}`} />;
  return <Target className="w-5 h-5 text-blue-500" />;
}

function getPositionBadge(position: number, isCurrentUser = false) {
  const baseClasses = "font-bold text-lg";
  
  if (position === 1) return `${baseClasses} bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 border-2 border-yellow-300 shadow-lg ${isCurrentUser ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}`;
  if (position === 2) return `${baseClasses} bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 border-2 border-gray-300 shadow-md ${isCurrentUser ? 'ring-2 ring-gray-400 ring-offset-2' : ''}`;
  if (position === 3) return `${baseClasses} bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 border-2 border-orange-300 shadow-md ${isCurrentUser ? 'ring-2 ring-orange-400 ring-offset-2' : ''}`;
  return `${baseClasses} bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 border border-blue-200 ${isCurrentUser ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`;
}

function getMovementIndicator(movement?: string, movementPositions?: number) {
  if (!movement || movement === 'same') return (
    <div className="flex items-center gap-1 text-blue-600">
      <Minus className="w-4 h-4" />
      <span className="text-xs font-medium">Igual</span>
    </div>
  );
  
  if (movement === 'up') return (
    <div className="flex items-center gap-1 text-green-600">
      <ChevronUp className="w-4 h-4" />
      <span className="text-xs font-medium">
        +{movementPositions || 1}
      </span>
    </div>
  );
  
  if (movement === 'down') return (
    <div className="flex items-center gap-1 text-red-600">
      <ChevronDown className="w-4 h-4" />
      <span className="text-xs font-medium">
        -{movementPositions || 1}
      </span>
    </div>
  );
  
  if (movement === 'new') return (
    <div className="flex items-center gap-1 text-purple-600">
      <Zap className="w-4 h-4" />
      <span className="text-xs font-medium">Nuevo</span>
    </div>
  );
  
  return null;
}

function PlayerRow({ 
  player, 
  isCurrentUser, 
  type, 
  showDetailedStats = false 
}: { 
  player: RankingRow; 
  isCurrentUser: boolean;
  type: 'official' | 'ironman';
  showDetailedStats?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div
      className={`
        relative overflow-hidden rounded-lg border-2 transition-all duration-300 hover:shadow-lg group
        ${isCurrentUser
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-md transform hover:scale-[1.02]'
          : player.position <= 3
          ? 'bg-gradient-to-r from-gray-50 to-white border-gray-200 hover:border-gray-300'
          : 'bg-white border-gray-100 hover:border-gray-200'
        }
      `}
    >
      {/* Indicador de posición lateral */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
        player.position === 1 ? 'bg-gradient-to-b from-yellow-400 to-yellow-600' :
        player.position === 2 ? 'bg-gradient-to-b from-gray-400 to-gray-600' :
        player.position === 3 ? 'bg-gradient-to-b from-orange-400 to-orange-600' :
        'bg-gradient-to-b from-blue-400 to-blue-600'
      }`} />
      
      <div className="p-5 pl-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* Posición con diseño mejorado */}
            <div className={`
              w-14 h-14 rounded-full flex items-center justify-center text-center transition-all duration-200
              ${getPositionBadge(player.position, isCurrentUser)}
            `}>
              {player.position <= 3 ? (
                player.position === 1 ? '🥇' :
                player.position === 2 ? '🥈' : '🥉'
              ) : (
                `#${player.position}`
              )}
            </div>
            
            {/* Info del jugador */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-lg text-gray-900 truncate">
                  {player.name}
                  {isCurrentUser && (
                    <span className="text-blue-600 text-base ml-2 font-medium">(Tú)</span>
                  )}
                </h3>
                {player.position === 1 && (
                  <Crown className="w-5 h-5 text-yellow-500 animate-pulse" />
                )}
              </div>
              
              {/* Stats principales */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="font-semibold">{player.averagePoints.toFixed(2)}</span>
                  <span className="text-gray-500">media</span>
                </div>
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold">{player.totalPoints.toFixed(1)}</span>
                  <span className="text-gray-500">pts</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-green-500" />
                  <span className="font-semibold">{player.roundsPlayed}</span>
                  <span className="text-gray-500">rondas</span>
                </div>
              </div>
              
              {/* Stats expandidas */}
              {expanded && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Mejor ronda:</span>
                      <span className="ml-2 font-semibold">12.5 pts</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Racha actual:</span>
                      <span className="ml-2 font-semibold">3 rondas</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {type === 'official' 
                      ? "Necesita jugar al menos 3 rondas más para ser elegible a campeón"
                      : "Ha participado en todas las rondas del torneo"
                    }
                  </div>
                </div>
              )}
            </div>
            
            {/* Indicadores laterales */}
            <div className="flex flex-col items-end gap-2">
              {/* Movimiento */}
              {getMovementIndicator(player.movement, player.movementPositions)}
              
              {/* Icono de posición */}
              <div className="transition-transform duration-200 group-hover:scale-110">
                {getRankingIcon(player.position, isCurrentUser)}
              </div>
              
              {/* Botón expandir */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-6 w-6 p-0"
              >
                <Eye className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Efecto de brillo para el jugador actual */}
      {isCurrentUser && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-indigo-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      )}
    </div>
  );
}

export default function ClasificacionesClient() {
  const { data: session } = useSession();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  
  const { data: rawData, isLoading, hasError, error, retry } = useApiState(
    async () => {
      const url = new URL("/api/rankings", window.location.origin);
      if (selectedTournamentId) {
        url.searchParams.set("tournamentId", selectedTournamentId);
      }
      
      const response = await fetch(url.toString(), { 
        cache: "no-store",
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error("Error al cargar rankings");
      return response.json();
    },
    {
      loadingMessage: "Cargando clasificaciones...",
      emptyMessage: "No hay clasificaciones disponibles",
      autoExecute: true,
    }
  );

  const currentUserId = session?.user?.playerId || session?.user?.id;

  const data: RankingsData & { isPreview?: boolean } = (!rawData?.hasActiveTournament || !rawData?.tournaments?.length) 
    ? { ...PREVIEW_DATA, isPreview: true }
    : { ...rawData, isPreview: false };

  useEffect(() => {
    if (!selectedTournamentId && data.selectedTournament) {
      setSelectedTournamentId(data.selectedTournament.id);
    }
  }, [data.selectedTournament, selectedTournamentId]);

  const handleTournamentChange = (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
    retry();
  };

  const isCurrentUser = (player: RankingRow) => {
    return player.name === "Tu Nombre" || player.id === currentUserId;
  };

  const currentUserPosition = data.official.find(p => isCurrentUser(p))?.position;
  const usersAhead = currentUserPosition ? currentUserPosition - 1 : 0;
  const usersBehind = currentUserPosition ? data.official.length - currentUserPosition : 0;

  if (isLoading) {
    return <LoadingState message="Cargando clasificaciones..." />;
  }

  if (hasError) {
    return <ErrorState error={error} onRetry={retry} />;
  }

  return (
    <div className={`px-4 py-6 space-y-6 pb-20 ${data.isPreview ? 'opacity-95' : ''}`}>
      
      {/* Header mejorado */}
      <div className="text-center space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Clasificaciones
          </h1>
          {data.selectedTournament && (
            <p className="text-gray-600">{data.selectedTournament.title}</p>
          )}
        </div>

        {/* Stats personalizadas para el usuario */}
        {currentUserPosition && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Tu posición actual</p>
                <div className="flex items-center justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">{usersAhead} por delante</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">#{currentUserPosition}</div>
                  <div className="flex items-center gap-2">
                    <ArrowDown className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">{usersBehind} por detrás</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="flex items-center justify-between">
          {/* Selector de torneos */}
          {!data.isPreview && data.tournaments && data.tournaments.length > 1 && (
            <select
              value={selectedTournamentId}
              onChange={(e) => handleTournamentChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {data.tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.title}
                  {tournament.isActive ? ' (Activo)' : ''}
                </option>
              ))}
            </select>
          )}
          
          <div className="flex items-center gap-2">
            {data.isPreview && (
              <Badge variant="secondary">Vista Previa</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={retry}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Información explicativa mejorada */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-5">
            <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Ranking Oficial
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Media de puntos por ronda jugada</li>
              <li>• Determina el campeón del torneo</li>
              <li>• Mínimo 50% de rondas para ser elegible</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-5">
            <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
              <Flame className="w-5 h-5" />
              Ranking Ironman
            </h4>
            <ul className="text-sm text-orange-700 space-y-1">
              <li>• Puntos totales acumulados</li>
              <li>• Premia la participación constante</li>
              <li>• Premio especial al líder Ironman</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="official" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="official" className="flex items-center gap-2 text-base">
            <Trophy className="w-5 h-5" />
            Ranking Oficial
          </TabsTrigger>
          <TabsTrigger value="ironman" className="flex items-center gap-2 text-base">
            <TrendingUp className="w-5 h-5" />
            Ranking Ironman
          </TabsTrigger>
        </TabsList>

        <TabsContent value="official" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                Clasificación Oficial
                <Badge className="ml-2">{data.official.length} jugadores</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data.hasRankings && data.official.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    Clasificaciones próximamente
                  </h3>
                  <p className="text-gray-500">
                    Las clasificaciones aparecerán cuando se confirmen los primeros resultados.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.official.map((player) => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      isCurrentUser={isCurrentUser(player)}
                      type="official"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ironman" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-6 w-6 text-orange-500" />
                Ranking Ironman
                <Badge className="ml-2">{data.ironman.length} jugadores</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data.hasRankings && data.ironman.length === 0 ? (
                <div className="text-center py-12">
                  <Flame className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    Ranking Ironman próximamente
                  </h3>
                  <p className="text-gray-500">
                    El ranking se activará con los primeros partidos confirmados.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.ironman.map((player) => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      isCurrentUser={isCurrentUser(player)}
                      type="ironman"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Call to action mejorado */}
      {data.isPreview && (
        <Card className="border-dashed border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-8 text-center">
            <Trophy className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-blue-900 mb-2">
              ¡Únete al torneo real!
            </h3>
            <p className="text-blue-700 mb-6">
              Estos son datos de ejemplo. Contacta al administrador para unirte al torneo y competir por el primer puesto.
            </p>
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Users className="w-5 h-5 mr-2" />
              Contactar Administrador
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}