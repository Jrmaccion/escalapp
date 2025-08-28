"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  UserPlus, 
  Search, 
  Trash2, 
  Users,
  AlertTriangle,
  CheckCircle,
  X
} from "lucide-react";

type AvailablePlayer = {
  id: string;
  name: string;
  email: string;
};

type CurrentPlayer = {
  id: string;
  name: string;
  joinedRound: number;
  comodinesUsed: number;
};

type TournamentPlayersManagerProps = {
  tournamentId: string;
  tournamentTitle: string;
  totalRounds: number;
  currentPlayers: CurrentPlayer[];
  onPlayersUpdated: () => void;
};

export default function TournamentPlayersManager({ 
  tournamentId, 
  tournamentTitle, 
  totalRounds, 
  currentPlayers, 
  onPlayersUpdated 
}: TournamentPlayersManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [joinRound, setJoinRound] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchAvailablePlayers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tournaments/${tournamentId}/players`);
      if (response.ok) {
        const data = await response.json();
        setAvailablePlayers(data.availablePlayers);
      }
    } catch (error) {
      console.error("Error fetching available players:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showAddPlayers) {
      fetchAvailablePlayers();
    }
  }, [showAddPlayers]);

  const filteredPlayers = availablePlayers.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectPlayer = (playerId: string) => {
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    setSelectedPlayers(newSelected);
  };

  const handleAddPlayers = async () => {
    if (selectedPlayers.size === 0) {
      alert("Selecciona al menos un jugador");
      return;
    }

    if (joinRound < 1 || joinRound > totalRounds) {
      alert(`La ronda debe estar entre 1 y ${totalRounds}`);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/tournaments/${tournamentId}/players`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerIds: Array.from(selectedPlayers),
            joinRound: joinRound
          }),
        });

        if (response.ok) {
          const result = await response.json();
          alert(result.message);
          setSelectedPlayers(new Set());
          setShowAddPlayers(false);
          onPlayersUpdated();
        } else {
          const error = await response.json();
          alert(error.error || "Error al añadir jugadores");
        }
      } catch (error) {
        alert("Error de conexión");
      }
    });
  };

  const handleRemovePlayer = async (playerId: string, playerName: string) => {
    if (!confirm(`¿Seguro que quieres eliminar a ${playerName} del torneo?`)) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/tournaments/${tournamentId}/players?playerId=${playerId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          const result = await response.json();
          alert(result.message);
          onPlayersUpdated();
        } else {
          const error = await response.json();
          alert(error.error || "Error al eliminar jugador");
        }
      } catch (error) {
        alert("Error de conexión");
      }
    });
  };

  if (showAddPlayers) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Añadir Jugadores
            </CardTitle>
            <Button variant="outline" onClick={() => setShowAddPlayers(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Configuración */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Ronda de incorporación
                </label>
                <Input
                  type="number"
                  min="1"
                  max={totalRounds}
                  value={joinRound}
                  onChange={(e) => setJoinRound(parseInt(e.target.value) || 1)}
                  className="w-full"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Los jugadores se unirán desde esta ronda
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Jugadores seleccionados
                </label>
                <div className="text-2xl font-bold text-blue-600">
                  {selectedPlayers.size}
                </div>
                <p className="text-xs text-gray-600">
                  jugadores para añadir
                </p>
              </div>
            </div>

            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar jugadores disponibles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Lista de jugadores disponibles */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Cargando jugadores...</p>
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? "No se encontraron jugadores con esa búsqueda" : "No hay jugadores disponibles"}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredPlayers.map((player) => (
                  <div
                    key={player.id}
                    onClick={() => handleSelectPlayer(player.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedPlayers.has(player.id)
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{player.name}</div>
                        <div className="text-sm text-gray-600">{player.email}</div>
                      </div>
                      <div className="flex items-center">
                        {selectedPlayers.has(player.id) && (
                          <CheckCircle className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={handleAddPlayers}
                disabled={isPending || selectedPlayers.size === 0}
                className="flex-1"
              >
                {isPending ? "Añadiendo..." : `Añadir ${selectedPlayers.size} jugadores`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Jugadores del Torneo</h3>
          <p className="text-sm text-gray-600">{currentPlayers.length} jugadores registrados</p>
        </div>
        <Button onClick={() => setShowAddPlayers(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Añadir Jugadores
        </Button>
      </div>

      {/* Lista de jugadores actuales */}
      {currentPlayers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No hay jugadores registrados en este torneo</p>
            <Button onClick={() => setShowAddPlayers(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Añadir Primeros Jugadores
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white rounded-lg shadow">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500 border-b">
                <th className="py-3 px-4">Jugador</th>
                <th className="py-3 px-4">Se unió en</th>
                <th className="py-3 px-4">Comodines usados</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentPlayers.map((player) => (
                <tr key={player.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="font-medium">{player.name}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                      Ronda {player.joinedRound}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {player.comodinesUsed > 0 ? (
                      <div className="inline-flex items-center px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {player.comodinesUsed}
                      </div>
                    ) : (
                      <span className="text-gray-400">Sin usar</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Button
                      onClick={() => handleRemovePlayer(player.id, player.name)}
                      disabled={isPending}
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Información adicional */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800">Importante:</p>
              <ul className="text-yellow-700 mt-1 space-y-1">
                <li>• Los jugadores se añadirán al grupo más bajo de la ronda especificada</li>
                <li>• Solo se pueden eliminar jugadores que no hayan jugado partidos confirmados</li>
                <li>• Los jugadores añadidos a rondas futuras aparecerán automáticamente cuando llegue su turno</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}