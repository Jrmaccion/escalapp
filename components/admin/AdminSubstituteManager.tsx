// components/admin/AdminSubstituteManager.tsx
"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  UserPlus,
  Search,
  Users,
  AlertTriangle,
  CheckCircle,
  X,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type PlayerInRound = {
  id: string;
  name: string;
  position: number;
  groupNumber: number;
  groupLevel: number;
  hasSubstitute: boolean;
  substituteName?: string;
  substituteId?: string;
  usedComodin: boolean;
};

type EligiblePlayer = {
  id: string;
  name: string;
};

type AdminSubstituteManagerProps = {
  roundId: string;
  roundNumber: number;
  tournamentTitle: string;
  isRoundClosed: boolean;
  onSubstituteChanged: () => void;
};

export default function AdminSubstituteManager({
  roundId,
  roundNumber,
  tournamentTitle,
  isRoundClosed,
  onSubstituteChanged,
}: AdminSubstituteManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [playersInRound, setPlayersInRound] = useState<PlayerInRound[]>([]);
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOriginal, setSelectedOriginal] = useState<string | null>(null);
  const [selectedSubstitute, setSelectedSubstitute] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showAssignForm, setShowAssignForm] = useState(false);

  useEffect(() => {
    loadData();
  }, [roundId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [playersResponse, eligibleResponse] = await Promise.all([
        fetch(`/api/rounds/${roundId}/players`), // ya existente
        fetch(`/api/admin/substitute?roundId=${roundId}`), // lista amplia de torneo
      ]);

      if (playersResponse.ok) {
        const playersData = await playersResponse.json();
        setPlayersInRound(playersData.players || []);
      }
      if (eligibleResponse.ok) {
        const eligibleData = await eligibleResponse.json();
        setEligiblePlayers(eligibleData.players || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Grupo del original seleccionado (para excluir “mismo grupo”)
  const originalGroupNumber = useMemo(() => {
    if (!selectedOriginal) return null;
    const p = playersInRound.find((x) => x.id === selectedOriginal);
    return p?.groupNumber ?? null;
  }, [selectedOriginal, playersInRound]);

  // Filtrado: búsqueda + excluir jugadores del MISMO grupo que el original
  const filteredEligiblePlayers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return eligiblePlayers.filter((player) => {
      if (term && !player.name.toLowerCase().includes(term)) return false;
      if (originalGroupNumber == null) return true; // sin original, no excluimos aún
      const isSameGroup = playersInRound.some(
        (p) => p.groupNumber === originalGroupNumber && p.id === player.id
      );
      return !isSameGroup;
    });
  }, [eligiblePlayers, searchTerm, playersInRound, originalGroupNumber]);

  const handleAssignSubstitute = async () => {
    if (!selectedOriginal || !selectedSubstitute) {
      alert("Selecciona tanto el jugador original como el sustituto");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/substitute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roundId,
            originalPlayerId: selectedOriginal,
            substitutePlayerId: selectedSubstitute,
            reason: reason || "Asignación manual por administrador",
          }),
        });

        const data = await response.json();
        if (response.ok) {
          alert(data.message);
          setShowAssignForm(false);
          setSelectedOriginal(null);
          setSelectedSubstitute(null);
          setReason("");
          loadData();
          onSubstituteChanged();
        } else {
          alert(data.error || "Error al asignar sustituto");
        }
      } catch (error) {
        console.error("Error assigning substitute:", error);
        alert("Error de conexión");
      }
    });
  };

  const handleRevokeSubstitute = async (playerId: string, playerName: string) => {
    if (!confirm(`¿Seguro que quieres revocar el sustituto de ${playerName}?`)) return;

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/substitute", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roundId, playerId }),
        });
        const data = await response.json();
        if (response.ok) {
          alert(data.message);
          loadData();
          onSubstituteChanged();
        } else {
          alert(data.error || "Error al revocar sustituto");
        }
      } catch (error) {
        console.error("Error revoking substitute:", error);
        alert("Error de conexión");
      }
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando jugadores...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Gestión de Sustitutos</h3>
          <p className="text-sm text-gray-600">
            Ronda {roundNumber} • {tournamentTitle}
          </p>
        </div>
        {!isRoundClosed && !showAssignForm && (
          <Button onClick={() => setShowAssignForm(true)} className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Asignar Sustituto
          </Button>
        )}
      </div>

      {/* Formulario de asignación */}
      {showAssignForm && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Asignar Sustituto
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowAssignForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Seleccionar jugador original */}
            <div>
              <label className="block text-sm font-medium mb-2">Jugador Original</label>
              <select
                value={selectedOriginal || ""}
                onChange={(e) => setSelectedOriginal(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                <option value="">Seleccionar jugador...</option>
                {playersInRound
                  .filter((p) => !p.hasSubstitute)
                  .map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} (Grupo {player.groupNumber}, Pos. {player.position})
                    </option>
                  ))}
              </select>
            </div>

            {/* Búsqueda de sustitutos */}
            <div>
              <label className="block text-sm font-medium mb-2">Buscar Sustituto</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar jugadores disponibles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="max-h-32 overflow-y-auto border rounded-lg">
                {filteredEligiblePlayers.length === 0 ? (
                  <div className="p-3 text-center text-gray-500 text-sm">
                    No hay jugadores disponibles
                  </div>
                ) : (
                  filteredEligiblePlayers.map((player) => (
                    <div
                      key={player.id}
                      onClick={() => setSelectedSubstitute(player.id)}
                      className={`p-2 cursor-pointer hover:bg-gray-50 ${
                        selectedSubstitute === player.id ? "bg-blue-100 border-l-4 border-blue-500" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{player.name}</span>
                        {selectedSubstitute === player.id && (
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Razón */}
            <div>
              <label className="block text-sm font-medium mb-2">Razón (opcional)</label>
              <Input
                type="text"
                placeholder="Motivo de la asignación..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* Botones */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={handleAssignSubstitute}
                disabled={isPending || !selectedOriginal || !selectedSubstitute}
                className="flex-1"
              >
                {isPending ? "Asignando..." : "Asignar Sustituto"}
              </Button>
              <Button variant="outline" onClick={() => setShowAssignForm(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de jugadores en la ronda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Jugadores en la Ronda
          </CardTitle>
        </CardHeader>
        <CardContent>
          {playersInRound.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay jugadores en esta ronda</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Jugador</th>
                    <th className="px-3 py-2 text-left">Grupo</th>
                    <th className="px-3 py-2 text-left">Posición</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-left">Sustituto</th>
                    {!isRoundClosed && <th className="px-3 py-2 text-center">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {playersInRound.map((player) => (
                    <tr key={player.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-medium">{player.name}</td>
                      <td className="px-3 py-3">
                        <Badge variant="outline">
                          Grupo {player.groupNumber} (Nivel {player.groupLevel})
                        </Badge>
                      </td>
                      <td className="px-3 py-3">#{player.position}</td>
                      <td className="px-3 py-3">
                        {player.hasSubstitute ? (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                            Con sustituto
                          </Badge>
                        ) : player.usedComodin ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            Comodín usado
                          </Badge>
                        ) : (
                          <Badge variant="outline">Activo</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {player.substituteName ? (
                          <span className="text-sm font-medium text-orange-600">{player.substituteName}</span>
                        ) : (
                          <span className="text-gray-400 text-sm">Sin sustituto</span>
                        )}
                      </td>
                      {!isRoundClosed && (
                        <td className="px-3 py-3 text-center">
                          {player.hasSubstitute ? (
                            <Button
                              onClick={() => handleRevokeSubstitute(player.id, player.name)}
                              disabled={isPending}
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Revocar
                            </Button>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información sobre sustitutos */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800">Gestión de Sustitutos por Admin:</p>
              <ul className="text-yellow-700 mt-1 space-y-1">
                <li>• Los elegibles incluyen a todos los jugadores del torneo</li>
                <li>• No puedes elegir a alguien del mismo grupo que el jugador original</li>
                <li>• El sustituto puede estar jugando su grupo y, además, actuar como sustituto</li>
                <li>• La asignación afecta a partidos futuros no confirmados</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
