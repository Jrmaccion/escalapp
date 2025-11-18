"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Edit, Save, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import toast from "react-hot-toast";

interface Tournament {
  id: number;
  name: string;
}

interface Round {
  id: number;
  number: number;
  tournament: Tournament;
}

interface Player {
  id: number;
  name: string;
}

interface Match {
  id: number;
  setNumber: number;
  team1Player1: Player;
  team1Player2: Player;
  team2Player1: Player;
  team2Player2: Player;
  team1Games: number | null;
  team2Games: number | null;
  isConfirmed: boolean;
}

interface GroupPlayer {
  id: number;
  player: Player;
  position: number;
  points: number;
}

interface Group {
  id: number;
  number: number;
  level: number;
  players: GroupPlayer[];
  matches: Match[];
}

interface RoundData {
  id: number;
  number: number;
  tournament: Tournament;
  groups: Group[];
}

export default function CorrectionsClient() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");
  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [loading, setLoading] = useState(false);

  // Load tournaments on mount
  useEffect(() => {
    fetchTournaments();
  }, []);

  // Load rounds when tournament is selected
  useEffect(() => {
    if (selectedTournamentId) {
      fetchRounds(parseInt(selectedTournamentId));
    } else {
      setRounds([]);
      setSelectedRoundId("");
      setRoundData(null);
    }
  }, [selectedTournamentId]);

  // Load round data when round is selected
  useEffect(() => {
    if (selectedRoundId) {
      fetchRoundData(parseInt(selectedRoundId));
    } else {
      setRoundData(null);
    }
  }, [selectedRoundId]);

  const fetchTournaments = async () => {
    try {
      const response = await fetch("/api/tournaments");
      if (response.ok) {
        const data = await response.json();
        setTournaments(data);
      }
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      toast.error("Error al cargar torneos");
    }
  };

  const fetchRounds = async (tournamentId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tournaments/${tournamentId}/rounds`);
      if (response.ok) {
        const data = await response.json();
        // Filter only closed rounds (number > 0)
        const closedRounds = data.filter((r: Round) => r.number > 0);
        setRounds(closedRounds);
      }
    } catch (error) {
      console.error("Error fetching rounds:", error);
      toast.error("Error al cargar rondas");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoundData = async (roundId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/rounds/${roundId}/full-data`);
      if (response.ok) {
        const data = await response.json();
        setRoundData(data);
      } else {
        toast.error("Error al cargar datos de la ronda");
      }
    } catch (error) {
      console.error("Error fetching round data:", error);
      toast.error("Error al cargar datos de la ronda");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMatchResults = async (matchId: number, scores: {
    team1Games: number;
    team2Games: number;
  }) => {
    try {
      const response = await fetch(`/api/admin/rounds/${selectedRoundId}/corrections/match-results`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, ...scores }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Resultado del set actualizado correctamente");
        fetchRoundData(parseInt(selectedRoundId));
      } else {
        toast.error(result.error || "Error al actualizar resultado");
      }
    } catch (error) {
      console.error("Error updating match results:", error);
      toast.error("Error al actualizar resultado del set");
    }
  };

  const handleUpdatePoints = async (groupPlayerId: number, newPoints: number) => {
    try {
      const response = await fetch(`/api/admin/rounds/${selectedRoundId}/corrections/points`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupPlayerId, points: newPoints }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Puntos actualizados correctamente");
        fetchRoundData(parseInt(selectedRoundId));
      } else {
        toast.error(result.error || "Error al actualizar puntos");
      }
    } catch (error) {
      console.error("Error updating points:", error);
      toast.error("Error al actualizar puntos");
    }
  };

  const handleUpdatePosition = async (groupPlayerId: number, newPosition: number) => {
    try {
      const response = await fetch(`/api/admin/rounds/${selectedRoundId}/corrections/positions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupPlayerId, position: newPosition }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Posición actualizada correctamente");
        fetchRoundData(parseInt(selectedRoundId));
      } else {
        toast.error(result.error || "Error al actualizar posición");
      }
    } catch (error) {
      console.error("Error updating position:", error);
      toast.error("Error al actualizar posición");
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Corrección de Rondas Cerradas</h1>
        <p className="text-muted-foreground">
          Herramienta administrativa para corregir puntuaciones y posiciones de rondas ya finalizadas
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Importante</AlertTitle>
        <AlertDescription>
          Las correcciones se aplican únicamente a la ronda seleccionada y NO se propagan automáticamente a rondas siguientes.
          Verifica cuidadosamente los cambios antes de guardar.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Ronda</CardTitle>
          <CardDescription>Elige el torneo y la ronda que deseas corregir</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tournament">Torneo</Label>
              <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
                <SelectTrigger id="tournament">
                  <SelectValue placeholder="Selecciona un torneo" />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.map((tournament) => (
                    <SelectItem key={tournament.id} value={tournament.id.toString()}>
                      {tournament.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="round">Ronda</Label>
              <Select
                value={selectedRoundId}
                onValueChange={setSelectedRoundId}
                disabled={!selectedTournamentId || rounds.length === 0}
              >
                <SelectTrigger id="round">
                  <SelectValue placeholder="Selecciona una ronda" />
                </SelectTrigger>
                <SelectContent>
                  {rounds.map((round) => (
                    <SelectItem key={round.id} value={round.id.toString()}>
                      Ronda {round.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedTournamentId && rounds.length === 0 && !loading && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No hay rondas cerradas en este torneo
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {roundData && (
        <Tabs defaultValue="matches" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="matches">Resultados de Sets</TabsTrigger>
            <TabsTrigger value="points">Puntos</TabsTrigger>
            <TabsTrigger value="positions">Posiciones</TabsTrigger>
          </TabsList>

          <TabsContent value="matches" className="space-y-4">
            <MatchResultsTab
              groups={roundData.groups}
              onUpdateMatch={handleUpdateMatchResults}
            />
          </TabsContent>

          <TabsContent value="points" className="space-y-4">
            <PointsTab
              groups={roundData.groups}
              onUpdatePoints={handleUpdatePoints}
            />
          </TabsContent>

          <TabsContent value="positions" className="space-y-4">
            <PositionsTab
              groups={roundData.groups}
              onUpdatePosition={handleUpdatePosition}
            />
          </TabsContent>
        </Tabs>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}

// Match Results Tab Component
function MatchResultsTab({ groups, onUpdateMatch }: {
  groups: Group[];
  onUpdateMatch: (matchId: number, scores: { team1Games: number; team2Games: number }) => void;
}) {
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);
  const [editScores, setEditScores] = useState<{ team1Games: number; team2Games: number }>({ team1Games: 0, team2Games: 0 });

  const startEditing = (match: Match) => {
    setEditingMatchId(match.id);
    setEditScores({
      team1Games: match.team1Games || 0,
      team2Games: match.team2Games || 0,
    });
  };

  const saveMatch = async (matchId: number) => {
    await onUpdateMatch(matchId, editScores);
    setEditingMatchId(null);
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader>
            <CardTitle>Grupo {group.number} (Nivel {group.level})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.matches
              .sort((a, b) => a.setNumber - b.setNumber)
              .map((match) => (
                <div key={match.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="font-medium">Set {match.setNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {match.team1Player1.name} + {match.team1Player2.name} vs {match.team2Player1.name} + {match.team2Player2.name}
                      </p>
                    </div>
                    {editingMatchId === match.id ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveMatch(match.id)}>
                          <Save className="h-4 w-4 mr-1" />
                          Guardar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingMatchId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEditing(match)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    )}
                  </div>

                  {editingMatchId === match.id ? (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Juegos Equipo 1</Label>
                        <Input
                          type="number"
                          min="0"
                          value={editScores.team1Games}
                          onChange={(e) => setEditScores({ ...editScores, team1Games: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Juegos Equipo 2</Label>
                        <Input
                          type="number"
                          min="0"
                          value={editScores.team2Games}
                          onChange={(e) => setEditScores({ ...editScores, team2Games: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm">
                      <p>Resultado: {match.team1Games ?? '-'} - {match.team2Games ?? '-'} juegos</p>
                    </div>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Points Tab Component
function PointsTab({ groups, onUpdatePoints }: {
  groups: Group[];
  onUpdatePoints: (groupPlayerId: number, points: number) => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  const startEditing = (groupPlayer: GroupPlayer) => {
    setEditingId(groupPlayer.id);
    setEditValue(groupPlayer.points);
  };

  const save = async (groupPlayerId: number) => {
    await onUpdatePoints(groupPlayerId, editValue);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader>
            <CardTitle>Grupo {group.number} (Nivel {group.level})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {group.players
                .sort((a, b) => a.position - b.position)
                .map((gp) => (
                  <div key={gp.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">Pos {gp.position}: {gp.player.name}</p>
                      <p className="text-sm text-muted-foreground">Puntos actuales: {gp.points}</p>
                    </div>
                    {editingId === gp.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          value={editValue}
                          onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                        <Button size="sm" onClick={() => save(gp.id)}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEditing(gp)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Positions Tab Component
function PositionsTab({ groups, onUpdatePosition }: {
  groups: Group[];
  onUpdatePosition: (groupPlayerId: number, position: number) => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<number>(1);

  const startEditing = (groupPlayer: GroupPlayer) => {
    setEditingId(groupPlayer.id);
    setEditValue(groupPlayer.position);
  };

  const save = async (groupPlayerId: number) => {
    await onUpdatePosition(groupPlayerId, editValue);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader>
            <CardTitle>Grupo {group.number} (Nivel {group.level})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {group.players
                .sort((a, b) => a.position - b.position)
                .map((gp) => (
                  <div key={gp.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{gp.player.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Posición actual: {gp.position} | Puntos: {gp.points}
                      </p>
                    </div>
                    {editingId === gp.id ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={editValue.toString()}
                          onValueChange={(v: string) => setEditValue(parseInt(v))}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                            <SelectItem value="4">4</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => save(gp.id)}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEditing(gp)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
