"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Shuffle,
  Crown,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Trash2,
  Info,
  Settings,
  Plus,
  Clock,
  Pencil,
  X,
  Move
} from "lucide-react";
import MatchEditDialog from "@/components/MatchEditDialog";
import ManualGroupManager from "@/components/ManualGroupManager";

/* ----------------------------- Tipos de datos ----------------------------- */
type Group = {
  id: string;
  number: number;
  level: number;
  players: Array<{
    id: string;
    name: string;
    position: number;
  }>;
};

type Tournament = {
  id: string;
  title: string;
  totalPlayers: number;
};

type MatchSummary = {
  id: string;
  groupId: string;
  groupNumber: number;
  setNumber: number | null;
  isConfirmed: boolean;
  team1Player1Id?: string | null;
  team1Player2Id?: string | null;
  team2Player1Id?: string | null;
  team2Player2Id?: string | null;
  team1Games?: number | null;
  team2Games?: number | null;
  tiebreakScore?: string | null;
};

type GroupManagementPanelProps = {
  roundId: string;
  roundNumber: number;
  tournament: Tournament;
  groups: Group[];
  availablePlayers: number;
  isAdmin?: boolean;
  isClosed?: boolean;
};

export default function GroupManagementPanel({
  roundId,
  roundNumber,
  tournament,
  groups,
  availablePlayers,
  isAdmin = true,
  isClosed = false,
}: GroupManagementPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<"random" | "ranking">("random");
  const [playersPerGroup, setPlayersPerGroup] = useState(4);

  // Estado de sets
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [editing, setEditing] = useState<MatchSummary | null>(null);

  const hasGroups = groups.length > 0;
  const canCreateGroups =
    availablePlayers >= playersPerGroup &&
    availablePlayers % playersPerGroup === 0;
  const totalGroupsNeeded = Math.floor(availablePlayers / playersPerGroup);

  /* ---------------------------- Carga de matches --------------------------- */
  async function reloadMatches() {
    setLoadingMatches(true);
    setError(null);
    try {
      const res = await fetch(`/api/rounds/${roundId}/matches`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudieron cargar los sets");
      const items: MatchSummary[] = Array.isArray(data?.matches) ? data.matches : [];
      setMatches(items);
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar los sets");
    } finally {
      setLoadingMatches(false);
    }
  }

  useEffect(() => {
    reloadMatches();
  }, [roundId]);

  /* -------------------------- Métricas y filtrado -------------------------- */
  const totalSets = matches.length;
  const completedSets = matches.filter((m) => m.isConfirmed).length;

  type Filter = "all" | "pending" | "completed";
  const [selectedFilter, setSelectedFilter] = useState<Filter>("all");

  const filteredMatches = useMemo(() => {
    if (selectedFilter === "completed") return matches.filter((m) => m.isConfirmed);
    if (selectedFilter === "pending") return matches.filter((m) => !m.isConfirmed);
    return matches;
  }, [matches, selectedFilter]);

  /* -------------------------------- Helpers -------------------------------- */
  const getPlayerName = (playerId?: string | null): string => {
    if (!playerId) return "—";
    for (const g of groups) {
      const p = g.players.find((x) => x.id === playerId);
      if (p) return p.name;
    }
    return "—";
  };

  const patchMatch = async (
    id: string,
    payload: { team1Games: number; team2Games: number; tiebreakScore?: string | null; action?: "report" | "confirm" }
  ) => {
    const res = await fetch(`/api/matches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "No se pudo actualizar el set");
    return data;
  };

  const deleteMatch = async (id: string) => {
    const res = await fetch(`/api/matches/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "No se pudo limpiar el set");
    return data;
  };

  const handleConfirm = (m: MatchSummary) => {
    if (!isAdmin && (!Number.isInteger(m.team1Games) || !Number.isInteger(m.team2Games))) {
      alert("No hay resultado que confirmar.");
      return;
    }
    startTransition(async () => {
      setError(null);
      try {
        const t1 = Number(m.team1Games);
        const t2 = Number(m.team2Games);
        if (!isAdmin && (!Number.isInteger(t1) || !Number.isInteger(t2))) {
          throw new Error("Faltan juegos para confirmar.");
        }
        await patchMatch(m.id, {
          team1Games: Number.isInteger(t1) ? t1 : 4,
          team2Games: Number.isInteger(t2) ? t2 : 4,
          tiebreakScore: m.tiebreakScore ?? undefined,
          action: isAdmin ? undefined : "confirm",
        } as any);
        await reloadMatches();
      } catch (e: any) {
        setError(e?.message || "Error al confirmar el set");
      }
    });
  };

  const handleDelete = (m: MatchSummary) => {
    if (!confirm("¿Limpiar el resultado de este set?")) return;
    startTransition(async () => {
      setError(null);
      try {
        await deleteMatch(m.id);
        await reloadMatches();
      } catch (e: any) {
        setError(e?.message || "Error al limpiar el set");
      }
    });
  };

  const generateGroups = async (force = false) => {
    if (!isAdmin) {
      alert("Solo los administradores pueden generar grupos");
      return;
    }
    if (!canCreateGroups && !force) {
      alert(
        `No se pueden crear grupos. Necesitas ${playersPerGroup} jugadores o múltiplos de ${playersPerGroup}. Tienes ${availablePlayers} jugadores.`
      );
      return;
    }
    const confirmMessage = force
      ? `¿Regenerar todos los grupos? Se eliminarán los ${groups.length} grupos existentes.`
      : `¿Crear ${totalGroupsNeeded} grupos con ${playersPerGroup} jugadores cada uno usando distribución '${
          strategy === "random" ? "aleatoria" : "por ranking"
        }'?`;
    if (!confirm(confirmMessage)) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/rounds/${roundId}/generate-groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ strategy, playersPerGroup, force }),
        });
        const data = await response.json();
        if (response.ok) {
          setMessage(data.message || "Grupos generados correctamente.");
          setTimeout(() => setMessage(null), 5000);
          await reloadMatches();
          window.location.reload();
        } else {
          alert(data.error || "Error generando grupos");
        }
      } catch {
        alert("Error de conexión");
      }
    });
  };

  // Nueva función para gestión manual
  const handleManualSave = async (groupsData: Array<{
    groupId?: string;
    level: number;
    playerIds: string[];
  }>) => {
    try {
      const response = await fetch(`/api/rounds/${roundId}/manage-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: groupsData }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage(data.message || "Grupos reorganizados correctamente.");
        setTimeout(() => setMessage(null), 5000);
        window.location.reload();
      } else {
        throw new Error(data.error || "Error guardando grupos");
      }
    } catch (error: any) {
      setError(error.message);
      throw error; // Re-throw para que ManualGroupManager pueda manejarlo
    }
  };

  /* --------------------------------- Render -------------------------------- */
  return (
    <div className="space-y-6">
      {/* Estado general */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Gestión de Grupos - Ronda {roundNumber}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{availablePlayers}</div>
              <div className="text-sm text-gray-600">Jugadores disponibles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{groups.length}</div>
              <div className="text-sm text-gray-600">Grupos creados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totalGroupsNeeded}</div>
              <div className="text-sm text-gray-600">Grupos necesarios</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{playersPerGroup}</div>
              <div className="text-sm text-gray-600">Jugadores por grupo</div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <CheckCircle className="w-4 h-4 inline mr-1" />
              {message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuración y acciones */}
      <Tabs defaultValue="matches" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="generate">Generar Automático</TabsTrigger>
          <TabsTrigger value="manual">Gestión Manual</TabsTrigger>
          <TabsTrigger value="view">Ver Grupos</TabsTrigger>
          <TabsTrigger value="matches">Gestionar Sets</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Generación Automática de Grupos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Información específica por ronda */}
              {roundNumber === 1 ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700 mb-2">
                    <Info className="w-4 h-4" />
                    <span className="font-medium">Primera ronda</span>
                  </div>
                  <p className="text-sm text-blue-600">
                    Se creará una distribución inicial ordenada alfabéticamente. 
                    Las estrategias "aleatoria" y "por ranking" tienen el mismo resultado en R1.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-700 mb-2">
                    <Crown className="w-4 h-4" />
                    <span className="font-medium">Ronda {roundNumber}</span>
                  </div>
                  <p className="text-sm text-orange-600">
                    Los grupos se generan automáticamente basándose en los movimientos de escalera 
                    de la ronda anterior. La ronda anterior debe estar cerrada.
                  </p>
                </div>
              )}

              {/* Estrategia - Solo para R1 */}
              {roundNumber === 1 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Estrategia de distribución</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={() => setStrategy("random")}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        strategy === "random" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Shuffle className="w-4 h-4" />
                        <span className="font-medium">Aleatoria</span>
                      </div>
                      <p className="text-sm text-gray-600">Distribución alfabética determinista.</p>
                    </button>

                    <button
                      onClick={() => setStrategy("ranking")}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        strategy === "ranking" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Crown className="w-4 h-4" />
                        <span className="font-medium">Por Ranking</span>
                      </div>
                      <p className="text-sm text-gray-600">Mismo resultado que aleatoria en R1 (no hay ranking previo).</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Jugadores por grupo */}
              <div>
                <label className="block text-sm font-medium mb-2">Jugadores por grupo: {playersPerGroup}</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="4"
                    max="8"
                    step="1"
                    value={playersPerGroup}
                    onChange={(e) => setPlayersPerGroup(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <div className="flex gap-2">
                    {[4, 6, 8].map((size) => (
                      <button
                        key={size}
                        onClick={() => setPlayersPerGroup(size)}
                        className={`px-3 py-1 rounded text-sm ${
                          playersPerGroup === size ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Validación */}
              {canCreateGroups ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">Listo para crear grupos</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">
                      No se pueden crear grupos: {availablePlayers} jugadores no es divisible por {playersPerGroup}
                    </span>
                  </div>
                  <p className="text-sm text-red-600 mt-1">
                    Necesitas añadir {playersPerGroup - (availablePlayers % playersPerGroup)} jugadores más o cambiar el tamaño de grupo.
                  </p>
                </div>
              )}

              {/* Botones */}
              {isAdmin && (
                <div className="flex flex-wrap gap-3 pt-4">
                  <Button onClick={() => generateGroups(false)} disabled={isPending || (hasGroups && !canCreateGroups)} className="flex items-center gap-2">
                    {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                    {hasGroups ? "Regenerar Grupos" : "Crear Grupos"}
                  </Button>
                  {hasGroups && (
                    <Button onClick={() => generateGroups(true)} disabled={isPending} variant="destructive" className="flex items-center gap-2">
                      {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Forzar Regeneración
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gestión Manual */}
        <TabsContent value="manual" className="space-y-4">
          <ManualGroupManager
            roundId={roundId}
            initialGroups={groups.map(g => ({
              id: g.id,
              level: g.level,
              players: g.players.map(p => ({
                id: p.id,
                name: p.name
              }))
            }))}
            onSave={handleManualSave}
          />
        </TabsContent>

        {/* Vista de grupos */}
        <TabsContent value="view" className="space-y-4">
          {hasGroups ? (
            <div className="grid gap-4">
              {groups.map((group) => (
                <Card key={group.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Grupo {group.number} - Nivel {group.level}</span>
                      <Badge variant="outline">{group.players.length} jugadores</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.players
                        .slice()
                        .sort((a, b) => a.position - b.position)
                        .map((player) => (
                          <div key={player.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold">
                              {player.position}
                            </div>
                            <span className="font-medium">{player.name}</span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No hay grupos creados para esta ronda</p>
                <p className="text-sm text-gray-500">Usa la pestaña "Generar Automático" o "Gestión Manual".</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Gestión de sets */}
        <TabsContent value="matches" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Gestión de Sets de la Ronda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{totalSets}</div>
                  <div className="text-sm text-gray-600">Sets totales</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{completedSets}</div>
                  <div className="text-sm text-gray-600">Completados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{totalSets - completedSets}</div>
                  <div className="text-sm text-gray-600">Pendientes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0}%
                  </div>
                  <div className="text-sm text-gray-600">Progreso</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button variant={selectedFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setSelectedFilter("all")}>
                    Todos ({totalSets})
                  </Button>
                  <Button variant={selectedFilter === "pending" ? "default" : "outline"} size="sm" onClick={() => setSelectedFilter("pending")}>
                    Pendientes ({totalSets - completedSets})
                  </Button>
                  <Button variant={selectedFilter === "completed" ? "default" : "outline"} size="sm" onClick={() => setSelectedFilter("completed")}>
                    Completados ({completedSets})
                  </Button>
                </div>
                <div className="text-sm text-gray-500">
                  {loadingMatches ? "Cargando…" : `${filteredMatches.length} sets mostrados`}
                </div>
              </div>

              <div className="space-y-2 max-h-[32rem] overflow-y-auto">
                {filteredMatches.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No hay sets para mostrar</p>
                  </div>
                ) : (
                  filteredMatches.map((m) => {
                    const hasResult = m.team1Games != null && m.team2Games != null;

                    return (
                      <div
                        key={m.id}
                        className={`p-4 rounded-lg border transition-colors ${
                          m.isConfirmed
                            ? "bg-green-50 border-green-200"
                            : hasResult
                            ? "bg-yellow-50 border-yellow-200"
                            : "bg-white border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge variant="outline" className="shrink-0">
                                Grupo {m.groupNumber} — Set {m.setNumber ?? "—"}
                              </Badge>
                              {m.isConfirmed && (
                                <Badge className="bg-green-100 text-green-700 shrink-0">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Confirmado
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="truncate">
                                  {getPlayerName(m.team1Player1Id)} + {getPlayerName(m.team1Player2Id)}
                                </span>
                                <span className="font-bold text-lg ml-2">{m.team1Games ?? "-"}</span>
                              </div>

                              <div className="text-center text-xs text-gray-400">vs</div>

                              <div className="flex items-center justify-between">
                                <span className="truncate">
                                  {getPlayerName(m.team2Player1Id)} + {getPlayerName(m.team2Player2Id)}
                                </span>
                                <span className="font-bold text-lg ml-2">{m.team2Games ?? "-"}</span>
                              </div>
                            </div>

                            {m.tiebreakScore && (
                              <div className="text-xs text-blue-600 mt-1">
                                Tie-break: {m.tiebreakScore}
                              </div>
                            )}
                          </div>

                          <div className="ml-4 flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditing(m)}>
                              <Pencil className="w-4 h-4 mr-1" />
                              Editar
                            </Button>

                            {!m.isConfirmed && (
                              <Button variant="default" size="sm" onClick={() => handleConfirm(m)}>
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {isAdmin ? "Forzar confirmar" : "Confirmar"}
                              </Button>
                            )}

                            <Button variant="destructive" size="sm" onClick={() => handleDelete(m)}>
                              <Trash2 className="w-4 h-4 mr-1" />
                              Borrar
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {!isClosed && (
                <div className="flex flex-wrap gap-3 pt-4 border-t">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/admin/results">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Validar Resultados
                    </Link>
                  </Button>

                  {totalSets - completedSets > 0 && (
                    <Button variant="outline" size="sm" onClick={reloadMatches}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Recargar (pendientes: {totalSets - completedSets})
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo de edición */}
      {editing && (
        <MatchEditDialog
          isAdmin={isAdmin}
          match={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reloadMatches();
          }}
        />
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 mb-1">Flujo recomendado:</p>
            <ul className="text-blue-700 space-y-1">
              <li>• <strong>R1:</strong> Generar automático → Opcional: ajustar manual → Crear partidos</li>
              <li>• <strong>R2+:</strong> Cerrar ronda anterior (genera automático) → Opcional: ajustar manual → Crear partidos</li>
              <li>• La gestión manual permite reorganizar antes de crear partidos</li>
              <li>• Los partidos se eliminan al reorganizar manualmente</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}