// app/clasificaciones/ClasificacionesClient.tsx - CON SOPORTE PUNTOS TÉCNICOS
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Medal,
  Award,
  Crown,
  Target,
  Users,
  RefreshCw,
  Info,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Flame,
  Star,
  XCircle,
  PauseCircle
} from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import TournamentSelector from "@/components/TournamentSelector";

type Player = {
  position: number;
  playerId: string;
  playerName: string;
  userName: string;
  totalPoints: number;
  roundsPlayed: number;
  averagePoints: number;
  setsWon: number;
  gamesDifference: number;
  gamesWon: number;
  h2hWins: number;
  comodinesUsed: number;
  maxStreak: number;
  currentGroupPosition?: string;
  isEligible: boolean;
  movement: string;
  technicalPointsRounds?: number; // ✅ NUEVO
  skippedRounds?: number;         // ✅ NUEVO
};

type Rankings = {
  official?: Player[];
  ironman?: Player[];
};

type RankingsData = {
  success: boolean;
  tournament: {
    id: string;
    title: string;
    isPublic: boolean;
  };
  rankings: Rankings;
  stats: {
    totalPlayers: number;
    eligiblePlayers: number;
    completedRounds: number;
    totalRounds: number;
    averageParticipation: number;
  };
  tiebreakCriteria: {
    official: string[];
    ironman: string[];
  };
  metadata: {
    generatedAt: string;
    useUnifiedTiebreakers: boolean;
    isAdmin: boolean;
    isParticipant: boolean;
  };
};

export default function ClasificacionesClient() {
  const { data: session } = useSession();
  const [data, setData] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'official' | 'ironman'>('official');
  const [showTiebreakInfo, setShowTiebreakInfo] = useState(false);

  const fetchRankings = useCallback(async (tournamentId: string) => {
    if (!tournamentId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/rankings?tournamentId=${tournamentId}&type=both`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('No tienes acceso a este torneo privado');
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      setData(result);
      
    } catch (err: any) {
      setError(err.message || 'Error cargando clasificaciones');
    } finally {
      setLoading(false);
    }
  }, []);
  // NUEVO: Cargar torneo activo al montar el componente
    useEffect(() => {
      async function loadActiveTournament() {
        try {
          const response = await fetch('/api/tournaments?activeOnly=true');
          const result = await response.json();
          
          // FIX: result es un array directo, no tiene propiedad 'tournaments'
          if (Array.isArray(result) && result[0]?.id) {
            setSelectedTournamentId(result[0].id);
            console.log('✅ Torneo cargado:', result[0].title);
          }
        } catch (err) {
          console.error('Error loading active tournament:', err);
        }
      }
      loadActiveTournament();
    }, []);

  // NUEVO: Cargar torneo activo al montar el componente
    useEffect(() => {
      async function loadActiveTournament() {
        try {
          const response = await fetch('/api/tournaments?activeOnly=true');
          const result = await response.json();
          
          // FIX: result es un array directo, no tiene propiedad 'tournaments'
          if (Array.isArray(result) && result[0]?.id) {
            setSelectedTournamentId(result[0].id);
            console.log('✅ Torneo cargado:', result[0].title);
          }
        } catch (err) {
          console.error('Error loading active tournament:', err);
        }
      }
      loadActiveTournament();
    }, []);

    // Ejecutar fetchRankings cuando cambia selectedTournamentId
    useEffect(() => {
      if (selectedTournamentId) {
        fetchRankings(selectedTournamentId);
      }
    }, [selectedTournamentId, fetchRankings]);

  const getPositionIcon = (position: number, type: 'official' | 'ironman') => {
    if (position === 1) {
      return type === 'official' ? 
        <Crown className="w-6 h-6 text-yellow-500" /> : 
        <Trophy className="w-6 h-6 text-orange-500" />;
    } else if (position === 2) {
      return <Medal className="w-5 h-5 text-gray-400" />;
    } else if (position === 3) {
      return <Award className="w-5 h-5 text-orange-600" />;
    }
    return <span className="w-6 h-6 flex items-center justify-center font-bold text-gray-600">#{position}</span>;
  };

  const getPositionColor = (position: number) => {
    if (position === 1) return 'bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300';
    if (position === 2) return 'bg-gradient-to-r from-gray-100 to-slate-100 border-gray-300';
    if (position === 3) return 'bg-gradient-to-r from-orange-100 to-red-100 border-orange-300';
    if (position <= 5) return 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200';
    return 'bg-white border-gray-200';
  };

  const parseCurrentPosition = (positionStr?: string) => {
    if (!positionStr) return null;
    const [group, position] = positionStr.split('-');
    return { group: parseInt(group), position: parseInt(position) };
  };

  if (loading && !data) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto">
        <Breadcrumbs />
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mr-3" />
          <span className="text-lg text-gray-600">Cargando clasificaciones...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumbs />
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-600" />
            Clasificaciones
          </h1>
          {data && (
            <p className="text-gray-600 mt-2">
              {data.tournament.title} - {data.stats.eligiblePlayers} jugadores elegibles
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <TournamentSelector
            value={selectedTournamentId}
            onChange={setSelectedTournamentId}
            onlyActive={false}
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRankings(selectedTournamentId)}
            disabled={loading || !selectedTournamentId}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-600 mb-2">Error al cargar</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => fetchRankings(selectedTournamentId)} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {!selectedTournamentId && !error && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-8 text-center">
            <Trophy className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-blue-800 mb-2">Selecciona un Torneo</h3>
            <p className="text-blue-700">
              Elige un torneo para ver las clasificaciones oficiales e Ironman
            </p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Estadísticas generales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-blue-600">{data.stats.totalPlayers}</div>
              <div className="text-sm text-gray-600">Total Jugadores</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-green-600">{data.stats.eligiblePlayers}</div>
              <div className="text-sm text-gray-600">Elegibles</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-orange-600">{data.stats.completedRounds}</div>
              <div className="text-sm text-gray-600">Rondas Jugadas</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-purple-600">{data.stats.averageParticipation}%</div>
              <div className="text-sm text-gray-600">Participación Media</div>
            </Card>
          </div>

          {/* Tabs de rankings */}
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex lg:flex-col gap-2 lg:w-48">
              <Button
                variant={activeTab === 'official' ? 'default' : 'outline'}
                onClick={() => setActiveTab('official')}
                className="flex items-center gap-2 justify-start"
              >
                <Crown className="w-4 h-4" />
                Ranking Oficial
              </Button>
              <Button
                variant={activeTab === 'ironman' ? 'default' : 'outline'}
                onClick={() => setActiveTab('ironman')}
                className="flex items-center gap-2 justify-start"
              >
                <Flame className="w-4 h-4" />
                Ranking Ironman
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTiebreakInfo(!showTiebreakInfo)}
                className="text-xs"
              >
                <Info className="w-3 h-3 mr-1" />
                Criterios
              </Button>
            </div>

            <div className="flex-1">
              {showTiebreakInfo && (
                <Card className="mb-4 bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-blue-900 mb-2">
                      Criterios de Desempate - {activeTab === 'official' ? 'Oficial' : 'Ironman'}
                    </h4>
                    <ol className="text-sm text-blue-800 space-y-1">
                      {data.tiebreakCriteria[activeTab].map((criterion, index) => (
                        <li key={index}>{index + 1}. {criterion}</li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {activeTab === 'official' ? (
                      <>
                        <Crown className="w-5 h-5 text-yellow-600" />
                        Ranking Oficial
                      </>
                    ) : (
                      <>
                        <Flame className="w-5 h-5 text-orange-600" />
                        Ranking Ironman
                      </>
                    )}
                  </CardTitle>
                  <div className="text-sm text-gray-600">
                    {activeTab === 'official' 
                      ? 'Basado en promedio de puntos por ronda (mín. 50% participación)'
                      : 'Basado en puntos totales acumulados'
                    }
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-2 p-6">
                    {data.rankings[activeTab]?.map((player) => {
                      const currentPos = parseCurrentPosition(player.currentGroupPosition);
                      const isCurrentUser = session?.user?.id === player.playerId && data.metadata.isParticipant;
                      const hasTechnicalPoints = (player.technicalPointsRounds || 0) > 0;
                      const hasSkippedRounds = (player.skippedRounds || 0) > 0;
                      
                      return (
                        <div
                          key={player.playerId}
                          className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                            getPositionColor(player.position)
                          } ${isCurrentUser ? 'ring-2 ring-blue-300' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <div className="flex items-center justify-center w-12 h-12">
                                {getPositionIcon(player.position, activeTab)}
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-bold text-lg">{player.playerName}</span>
                                  {isCurrentUser && (
                                    <Badge className="bg-blue-600 text-white text-xs">
                                      Tú
                                    </Badge>
                                  )}
                                  {!player.isEligible && activeTab === 'official' && (
                                    <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800">
                                      No elegible
                                    </Badge>
                                  )}
                                  {/* ✅ NUEVO: Badge de puntos técnicos */}
                                  {hasTechnicalPoints && (
                                    <Badge className="bg-gray-100 text-gray-700 text-xs flex items-center gap-1">
                                      <PauseCircle className="w-3 h-3" />
                                      {player.technicalPointsRounds} técnica{player.technicalPointsRounds! > 1 ? 's' : ''}
                                    </Badge>
                                  )}
                                  {player.maxStreak > 0 && (
                                    <div className="flex items-center gap-1 bg-orange-100 px-2 py-1 rounded-full">
                                      <Flame className="w-3 h-3 text-orange-500" />
                                      <span className="text-xs text-orange-600 font-medium">
                                        {player.maxStreak}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                  <span className="font-medium">
                                    {activeTab === 'official' 
                                      ? `${player.averagePoints.toFixed(2)} pts/ronda`
                                      : `${player.totalPoints} pts totales`
                                    }
                                  </span>
                                  <span>{player.roundsPlayed} rondas</span>
                                  {/* ✅ NUEVO: Indicador de rondas no disputadas */}
                                  {hasSkippedRounds && (
                                    <span className="text-gray-500 flex items-center gap-1">
                                      <XCircle className="w-3 h-3" />
                                      {player.skippedRounds} no disp.
                                    </span>
                                  )}
                                  <span>{player.setsWon} sets</span>
                                  {player.gamesDifference > 0 ? (
                                    <span className="text-green-600">+{player.gamesDifference} juegos</span>
                                  ) : player.gamesDifference < 0 ? (
                                    <span className="text-red-600">{player.gamesDifference} juegos</span>
                                  ) : (
                                    <span>±0 juegos</span>
                                  )}
                                  {player.comodinesUsed > 0 && (
                                    <span className="text-purple-600">{player.comodinesUsed} comodines</span>
                                  )}
                                </div>

                                {/* ✅ NUEVO: Tooltip informativo para puntos técnicos */}
                                {hasTechnicalPoints && (
                                  <div className="mt-2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block">
                                    <Info className="w-3 h-3 inline mr-1" />
                                    {player.technicalPointsRounds} ronda{player.technicalPointsRounds! > 1 ? 's' : ''} con puntos técnicos (50% media)
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="text-right ml-4">
                              {currentPos && (
                                <div className="text-sm">
                                  <div className="text-gray-600">Grupo Actual:</div>
                                  <div className="font-medium">
                                    G{currentPos.group} - #{currentPos.position}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Información adicional */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-yellow-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-900">
                  <Crown className="w-5 h-5" />
                  Ranking Oficial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-yellow-800 space-y-2">
                  <li>• Basado en promedio de puntos por ronda</li>
                  <li>• Requiere participar en al menos 50% de las rondas</li>
                  <li>• Determina al campeón del torneo</li>
                  <li>• Premia la consistencia y calidad</li>
                  <li>• Las rondas con puntos técnicos cuentan en el promedio</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-900">
                  <Flame className="w-5 h-5" />
                  Ranking Ironman
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-orange-800 space-y-2">
                  <li>• Basado en puntos totales acumulados</li>
                  <li>• No requiere participación mínima</li>
                  <li>• Premia la participación constante</li>
                  <li>• Premio especial para el líder Ironman</li>
                  <li>• Los puntos técnicos suman al total</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* ✅ NUEVO: Información sobre puntos técnicos */}
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <PauseCircle className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
                <div className="text-sm text-gray-700">
                  <div className="font-medium mb-1">Puntos Técnicos</div>
                  <p>
                    Los jugadores en grupos no disputados reciben puntos técnicos equivalentes al 50% de la media. 
                    Estas rondas cuentan en las estadísticas pero rompen rachas de continuidad.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}