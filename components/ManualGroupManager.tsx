// components/ManualGroupManager.tsx - VERSIÓN MEJORADA
"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Plus,
  Trash2,
  Move,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  UserPlus,
  UserMinus,
} from "lucide-react";

type Player = {
  id: string;
  name: string;
};

type GroupData = {
  id?: string; // undefined para grupos nuevos
  level: number;
  players: Player[];
};

type Props = {
  roundId: string;
  initialGroups: Array<{
    id: string;
    level: number;
    players: Player[];
  }>;
  availablePlayers?: Player[]; // Opcional, se carga automáticamente
  onSave: (groups: Array<{
    groupId?: string;
    level: number;
    playerIds: string[];
  }>) => Promise<void>;
};

export default function ManualGroupManager({
  roundId,
  initialGroups,
  availablePlayers: providedAvailablePlayers,
  onSave,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [unassignedPlayers, setUnassignedPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  console.log("🚀 ManualGroupManager cargado:", { roundId, initialGroups });
  // Cargar jugadores elegibles para esta ronda
  useEffect(() => {
    async function loadEligiblePlayers() {
      try {
        setLoading(true);
        setError(null);

        // Si se proporcionan jugadores disponibles, usarlos
        if (providedAvailablePlayers) {
          initializeGroups(providedAvailablePlayers);
          setLoading(false);
          return;
        }

        // Cargar jugadores elegibles desde la API
        const response = await fetch(`/api/rounds/${roundId}/eligible-players`);
        if (!response.ok) {
          throw new Error('Error cargando jugadores elegibles');
        }

        const data = await response.json();
        const eligiblePlayers: Player[] = data.players?.map((p: any) => ({
          id: p.playerId || p.id,
          name: p.name
        })) || [];

        initializeGroups(eligiblePlayers);
      } catch (err: any) {
        setError(err.message || 'Error cargando datos');
      } finally {
        setLoading(false);
      }
    }

    loadEligiblePlayers();
  }, [roundId, providedAvailablePlayers]);

  const initializeGroups = (eligiblePlayers: Player[]) => {
    // Convertir grupos iniciales al formato interno
    const initialGroupsData: GroupData[] = initialGroups.map(g => ({
      id: g.id,
      level: g.level,
      players: [...g.players]
    }));

    // Obtener IDs de jugadores ya asignados
    const assignedPlayerIds = new Set(
      initialGroupsData.flatMap(g => g.players.map(p => p.id))
    );

    // Jugadores sin asignar = todos los elegibles - ya asignados
    const unassigned = eligiblePlayers.filter(p => !assignedPlayerIds.has(p.id));

    setGroups(initialGroupsData);
    setUnassignedPlayers(unassigned);
  };

  const createNewGroup = () => {
    const newLevel = Math.max(0, ...groups.map(g => g.level)) + 1;
    const newGroup: GroupData = {
      level: newLevel,
      players: []
    };
    setGroups([...groups, newGroup]);
  };

  const deleteGroup = (groupIndex: number) => {
    const groupToDelete = groups[groupIndex];
    
    // Mover jugadores del grupo eliminado a sin asignar
    setUnassignedPlayers(prev => [...prev, ...groupToDelete.players]);
    
    // Eliminar el grupo
    setGroups(prev => prev.filter((_, i) => i !== groupIndex));
  };

  const movePlayerToGroup = (player: Player, fromGroupIndex: number | null, toGroupIndex: number | null) => {
    // Remover jugador del origen
    if (fromGroupIndex === null) {
      // Desde sin asignar
      setUnassignedPlayers(prev => prev.filter(p => p.id !== player.id));
    } else {
      // Desde otro grupo
      setGroups(prev => prev.map((group, i) => 
        i === fromGroupIndex 
          ? { ...group, players: group.players.filter(p => p.id !== player.id) }
          : group
      ));
    }

    // Añadir jugador al destino
    if (toGroupIndex === null) {
      // A sin asignar
      setUnassignedPlayers(prev => [...prev, player]);
    } else {
      // A otro grupo
      setGroups(prev => prev.map((group, i) => 
        i === toGroupIndex 
          ? { ...group, players: [...group.players, player] }
          : group
      ));
    }
  };

  const updateGroupLevel = (groupIndex: number, newLevel: number) => {
    setGroups(prev => prev.map((group, i) => 
      i === groupIndex ? { ...group, level: newLevel } : group
    ));
  };

  const handleSave = () => {
    const groupsToSave = groups.map(g => ({
      groupId: g.id,
      level: g.level,
      playerIds: g.players.map(p => p.id)
    }));

    // Debug: Log de lo que se va a enviar
    console.log("🔍 Datos a enviar:", {
      roundId,
      groups: groupsToSave,
      totalGroups: groupsToSave.length,
      totalPlayers: groupsToSave.reduce((acc, g) => acc + g.playerIds.length, 0)
    });

    startTransition(async () => {
      try {
        setError(null);
        
        const response = await fetch(`/api/rounds/${roundId}/manage-groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groups: groupsToSave }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          console.error("❌ Error del servidor:", {
            status: response.status,
            error: data.error,
            details: data.details
          });
          throw new Error(data.error || `Error ${response.status}`);
        }

        console.log("✅ Guardado exitoso:", data);
        await onSave(groupsToSave);
        
      } catch (err: any) {
        console.error("❌ Error en handleSave:", err);
        setError(err.message || 'Error al guardar');
      }
    });
  };

  const resetToOriginal = () => {
    // Recargar datos originales
    window.location.reload();
  };

  const hasChanges = () => {
    // Detectar si hay cambios respecto al estado inicial
    if (groups.length !== initialGroups.length) return true;
    
    return groups.some((group, index) => {
      const initial = initialGroups[index];
      if (!initial) return true;
      if (group.level !== initial.level) return true;
      if (group.players.length !== initial.players.length) return true;
      return group.players.some(p => !initial.players.find(ip => ip.id === p.id));
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p>Cargando jugadores elegibles...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Error:</span>
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Move className="w-5 h-5" />
            Gestión Manual de Grupos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{groups.length}</div>
              <div className="text-sm text-gray-600">Grupos creados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{groups.reduce((acc, g) => acc + g.players.length, 0)}</div>
              <div className="text-sm text-gray-600">Jugadores asignados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{unassignedPlayers.length}</div>
              <div className="text-sm text-gray-600">Sin asignar</div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jugadores sin asignar */}
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-600" />
                Sin Asignar
              </span>
              <Badge variant="outline">{unassignedPlayers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unassignedPlayers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Todos los jugadores están asignados
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {unassignedPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-2 bg-white border rounded"
                  >
                    <span className="font-medium">{player.name}</span>
                    <div className="flex gap-1">
                      {groups.map((_, groupIndex) => (
                        <Button
                          key={groupIndex}
                          size="sm"
                          variant="outline"
                          onClick={() => movePlayerToGroup(player, null, groupIndex)}
                          className="text-xs px-2 py-1"
                        >
                          <UserPlus className="w-3 h-3 mr-1" />
                          G{groupIndex + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grupos existentes */}
        <div className="lg:col-span-2 space-y-4">
          {groups.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No hay grupos creados</p>
                <Button onClick={createNewGroup}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primer Grupo
                </Button>
              </CardContent>
            </Card>
          ) : (
            groups.map((group, groupIndex) => (
              <Card key={groupIndex} className="border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>Grupo {groupIndex + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Nivel:</span>
                        <input
                          type="number"
                          min="1"
                          value={group.level}
                          onChange={(e) => updateGroupLevel(groupIndex, parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1 text-sm border rounded"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{group.players.length} jugadores</Badge>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteGroup(groupIndex)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {group.players.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Arrastra jugadores aquí desde "Sin Asignar"
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {group.players.map((player, playerIndex) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded"
                        >
                          <span className="font-medium">{player.name}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => movePlayerToGroup(player, groupIndex, null)}
                            className="text-xs"
                          >
                            <UserMinus className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}

          {/* Acciones */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3">
                <Button onClick={createNewGroup} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Grupo
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={isPending || !hasChanges()}
                  className="flex items-center gap-2"
                >
                  {isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>

                {hasChanges() && (
                  <Button onClick={resetToOriginal} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Revertir Cambios
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Información */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-2">Instrucciones:</p>
              <ul className="text-blue-700 space-y-1">
                <li>• Usa los botones "G1", "G2", etc. para mover jugadores a grupos específicos</li>
                <li>• Usa el botón "−" para devolver jugadores a "Sin Asignar"</li>
                <li>• Ajusta el nivel de cada grupo con los campos numéricos</li>
                <li>• Los cambios se guardan al hacer clic en "Guardar Cambios"</li>
                <li>• Al guardar se eliminan los partidos existentes si los hubiera</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}