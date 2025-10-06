// components/ManualGroupManager.tsx - VERSIÓN CORREGIDA
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
  AlertCircle,
} from "lucide-react";

type Player = {
  id: string;
  name: string;
};

type GroupData = {
  id?: string;
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
  availablePlayers?: Player[];
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
  const [showForceDialog, setShowForceDialog] = useState(false);
  const [pendingGroups, setPendingGroups] = useState<any[] | null>(null);

  useEffect(() => {
    async function loadEligiblePlayers() {
      try {
        setLoading(true);
        setError(null);

        if (providedAvailablePlayers) {
          initializeGroups(providedAvailablePlayers);
          setLoading(false);
          return;
        }

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
    const initialGroupsData: GroupData[] = initialGroups.map(g => ({
      id: g.id,
      level: g.level,
      players: [...g.players]
    }));

    const assignedPlayerIds = new Set(
      initialGroupsData.flatMap(g => g.players.map(p => p.id))
    );

    const unassigned = eligiblePlayers.filter(p => !assignedPlayerIds.has(p.id));

    setGroups(initialGroupsData);
    setUnassignedPlayers(unassigned);
  };

  const createNewGroup = () => {
    // Advertencia: los grupos nuevos no se pueden guardar hasta que se creen en BD
    setError("⚠️ Nota: Los grupos nuevos aún no están implementados. Solo puedes modificar grupos existentes.");
    
    const newLevel = Math.max(0, ...groups.map(g => g.level)) + 1;
    const newGroup: GroupData = {
      level: newLevel,
      players: []
    };
    setGroups([...groups, newGroup]);
  };

  const deleteGroup = (groupIndex: number) => {
    const groupToDelete = groups[groupIndex];
    setUnassignedPlayers(prev => [...prev, ...groupToDelete.players]);
    setGroups(prev => prev.filter((_, i) => i !== groupIndex));
  };

  const movePlayerToGroup = (player: Player, fromGroupIndex: number | null, toGroupIndex: number | null) => {
    if (fromGroupIndex === null) {
      setUnassignedPlayers(prev => prev.filter(p => p.id !== player.id));
    } else {
      setGroups(prev => prev.map((group, i) => 
        i === fromGroupIndex 
          ? { ...group, players: group.players.filter(p => p.id !== player.id) }
          : group
      ));
    }

    if (toGroupIndex === null) {
      setUnassignedPlayers(prev => [...prev, player]);
    } else {
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

  const handleSave = async (forceRegenerate: boolean = false) => {
    // Formato correcto según la API: array de { groupId, players: [{ playerId }] }
    const groupsToSave = groups
      .filter(g => g.id) // Solo grupos que ya existen en BD
      .map(g => ({
        groupId: g.id!,
        players: g.players.map(p => ({ playerId: p.id }))
      }));

    // Validación antes de enviar
    if (groupsToSave.length === 0) {
      setError("No hay grupos válidos para guardar. Crea grupos primero.");
      return;
    }

    console.log("📤 Datos a enviar:", {
      roundId,
      groups: groupsToSave,
      forceRegenerate,
      totalGroups: groupsToSave.length,
      totalPlayers: groupsToSave.reduce((acc, g) => acc + g.players.length, 0)
    });

    startTransition(async () => {
      try {
        setError(null);
        
        const response = await fetch(`/api/rounds/${roundId}/manage-groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            groups: groupsToSave,
            forceRegenerate 
          }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          // Si el error es sobre partidos existentes y no forzamos regeneración
          if (data.error?.includes("partidos generados") && !forceRegenerate) {
            console.log("⚠️ Se requiere confirmación para regenerar partidos");
            setPendingGroups(groupsToSave);
            setShowForceDialog(true);
            return;
          }

          console.error("❌ Error del servidor:", {
            status: response.status,
            error: data.error,
            details: data.details
          });
          
          // Mostrar error más descriptivo
          let errorMsg = data.error || `Error ${response.status}`;
          if (data.details) {
            errorMsg += ` - ${JSON.stringify(data.details)}`;
          }
          throw new Error(errorMsg);
        }

        console.log("✅ Guardado exitoso:", data);
        
        // Convertir de vuelta al formato para onSave si es necesario
        const savedGroupsForCallback = groupsToSave.map(g => ({
          groupId: g.groupId,
          level: groups.find(orig => orig.id === g.groupId)?.level || 1,
          playerIds: g.players.map(p => p.playerId)
        }));
        
        await onSave(savedGroupsForCallback);
        
      } catch (err: any) {
        console.error("❌ Error en handleSave:", err);
        setError(err.message || 'Error al guardar');
      }
    });
  };

  const handleForceRegenerate = async () => {
    setShowForceDialog(false);
    if (pendingGroups) {
      await handleSave(true);
      setPendingGroups(null);
    }
  };

  const resetToOriginal = () => {
    window.location.reload();
  };

  const hasChanges = () => {
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
      {/* Diálogo de confirmación para forzar regeneración */}
      {showForceDialog && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-orange-900 mb-2">
                  ⚠️ Regenerar partidos existentes
                </h3>
                <p className="text-sm text-orange-800 mb-4">
                  Algunos grupos ya tienen partidos generados. Si continúas, estos partidos se eliminarán y se volverán a crear con la nueva configuración de jugadores.
                </p>
                <div className="bg-white border border-orange-200 rounded p-3 mb-4 text-xs text-gray-700">
                  <strong>Esto eliminará:</strong>
                  <ul className="list-disc ml-5 mt-1">
                    <li>Todos los partidos generados (sets) de los grupos modificados</li>
                    <li>Cualquier resultado NO confirmado</li>
                  </ul>
                  <p className="mt-2">
                    <strong>Los resultados confirmados están protegidos</strong> y no se pueden eliminar.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowForceDialog(false);
                      setPendingGroups(null);
                    }}
                    variant="outline"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleForceRegenerate}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Sí, regenerar partidos
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                      {group.players.map((player) => (
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
                  onClick={() => handleSave(false)}
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
                <li>• Si hay partidos generados, se te pedirá confirmación para regenerarlos</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}