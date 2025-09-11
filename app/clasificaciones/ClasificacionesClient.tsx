"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, 
  TrendingUp, 
  Star, 
  Calendar,
  Users,
  Crown,
  Medal,
  Award,
  Target,
  Flame,
  RefreshCw
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
    { id: "1", name: "David Sánchez", position: 1, totalPoints: 46.0, roundsPlayed: 5, averagePoints: 9.20 },
    { id: "2", name: "Tu Nombre", position: 2, totalPoints: 42.5, roundsPlayed: 5, averagePoints: 8.50 },
    { id: "3", name: "Elena Fernández", position: 3, totalPoints: 40.5, roundsPlayed: 5, averagePoints: 8.10 },
    { id: "4", name: "Javier Torres", position: 4, totalPoints: 39.0, roundsPlayed: 5, averagePoints: 7.80 },
    { id: "5", name: "Ana García", position: 5, totalPoints: 36.0, roundsPlayed: 5, averagePoints: 7.20 },
    { id: "6", name: "Miguel López", position: 6, totalPoints: 34.0, roundsPlayed: 5, averagePoints: 6.80 },
    { id: "7", name: "Laura Rodríguez", position: 7, totalPoints: 31.0, roundsPlayed: 5, averagePoints: 6.20 },
    { id: "8", name: "Pablo Ruiz", position: 8, totalPoints: 28.5, roundsPlayed: 5, averagePoints: 5.70 }
  ],
  ironman: [
    { id: "1", name: "David Sánchez", position: 1, totalPoints: 46.0, roundsPlayed: 5, averagePoints: 9.20 },
    { id: "2", name: "Tu Nombre", position: 2, totalPoints: 42.5, roundsPlayed: 5, averagePoints: 8.50 },
    { id: "3", name: "Elena Fernández", position: 3, totalPoints: 40.5, roundsPlayed: 5, averagePoints: 8.10 },
    { id: "4", name: "Javier Torres", position: 4, totalPoints: 39.0, roundsPlayed: 5, averagePoints: 7.80 },
    { id: "5", name: "Ana García", position: 5, totalPoints: 36.0, roundsPlayed: 5, averagePoints: 7.20 },
    { id: "6", name: "Miguel López", position: 6, totalPoints: 34.0, roundsPlayed: 5, averagePoints: 6.80 },
    { id: "7", name: "Laura Rodríguez", position: 7, totalPoints: 31.0, roundsPlayed: 5, averagePoints: 6.20 },
    { id: "8", name: "Pablo Ruiz", position: 8, totalPoints: 28.5, roundsPlayed: 5, averagePoints: 5.70 }
  ]
};

function getRankingIcon(position: number) {
  switch (position) {
    case 1: return <Crown className="w-5 h-5 text-yellow-500" />;
    case 2: return <Medal className="w-5 h-5 text-gray-400" />;
    case 3: return <Award className="w-5 h-5 text-orange-500" />;
    default: return <Target className="w-5 h-5 text-blue-500" />;
  }
}

function getPositionBadge(position: number) {
  switch (position) {
    case 1: return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case 2: return "bg-gray-100 text-gray-700 border-gray-200";
    case 3: return "bg-orange-100 text-orange-800 border-orange-200";
    default: return "bg-blue-100 text-blue-700 border-blue-200";
  }
}

function PlayerRow({ player, isCurrentUser, type }: { 
  player: RankingRow; 
  isCurrentUser: boolean;
  type: 'official' | 'ironman';
}) {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all hover:shadow-md ${
        isCurrentUser
          ? 'bg-blue-50 border-blue-300 shadow-md'
          : player.position <= 3
          ? 'bg-gradient-to-r from-gray-50 to-white border-gray-200'
          : 'bg-white border-gray-100'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold ${getPositionBadge(player.position)}`}>
          {player.position <= 3 ? (
            player.position === 1 ? '🥇' :
            player.position === 2 ? '🥈' : '🥉'
          ) : (
            `#${player.position}`
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">
              {player.name}
              {isCurrentUser && (
                <span className="text-blue-600 text-sm ml-2">(Tú)</span>
              )}
            </span>
            {player.position === 1 && (
              type === 'official' ? 
                <Crown className="w-5 h-5 text-yellow-500" /> :
                <Flame className="w-5 h-5 text-orange-500" />
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3" />
              {player.averagePoints.toFixed(2)} media
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {player.roundsPlayed} rondas
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              {player.totalPoints.toFixed(1)} pts
            </span>
          </div>
        </div>
      </div>
      <div className="text-right">
        {getRankingIcon(player.position)}
      </div>
    </div>
  );
}

export default function ClasificacionesClient() {
  const { data: session } = useSession();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  
  // Hook useApiState corregido - NO useRankingsData
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

  // Determinar datos a mostrar
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
    // Trigger new fetch with updated tournament ID
    retry();
  };

  const isCurrentUser = (player: RankingRow) => {
    return player.name === "Tu Nombre" || player.id === currentUserId;
  };

  if (isLoading) {
    return <LoadingState message="Cargando clasificaciones..." />;
  }

  if (hasError) {
    return <ErrorState error={error} onRetry={retry} />;
  }

  return (
    <div className={`px-4 py-6 space-y-6 ${data.isPreview ? 'opacity-90' : ''}`}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Clasificaciones
          </h1>
          {data.selectedTournament && (
            <p className="text-gray-600 mt-1">{data.selectedTournament.title}</p>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Selector de torneos */}
          {!data.isPreview && data.tournaments && data.tournaments.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Torneo:
              </label>
              <select
                value={selectedTournamentId}
                onChange={(e) => handleTournamentChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[200px]"
              >
                {data.tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.title}
                    {tournament.isActive ? ' (Activo)' : ''}
                    {!tournament.hasData ? ' (Sin datos)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {data.isPreview && (
            <div className="text-right">
              <Badge variant="secondary" className="mb-2">
                Vista Previa
              </Badge>
              <p className="text-sm text-gray-500">
                Datos de ejemplo
              </p>
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

      {/* Información explicativa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Ranking Oficial
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Media de puntos por ronda jugada</li>
              <li>• Elegible a Campeón si juega ≥50% de rondas</li>
              <li>• Refleja la consistencia del juego</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Ranking Ironman
            </h4>
            <ul className="text-sm text-orange-700 space-y-1">
              <li>• Puntos totales acumulados</li>
              <li>• Premia la participación constante</li>
              <li>• Reconoce el esfuerzo y dedicación</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="official" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="official" className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Ranking Oficial
          </TabsTrigger>
          <TabsTrigger value="ironman" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Ranking Ironman
          </TabsTrigger>
        </TabsList>

        <TabsContent value="official" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Clasificación Oficial
              </CardTitle>
              <p className="text-sm text-gray-600">
                Por media de puntos por ronda. Determina el campeón del torneo.
              </p>
            </CardHeader>
            <CardContent>
              {!data.hasRankings && data.official.length > 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    Clasificaciones aún no disponibles
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Hay {data.official.length} jugadores registrados, pero aún no hay partidos confirmados.
                  </p>
                  <p className="text-sm text-gray-500">
                    Las clasificaciones aparecerán cuando se confirmen los primeros resultados.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
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

        <TabsContent value="ironman" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Ranking Ironman
              </CardTitle>
              <p className="text-sm text-gray-600">
                Por puntos totales acumulados. Premio especial al líder Ironman.
              </p>
            </CardHeader>
            <CardContent>
              {!data.hasRankings && data.ironman.length > 0 ? (
                <div className="text-center py-8">
                  <Flame className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    Ranking Ironman pendiente
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Hay {data.ironman.length} jugadores listos para competir.
                  </p>
                  <p className="text-sm text-gray-500">
                    El ranking Ironman se activará con los primeros partidos confirmados.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
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

      {/* Call to action para modo preview */}
      {data.isPreview && (
        <Card className="border-dashed border-2 border-blue-300 bg-blue-50">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-blue-900 mb-2">
              Ve las Clasificaciones Reales
            </h3>
            <p className="text-blue-700 mb-6">
              Estos son datos de ejemplo. Únete a un torneo para ver las clasificaciones reales y competir por el primer puesto.
            </p>
            <Button variant="default">
              Contactar Administrador
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}