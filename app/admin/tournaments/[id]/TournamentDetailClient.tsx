// app/admin/tournaments/[id]/TournamentDetailClient.tsx - CON CONFIGURACIÓN DE COMODINES
"use client";

import { useState, useTransition } from "react";
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
  Zap, // Para comodines
} from "lucide-react";
import TournamentPlayersManager from "./TournamentPlayersManager";
import GroupManagementPanel from "@/components/GroupManagementPanel";
import ComodinSettings from "@/components/admin/ComodinSettings";

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
  tournament: SerializedTournament;
  rounds: SerializedRound[];
  players: SerializedPlayer[];
  stats: Stats;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Pestañas principales - AGREGAMOS "comodines"
  type TabId = "overview" | "rounds" | "players" | "comodines" | "settings";
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // Ronda seleccionada para gestión
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(
    rounds.find(r => !r.isClosed)?.id || rounds[0]?.id || null
  );

  const selectedRound = rounds.find(r => r.id === selectedRoundId);
  const currentRound = rounds.find(r => !r.isClosed) || rounds[rounds.length - 1];

  const handlePlayersUpdated = () => {
    router.refresh();
  };

  const toggleTournamentStatus = () => {
    const action = tournament.isActive ? 'desactivar' : 'activar';
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
    if (!confirm('¿SEGURO que quieres eliminar este torneo? Esta acción es irreversible.')) return;
    
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournament.id}`, { 
          method: "DELETE" 
        });
        
        if (res.ok) {
          router.push('/admin/tournaments');
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

  // Formatear fechas
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const getRoundStatus = (round: SerializedRound) => {
    if (round.isClosed) return { label: "Cerrada", variant: "secondary" as const };
    
    const now = new Date();
    const start = new Date(round.startDate);
    const end = new Date(round.endDate);
    
    if (now >= start && now <= end) return { label: "En curso", variant: "default" as const };
    if (now < start) return { label: "Próxima", variant: "outline" as const };
    return { label: "Fuera de plazo", variant: "destructive" as const };
  };

  return (
    <div className="space-y-6">
      {/* Header con estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{stats.totalPlayers}</div>
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
                <div className="text-2xl font-bold">{stats.activeRounds}</div>
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
                <div className="text-2xl font-bold">{Math.round(stats.completionPercentage)}%</div>
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
                <div className="text-2xl font-bold">{stats.pendingMatches}</div>
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
            {/* ACTUALIZADO: Agregamos pestaña de comodines */}
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Resumen</TabsTrigger>
              <TabsTrigger value="rounds">Rondas</TabsTrigger>
              <TabsTrigger value="players">Jugadores</TabsTrigger>
              <TabsTrigger value="comodines">Comodines</TabsTrigger>
              <TabsTrigger value="settings">Configuración</TabsTrigger>
            </TabsList>

            {/* ===================== PESTAÑA: RESUMEN ===================== */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {currentRound && (
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
                        <div className="font-medium">{getRoundStatus(currentRound).label}</div>
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
                        <div className="font-medium text-orange-600">{currentRound.pendingMatches}</div>
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
                      <div className="font-medium">{formatDate(tournament.startDate)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Fin:</span>
                      <div className="font-medium">{formatDate(tournament.endDate)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Total rondas:</span>
                      <div className="font-medium">{tournament.totalRounds}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Días por ronda:</span>
                      <div className="font-medium">{tournament.roundDurationDays}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Visibilidad:</span>
                      <div className="font-medium">{tournament.isPublic ? "Público" : "Privado"}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Progreso total:</span>
                      <div className="font-medium">{stats.confirmedMatches} / {stats.totalMatches} partidos</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* =================== PESTAÑA: RONDAS =================== */}
            <TabsContent value="rounds" className="space-y-6 mt-6">
              {/* Selector de ronda */}
              <Card>
                <CardHeader>
                  <CardTitle>Seleccionar Ronda para Gestionar</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {rounds.map((round) => {
                      const status = getRoundStatus(round);
                      return (
                        <Button
                          key={round.id}
                          variant={round.id === selectedRoundId ? "default" : "outline"}
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
                    })}
                  </div>

                  {selectedRound && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Ronda {selectedRound.number}</h4>
                        <Button size="sm" asChild>
                          <Link href={`/admin/rounds/${selectedRound.id}`}>
                            Abrir Vista Completa
                          </Link>
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Fechas:</span>
                          <div>{formatDate(selectedRound.startDate)} - {formatDate(selectedRound.endDate)}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Grupos:</span>
                          <div className="font-medium">{selectedRound.groupsCount}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Jugadores:</span>
                          <div className="font-medium">{selectedRound.playersCount}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Pendientes:</span>
                          <div className="font-medium text-orange-600">{selectedRound.pendingMatches}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Panel de gestión de grupos de la ronda seleccionada */}
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

              {/* Lista completa de rondas */}
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
                        {rounds.map((round) => {
                          const status = getRoundStatus(round);
                          return (
                            <tr key={round.id} className="hover:bg-gray-50">
                              <td className="px-3 py-3 font-medium">#{round.number}</td>
                              <td className="px-3 py-3 text-xs">
                                {formatDate(round.startDate)} - {formatDate(round.endDate)}
                              </td>
                              <td className="px-3 py-3">
                                <Badge variant={status.variant} className="text-xs">
                                  {status.label}
                                </Badge>
                              </td>
                              <td className="px-3 py-3 text-center">{round.groupsCount}</td>
                              <td className="px-3 py-3 text-center">{round.matchesCount}</td>
                              <td className="px-3 py-3 text-center">
                                <span className={round.pendingMatches > 0 ? "text-orange-600 font-medium" : ""}>
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
                        })}
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
                currentPlayers={players}
                onPlayersUpdated={handlePlayersUpdated}
              />
            </TabsContent>

            {/* =================== PESTAÑA: COMODINES =================== */}
            <TabsContent value="comodines" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Configuración de comodines */}
                <div>
                  <ComodinSettings
                    tournamentId={tournament.id}
                    tournamentName={tournament.title}
                  />
                </div>
                
                {/* Vista rápida por ronda */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      Comodines por Ronda
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {rounds.map((round) => (
                        <div key={round.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div>
                            <div className="font-medium">Ronda {round.number}</div>
                            <div className="text-sm text-gray-600">
                              {formatDate(round.startDate)} - {formatDate(round.endDate)}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={getRoundStatus(round).variant} className="mb-1">
                              {getRoundStatus(round).label}
                            </Badge>
                            <div className="text-xs text-gray-500">
                              {round.playersCount} jugadores
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="ml-3"
                          >
                            <Link href={`/admin/rounds/${round.id}/comodines`}>
                              Ver Comodines
                            </Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
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
                      <h4 className="font-medium mb-2">Comodín de Sustituto</h4>
                      <ul className="space-y-1 text-xs">
                        <li>• Otro jugador de grupo inferior juega por ti</li>
                        <li>• Los puntos se asignan al titular</li>
                        <li>• El sustituto recibe crédito Ironman proporcional</li>
                        <li>• Revocable hasta 24h antes del partido</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                        {tournament.isActive ? 'El torneo está activo y visible' : 'El torneo está pausado'}
                      </div>
                    </div>
                    <Button
                      onClick={toggleTournamentStatus}
                      disabled={isPending}
                      variant={tournament.isActive ? "outline" : "default"}
                    >
                      <Power className="w-4 h-4 mr-2" />
                      {tournament.isActive ? 'Desactivar' : 'Activar'}
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