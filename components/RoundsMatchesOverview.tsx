"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Users,
  Play,
  RefreshCw,
  Plus,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type MatchStatus = 'PENDING' | 'DATE_PROPOSED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

type Match = {
  id: string;
  setNumber: number;
  status: MatchStatus;
  proposedDate: string | null;
  acceptedDate: string | null;
  proposedBy: string | null;
  acceptedCount: number;
  team1Player1Id: string;
  team1Player2Id: string;
  team2Player1Id: string;
  team2Player2Id: string;
  team1Games: number | null;
  team2Games: number | null;
  tiebreakScore: string | null;
  isConfirmed: boolean;
};

type Group = {
  id: string;
  number: number;
  level: number;
  players: Array<{
    id: string;
    name: string;
    position: number;
    points: number;
  }>;
  matches: Match[];
};

type RoundData = {
  id: string;
  number: number;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  tournament: {
    title: string;
  };
};

type Stats = {
  totalMatches: number;
  completedMatches: number;
  scheduledMatches: number;
  pendingDates: number;
  proposedDates: number;
  completionRate: number;
};

type RoundsMatchesOverviewProps = {
  roundId: string;
  isAdmin?: boolean;
};

export default function RoundsMatchesOverview({ roundId, isAdmin = false }: RoundsMatchesOverviewProps) {
  const [round, setRound] = useState<RoundData | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchRoundData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/rounds/${roundId}/generate-matches`);
      if (response.ok) {
        const data = await response.json();
        setRound(data.round);
        setGroups(data.groups);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching round data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoundData();
  }, [roundId]);

  const generateMatches = async (force = false) => {
    if (!isAdmin) return;
    
    const confirmMessage = force 
      ? "¿Regenerar todos los partidos? Se eliminarán los existentes."
      : "¿Generar partidos para grupos vacíos?";
      
    if (!confirm(confirmMessage)) return;

    try {
      setGenerating(true);
      const response = await fetch(`/api/rounds/${roundId}/generate-matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        fetchRoundData(); // Recargar datos
      } else {
        alert(data.error || 'Error generando partidos');
      }
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setGenerating(false);
    }
  };

  const getStatusBadge = (status: MatchStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="text-gray-600">Sin fecha</Badge>;
      case 'DATE_PROPOSED':
        return <Badge variant="secondary" className="text-yellow-700 bg-yellow-100">Propuesta</Badge>;
      case 'SCHEDULED':
        return <Badge variant="default" className="text-blue-700 bg-blue-100">Programado</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="default" className="text-green-700 bg-green-100">En juego</Badge>;
      case 'COMPLETED':
        return <Badge variant="default" className="text-green-800 bg-green-200">Completado</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const getPlayerName = (groupIndex: number, playerId: string): string => {
    const group = groups[groupIndex];
    if (!group) return "Jugador desconocido";
    
    const player = group.players.find(p => p.id === playerId);
    return player?.name || "Jugador desconocido";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Cargando partidos...
      </div>
    );
  }

  if (!round) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No se pudo cargar la información de la ronda</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con información de la ronda */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            Ronda {round.number} - {round.tournament.title}
          </h2>
          <p className="text-gray-600">
            {format(new Date(round.startDate), "d MMM", { locale: es })} - {" "}
            {format(new Date(round.endDate), "d MMM yyyy", { locale: es })}
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              onClick={() => generateMatches(false)}
              disabled={generating || round.isClosed}
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              Generar partidos
            </Button>
            <Button
              onClick={() => generateMatches(true)}
              disabled={generating || round.isClosed}
              variant="destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Regenerar todo
            </Button>
            <Button
              onClick={fetchRoundData}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Estadísticas generales */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalMatches}</div>
                <div className="text-sm text-gray-600">Total partidos</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completedMatches}</div>
                <div className="text-sm text-gray-600">Completados</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.scheduledMatches}</div>
                <div className="text-sm text-gray-600">Programados</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.proposedDates}</div>
                <div className="text-sm text-gray-600">Fechas propuestas</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{stats.pendingDates}</div>
                <div className="text-sm text-gray-600">Sin fecha</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progreso general */}
      {stats && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progreso de la ronda</span>
              <span className="text-sm text-gray-600">{stats.completionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vista por grupos */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Todos los grupos</TabsTrigger>
          <TabsTrigger value="pending">Sin fecha ({stats?.pendingDates || 0})</TabsTrigger>
          <TabsTrigger value="scheduled">Programados ({stats?.scheduledMatches || 0})</TabsTrigger>
          <TabsTrigger value="completed">Completados ({stats?.completedMatches || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {groups.map((group, groupIndex) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Grupo {group.number} - Nivel {group.level}
                  </div>
                  <Badge variant="outline">
                    {group.matches.filter(m => m.isConfirmed).length}/{group.matches.length} completados
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {group.matches.length === 0 ? (
                  <div className="text-center p-6 text-gray-500">
                    <Calendar className="w-8 h-8 mx-auto mb-2" />
                    <p>No hay partidos generados para este grupo</p>
                    {isAdmin && !round.isClosed && (
                      <Button 
                        onClick={() => generateMatches(false)} 
                        className="mt-2" 
                        size="sm"
                      >
                        Generar partidos
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {group.matches
                      .sort((a, b) => a.setNumber - b.setNumber)
                      .map((match) => (
                        <div key={match.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Set {match.setNumber}</Badge>
                              {getStatusBadge(match.status)}
                            </div>
                            {match.isConfirmed && (
                              <div className="font-mono font-bold">
                                {match.team1Games}-{match.team2Games}
                                {match.tiebreakScore && ` (TB ${match.tiebreakScore})`}
                              </div>
                            )}
                          </div>

                          <div className="text-sm space-y-1">
                            <div>
                              <span className="font-medium text-blue-700">
                                {getPlayerName(groupIndex, match.team1Player1Id)} + {getPlayerName(groupIndex, match.team1Player2Id)}
                              </span>
                            </div>
                            <div className="text-center text-gray-400">vs</div>
                            <div>
                              <span className="font-medium text-red-700">
                                {getPlayerName(groupIndex, match.team2Player1Id)} + {getPlayerName(groupIndex, match.team2Player2Id)}
                              </span>
                            </div>
                          </div>

                          {/* Información de fecha */}
                          {match.status === 'SCHEDULED' && match.acceptedDate && (
                            <div className="mt-3 p-2 bg-green-50 rounded text-sm">
                              <div className="flex items-center gap-2 text-green-700">
                                <Clock className="w-4 h-4" />
                                <span>
                                  {format(new Date(match.acceptedDate), "EEEE d MMM 'a las' HH:mm", { locale: es })}
                                </span>
                              </div>
                            </div>
                          )}

                          {match.status === 'DATE_PROPOSED' && match.proposedDate && (
                            <div className="mt-3 p-2 bg-yellow-50 rounded text-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-yellow-700">
                                  <Clock className="w-4 h-4" />
                                  <span>
                                    {format(new Date(match.proposedDate), "d MMM 'a las' HH:mm", { locale: es })}
                                  </span>
                                </div>
                                <span className="text-yellow-600">
                                  {match.acceptedCount}/4 confirmados
                                </span>
                              </div>
                              {match.proposedBy && (
                                <div className="text-xs text-yellow-600 mt-1">
                                  Propuesto por {match.proposedBy}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Filtros por estado */}
        <TabsContent value="pending" className="space-y-4">
          {/* Mostrar solo partidos sin fecha */}
          {groups.map((group, groupIndex) => {
            const pendingMatches = group.matches.filter(m => m.status === 'PENDING');
            if (pendingMatches.length === 0) return null;

            return (
              <Card key={group.id}>
                <CardHeader>
                  <CardTitle>Grupo {group.number} - Sin fecha</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Renderizar solo partidos pendientes */}
                  <div className="space-y-3">
                    {pendingMatches.map((match) => (
                      <div key={match.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">Set {match.setNumber}</Badge>
                          {getStatusBadge(match.status)}
                        </div>
                        <div className="text-sm">
                          <div className="font-medium">
                            {getPlayerName(groupIndex, match.team1Player1Id)} + {getPlayerName(groupIndex, match.team1Player2Id)}
                            {" vs "}
                            {getPlayerName(groupIndex, match.team2Player1Id)} + {getPlayerName(groupIndex, match.team2Player2Id)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Tabs similares para scheduled y completed */}
        <TabsContent value="scheduled" className="space-y-4">
          {/* Similar al anterior pero filtrando por status === 'SCHEDULED' */}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {/* Similar al anterior pero filtrando por isConfirmed === true */}
        </TabsContent>
      </Tabs>
    </div>
  );
}