// app/admin/tournaments/[id]/TournamentDetailClient.tsx - CORREGIDO SIN ERRORES DE HIDRATACIÓN
"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Calendar,
  Trophy,
  Settings,
  Play,
  Power,
  Trash2,
  AlertTriangle,
  Target,
  Clock,
  Zap,
  RefreshCw,
} from "lucide-react";
// Importaciones de gestión
import TournamentPlayersManager from "./TournamentPlayersManager";
import GroupManagementPanel from "@/components/GroupManagementPanel";
import ComodinSettings from "@/components/admin/ComodinSettings";
// Configuración de rachas
import StreakSettings from "@/components/admin/StreakSettings";
import AdminSubstituteManager from "@/components/admin/AdminSubstituteManager";

/* ========================= Tipos ========================= */
type SerializedTournament = {
  id: string;
  title: string;
  totalPlayers: number;
  startDate: string;
  endDate: string;
  totalRounds: number;
  roundDurationDays: number;
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

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

type SerializedRound = {
  id: string;
  number: number;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  groupsCount: number;
  playersCount: number;
  matchesCount: number;
  pendingMatches: number;
  groups?: Group[];
};

type SerializedPlayer = {
  id: string;
  name: string;
  email: string;
  joinedRound: number;
  comodinesUsed: number;
};

type Stats = {
  totalPlayers: number;
  totalRounds: number;
  activeRounds: number;
  totalMatches: number;
  confirmedMatches: number;
  pendingMatches: number;
  completionPercentage: number;
  averagePlayersPerRound: number;
};

/* =============================================================================
 * Componente principal
 * =========================================================================== */
export default function TournamentDetailClient({
  tournament,
  rounds,
  players,
  stats,
}: {
  tournament?: SerializedTournament;
  rounds?: SerializedRound[];
  players?: SerializedPlayer[];
  stats?: Stats;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isClient, setIsClient] = useState(false);

  // ✅ CORREGIDO: Usar useEffect para operaciones de cliente (evita mismatches de hidratación)
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fallbacks seguros que son consistentes en servidor y cliente
  if (!tournament) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Cargando datos del torneo...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const safeRounds = rounds || [];
  const safePlayers = players || [];
  const safeStats = stats || {
    totalPlayers: 0,
    totalRounds: 0,
    activeRounds: 0,
    totalMatches: 0,
    confirmedMatches: 0,
    pendingMatches: 0,
    completionPercentage: 0,
    averagePlayersPerRound: 0,
  };

  type TabId = "overview" | "rounds" | "players" | "comodines" | "rachas" | "settings";
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(() => {
    if (!safeRounds || safeRounds.length === 0) return null;
    return safeRounds.find((r) => !r.isClosed)?.id ?? safeRounds[0]?.id ?? null;
  });

  const selectedRound = safeRounds?.find((r) => r.id === selectedRoundId) || null;
  const currentRound =
    safeRounds?.find((r) => !r.isClosed) ||
    (safeRounds && safeRounds.length > 0 ? safeRounds[safeRounds.length - 1] : undefined);

  const handlePlayersUpdated = () => {
    router.refresh();
  };

  const toggleTournamentStatus = () => {
    const action = tournament.isActive ? "desactivar" : "activar";
    if (!confirm(`¿Seguro que quieres ${action} este torneo?`)) return;

    startTransition(async () => {
      try {
        const endpoint = tournament.isActive
          ? `/api/tournaments/${tournament.id}/deactivate`
          : `/api/tournaments/${tournament.id}/activate`;

        const res = await fetch(endpoint, { method: "PATCH" });
        if (res.ok) {
          router.refresh();
        } else {
          alert(`Error al ${action} torneo`);
        }
      } catch {
        alert("Error de conexión");
      }
    });
  };

  const deleteTournament = () => {
    if (!confirm("¿SEGURO que quieres eliminar este torneo? Esta acción es irreversible.")) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournament.id}`, {
          method: "DELETE",
        });

        if (res.ok) {
          router.push("/admin/tournaments");
        } else {
          const data = await res.json();
          alert(data.error || "Error al eliminar torneo");
        }
      } catch (error) {
        console.error("Error deleting tournament:", error);
        alert("Error de conexión");
      }
    });
  };

  // ✅ CORREGIDO: Formateo de fechas consistente (SSR y primer render del cliente iguales)
  const formatDate = (dateStr: string) => {
    if (!isClient) {
      // En el servidor y durante la hidratación en el cliente (primer render), usar formato estable
      return new Date(dateStr).toISOString().split("T")[0];
    }
    // Tras montar en cliente, podemos usar formato localizado
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getRoundStatus = (round: SerializedRound) => {
    if (round.isClosed) return { label: "Cerrada", variant: "secondary" as const };

    if (!isClient) {
      // En SSR/primer render, evitar depender de la hora actual para no desincronizar
      return { label: "En curso", variant: "default" as const };
    }

    const now = new Date();
    const start = new Date(round.startDate);
    const end = new Date(round.endDate);

    if (now >= start && now <= end) return { label: "En curso", variant: "default" as const };
    if (now < start) return { label: "Próxima", variant: "outline" as const };
    return { label: "Fuera de plazo", variant: "destructive" as const };
  };

  return (
    <div className="space-y-6">
      {/* Header con KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{safeStats.totalPlayers}</div>
                <div className="text-sm text-gray-600">Jugadores</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{safeStats.activeRounds}</div>
                <div className="text-sm text-gray-600">Rondas activas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">
                  {Math.round(safeStats.completionPercentage)}%
                </div>
                <div className="text-sm text-gray-600">Progreso</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">{safeStats.pendingMatches}</div>
                <div className="text-sm text-gray-600">Pendientes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Gestión del Torneo
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={tournament.isActive ? "default" : "secondary"}>
                {tournament.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Resumen</TabsTrigger>
              <TabsTrigger value="rounds">Rondas</TabsTrigger>
              <TabsTrigger value="players">Jugadores</TabsTrigger>
              <TabsTrigger value="comodines">Comodines</TabsTrigger>
              <TabsTrigger value="rachas">Rachas</TabsTrigger>
              <TabsTrigger value="settings">Configuración</TabsTrigger>
            </TabsList>

            {/* ===================== PESTAÑA: RESUMEN ===================== */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {currentRound ? (
                <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="w-5 h-5 text-blue-600" />
                      Ronda Actual: Ronda {currentRound.number}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Estado:</span>
                        <div className="font-medium">
                          {getRoundStatus(currentRound).label}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Grupos:</span>
                        <div className="font-medium">{currentRound.groupsCount}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Partidos:</span>
                        <div className="font-medium">{currentRound.matchesCount}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Pendientes:</span>
                        <div className="font-medium text-orange-600">
                          {currentRound.pendingMatches}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button asChild>
                        <Link href={`/admin/rounds/${currentRound.id}`}>
                          Gestionar Ronda Actual
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                    <p className="text-amber-800 font-medium">
                      No hay rondas configuradas
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      Configure las rondas del torneo para comenzar
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Información del torneo */}
              <Card>
                <CardHeader>
                  <CardTitle>Información General</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Inicio:</span>
                      <div className="font-medium">
                        {formatDate(tournament.startDate)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Fin:</span>
                      <div className="font-medium">
                        {formatDate(tournament.endDate)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Total rondas:</span>
                      <div className="font-medium">{tournament.totalRounds}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Días por ronda:</span>
                      <div className="font-medium">
                        {tournament.roundDurationDays}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Visibilidad:</span>
                      <div className="font-medium">
                        {tournament.isPublic ? "Público" : "Privado"}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Progreso total:</span>
                      <div className="font-medium">
                        {safeStats.confirmedMatches} / {safeStats.totalMatches} partidos
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* =================== PESTAÑA: RONDAS =================== */}
            <TabsContent value="rounds" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Seleccionar Ronda para Gestionar</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {safeRounds.length > 0 ? (
                      safeRounds.map((round) => {
                        const status = getRoundStatus(round);
                        return (
                          <Button
                            key={round.id}
                            variant={
                              round.id === selectedRoundId ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setSelectedRoundId(round.id)}
                            className="flex items-center gap-2"
                          >
                            Ronda {round.number}
                            <Badge variant={status.variant} className="ml-1 text-xs">
                              {status.label}
                            </Badge>
                          </Button>
                        );
                      })
                    ) : (
                      <div className="text-sm text-gray-500">
                        No hay rondas disponibles.
                      </div>
                    )}
                  </div>

                  {selectedRound && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">
                          Ronda {selectedRound.number}
                        </h4>
                        <Button size="sm" asChild>
                          <Link href={`/admin/rounds/${selectedRound.id}`}>
                            Abrir Vista Completa
                          </Link>
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Fechas:</span>
                          <div>
                            {formatDate(selectedRound.startDate)} -{" "}
                            {formatDate(selectedRound.endDate)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Grupos:</span>
                          <div className="font-medium">
                            {selectedRound.groupsCount}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Jugadores:</span>
                          <div className="font-medium">
                            {selectedRound.playersCount}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Pendientes:</span>
                          <div className="font-medium text-orange-600">
                            {selectedRound.pendingMatches}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Panel de gestión de grupos */}
              {selectedRound && (
                <GroupManagementPanel
                  roundId={selectedRound.id}
                  roundNumber={selectedRound.number}
                  tournament={{
                    id: tournament.id,
                    title: tournament.title,
                    totalPlayers: tournament.totalPlayers,
                  }}
                  groups={selectedRound.groups || []}
                  availablePlayers={selectedRound.playersCount}
                  isAdmin={true}
                  isClosed={selectedRound.isClosed}
                />
              )}

              {/* Tabla de rondas */}
              <Card>
                <CardHeader>
                  <CardTitle>Todas las Rondas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Ronda</th>
                          <th className="px-3 py-2 text-left">Fechas</th>
                          <th className="px-3 py-2 text-left">Estado</th>
                          <th className="px-3 py-2 text-center">Grupos</th>
                          <th className="px-3 py-2 text-center">Partidos</th>
                          <th className="px-3 py-2 text-center">Pendientes</th>
                          <th className="px-3 py-2 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {safeRounds.length > 0 ? (
                          safeRounds.map((round) => {
                            const status = getRoundStatus(round);
                            return (
                              <tr key={round.id} className="hover:bg-gray-50">
                                <td className="px-3 py-3 font-medium">
                                  #{round.number}
                                </td>
                                <td className="px-3 py-3 text-xs">
                                  {formatDate(round.startDate)} -{" "}
                                  {formatDate(round.endDate)}
                                </td>
                                <td className="px-3 py-3">
                                  <Badge variant={status.variant} className="text-xs">
                                    {status.label}
                                  </Badge>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {round.groupsCount}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {round.matchesCount}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <span
                                    className={
                                      round.pendingMatches > 0
                                        ? "text-orange-600 font-medium"
                                        : ""
                                    }
                                  >
                                    {round.pendingMatches}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <Button size="sm" variant="outline" asChild>
                                    <Link href={`/admin/rounds/${round.id}`}>
                                      Gestionar
                                    </Link>
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              className="px-3 py-3 text-sm text-gray-500"
                              colSpan={7}
                            >
                              No hay rondas registradas.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* =================== PESTAÑA: JUGADORES =================== */}
            <TabsContent value="players" className="space-y-6 mt-6">
              <TournamentPlayersManager
                tournamentId={tournament.id}
                tournamentTitle={tournament.title}
                totalRounds={tournament.totalRounds}
                currentPlayers={safePlayers}
                onPlayersUpdated={handlePlayersUpdated}
              />
            </TabsContent>

            {/* =================== PESTAÑA: COMODINES =================== */}
            <TabsContent value="comodines" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <ComodinSettings
                    tournamentId={tournament.id}
                    tournamentName={tournament.title}
                    onSettingsChanged={() => {
                      router.refresh();
                    }}
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      Comodines por Ronda
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {safeRounds.length > 0 ? (
                        safeRounds.map((round) => (
                          <div
                            key={round.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                          >
                            <div>
                              <div className="font-medium">Ronda {round.number}</div>
                              <div className="text-sm text-gray-600">
                                {formatDate(round.startDate)} -{" "}
                                {formatDate(round.endDate)}
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge
                                variant={getRoundStatus(round).variant}
                                className="mb-1"
                              >
                                {getRoundStatus(round).label}
                              </Badge>
                              <div className="text-xs text-gray-500">
                                {round.playersCount} jugadores
                              </div>
                            </div>
                            <Button size="sm" variant="outline" asChild className="ml-3">
                              <Link href={`/admin/rounds/${round.id}/comodines`}>
                                Ver Comodines
                              </Link>
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500">
                          No hay rondas para listar comodines.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* NUEVA SECCIÓN: Gestión de Sustitutos por Admin */}
              {selectedRound && (
                <div className="mt-8">
                  <AdminSubstituteManager
                    roundId={selectedRound.id}
                    roundNumber={selectedRound.number}
                    tournamentTitle={tournament.title}
                    isRoundClosed={selectedRound.isClosed}
                    onSubstituteChanged={() => {
                      router.refresh();
                    }}
                  />
                </div>
              )}

              {/* Información sobre comodines */}
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-blue-900">Sistema de Comodines</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-800">
                    <div>
                      <h4 className="font-medium mb-2">Comodín de Media</h4>
                      <ul className="space-y-1 text-xs">
                        <li>• Calcula automáticamente la puntuación promedio</li>
                        <li>• Rondas 1-2: Media del grupo actual</li>
                        <li>• Rondas 3+: Media personal histórica</li>
                        <li>• No cuenta como ronda jugada para ranking oficial</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Gestión de Sustitutos</h4>
                      <ul className="space-y-1 text-xs">
                        <li>• Los administradores pueden asignar sustitutos manualmente</li>
                        <li>• Los puntos se asignan al jugador original</li>
                        <li>• Asignación revocable hasta que haya partidos confirmados</li>
                        <li>• Solo jugadores no participantes en la ronda son elegibles</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* =================== PESTAÑA: RACHAS =================== */}
            <TabsContent value="rachas" className="space-y-6 mt-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Rachas de Continuidad
                </h2>
                <p className="text-gray-600">
                  Configuración de bonificaciones por participación consecutiva
                </p>
              </div>

              <StreakSettings
                tournamentId={tournament.id}
                tournamentName={tournament.title}
                onSettingsChanged={() => {
                  router.refresh();
                }}
              />
            </TabsContent>
            

            {/* =================== PESTAÑA: CONFIGURACIÓN =================== */}
            <TabsContent value="settings" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Configuración del Torneo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Estado del torneo</div>
                      <div className="text-sm text-gray-600">
                        {tournament.isActive
                          ? "El torneo está activo y visible"
                          : "El torneo está pausado"}
                      </div>
                    </div>
                    <Button
                      onClick={toggleTournamentStatus}
                      disabled={isPending}
                      variant={tournament.isActive ? "outline" : "default"}
                    >
                      <Power className="w-4 h-4 mr-2" />
                      {tournament.isActive ? "Desactivar" : "Activar"}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                    <div>
                      <div className="font-medium text-red-900">Eliminar torneo</div>
                      <div className="text-sm text-red-700">
                        Esta acción es irreversible y eliminará todos los datos asociados
                      </div>
                    </div>
                    <Button
                      onClick={deleteTournament}
                      disabled={isPending || tournament.isActive}
                      variant="destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </Button>
                  </div>

                  {tournament.isActive && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 text-yellow-800">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">Torneo activo</span>
                      </div>
                      <p className="text-sm text-yellow-700 mt-1">
                        Desactiva el torneo antes de eliminarlo para evitar pérdida accidental de datos.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
