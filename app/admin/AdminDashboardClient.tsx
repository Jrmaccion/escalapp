// app/admin/AdminDashboardClient.tsx - COMPLETO CON TODAS LAS FUNCIONALIDADES
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Trophy,
  CheckCircle,
  Clock,
  Play,
  ChevronDown,
  ChevronUp,
  Zap,
  Settings,
  Key,
  RefreshCw,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import TournamentOverviewCard from "@/components/dashboard/TournamentOverviewCard";

// 🔍 MANTENER: Componente auxiliar AdminTournamentOverview (backup si TournamentOverviewCard falla)
function AdminTournamentOverview({ 
  tournamentId, 
  currentRound 
}: { 
  tournamentId: string; 
  currentRound: SerializedRound;
}) {
  const [groupsData, setGroupsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGroupsData() {
      try {
        setLoading(true);
        setError(null);

        // Usar el endpoint de overview del torneo
        const res = await fetch(`/api/tournaments/${tournamentId}/overview`);
        
        if (!res.ok) {
          throw new Error(`Error ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        setGroupsData(data);
      } catch (err) {
        console.error("Error cargando vista de grupos:", err);
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    }

    if (tournamentId) {
      fetchGroupsData();
    }
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Cargando grupos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Error al cargar los grupos: {error}</p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </Button>
      </div>
    );
  }

  if (!groupsData?.groups || groupsData.groups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay grupos disponibles en esta ronda.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estadísticas generales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{groupsData.groups.length}</div>
          <div className="text-xs text-muted-foreground">Grupos</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{groupsData.totalPlayers || 0}</div>
          <div className="text-xs text-muted-foreground">Jugadores</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {groupsData.completionPercentage || 0}%
          </div>
          <div className="text-xs text-muted-foreground">Completado</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            Ronda {currentRound.number}
          </div>
          <div className="text-xs text-muted-foreground">Actual</div>
        </div>
      </div>

      {/* Grid de grupos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupsData.groups.map((group: any) => (
          <Card key={group.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Grupo {group.number}</CardTitle>
                  {group.level && (
                    <Badge variant="outline" className="text-xs">
                      {group.level}
                    </Badge>
                  )}
                </div>
                <Badge variant={group.setsCompleted === group.totalSets ? "default" : "secondary"}>
                  {group.setsCompleted}/{group.totalSets} sets
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {group.members?.map((member: any, idx: number) => (
                  <div
                    key={member.playerId}
                    className={`flex items-center justify-between p-2 rounded-lg border ${
                      member.position === 1
                        ? "bg-green-50 border-green-200"
                        : member.position === 4
                        ? "bg-red-50 border-red-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          member.position === 1
                            ? "bg-green-200 text-green-800"
                            : member.position === 4
                            ? "bg-red-200 text-red-800"
                            : "bg-gray-200 text-gray-800"
                        }`}
                      >
                        {member.position}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{member.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {member.points?.toFixed(1) || "0.0"} pts
                        </div>
                      </div>
                    </div>
                    {member.movement === "up" && (
                      <ChevronUp className="w-4 h-4 text-green-600" />
                    )}
                    {member.movement === "down" && (
                      <ChevronDown className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                ))}
              </div>

              {/* Botón para ir al detalle del grupo */}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                asChild
              >
                <Link href={`/grupo/${group.id}`}>
                  Ver detalles
                  <ChevronDown className="w-3 h-3 ml-2 rotate-[-90deg]" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-200 rounded-full" />
          <span>Sube de grupo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 rounded-full" />
          <span>Se mantiene</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-200 rounded-full" />
          <span>Baja de grupo</span>
        </div>
      </div>
    </div>
  );
}

type SerializedTournament = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  totalRounds: number;
  roundDurationDays: number;
  isActive: boolean;
};

type SerializedRound = {
  id: string;
  number: number;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  groupsCount: number;
  matchesCount: number;
  pendingMatches: number;
};

type Stats = {
  totalPlayers: number;
  totalRounds: number;
  activeRounds: number;
  totalMatches: number;
  pendingMatches: number;
  confirmedMatches: number;
  comodinesUsados: number;
  suplentesActivos: number;
  revocables: number;
  mediaUsados: number;
};

type AdminDashboardClientProps = {
  tournaments: SerializedTournament[];
  rounds: SerializedRound[];
  stats: Stats;
  defaultTournamentId?: string;
};

export default function AdminDashboardClient({
  tournaments,
  rounds,
  stats,
  defaultTournamentId,
}: AdminDashboardClientProps) {
  const router = useRouter();
  
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    defaultTournamentId || tournaments[0]?.id || ""
  );
  
  const [selectedStats, setSelectedStats] = useState<Stats>(stats);
  const [loadingStats, setLoadingStats] = useState(false);

  // Estado para recalcular puntos
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);
  const [recalcError, setRecalcError] = useState<string | null>(null);

  // 🆕 Estado para la vista global de grupos
  const [showGroupsOverview, setShowGroupsOverview] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const selectedTournament = useMemo(
    () => tournaments.find(t => t.id === selectedTournamentId),
    [tournaments, selectedTournamentId]
  );

  const selectedRounds = useMemo(
    () => rounds.filter(r => r.groupsCount > 0),
    [rounds]
  );

  const currentRound = useMemo(
    () => selectedRounds?.find((r) => !r.isClosed) || selectedRounds?.[selectedRounds.length - 1],
    [selectedRounds]
  );

  const completionPercentage = useMemo(
    () => selectedStats.totalMatches > 0
      ? Math.round((selectedStats.confirmedMatches / selectedStats.totalMatches) * 100)
      : 0,
    [selectedStats]
  );

  const loadTournamentStats = async (tournamentId: string) => {
    if (tournamentId === defaultTournamentId) {
      setSelectedStats(stats);
      return;
    }

    setLoadingStats(true);
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/stats`);
      if (response.ok) {
        const tournamentStats = await response.json();
        setSelectedStats(tournamentStats);
      }
    } catch (error) {
      console.error("Error loading tournament stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Acción: Recalcular puntos de la ronda actual
  const handleRecalculatePoints = async () => {
    if (!currentRound?.id) return;
    const ok = window.confirm(
      "¿Recalcular puntos de la ronda actual? Esto recomputa puntuaciones, rachas y clasificaciones."
    );
    if (!ok) return;

    setIsRecalculating(true);
    setRecalcMessage(null);
    setRecalcError(null);

    try {
      const res = await fetch("/api/admin/recalculate-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: currentRound.id }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Fallo al recalcular (HTTP ${res.status})`);
      }

      setRecalcMessage("Puntos recalculados correctamente.");
      await loadTournamentStats(selectedTournamentId);
      setRefreshTrigger(prev => prev + 1); // 🔄 Forzar refresh del overview
      router.refresh();
    } catch (e: any) {
      console.error("Recalcular puntos error:", e);
      setRecalcError(e?.message || "Error al recalcular puntos.");
    } finally {
      setIsRecalculating(false);
      setTimeout(() => {
        setRecalcMessage(null);
        setRecalcError(null);
      }, 3000);
    }
  };

  useEffect(() => {
    if (selectedTournamentId) {
      loadTournamentStats(selectedTournamentId);
    }
  }, [selectedTournamentId]);

  useEffect(() => {
    if (selectedTournamentId) {
      localStorage.setItem('admin-selected-tournament', selectedTournamentId);
    }
  }, [selectedTournamentId]);

  useEffect(() => {
    const saved = localStorage.getItem('admin-selected-tournament');
    if (saved && tournaments.find(t => t.id === saved)) {
      setSelectedTournamentId(saved);
    }
  }, [tournaments]);

  if (!selectedTournament) {
    return (
      <div className="min-h-screen bg-background py-10">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center py-20">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">No hay torneos disponibles</h1>
            <p className="text-gray-600 mb-6">Crea un torneo para comenzar a gestionar.</p>
            <Button asChild>
              <Link href="/admin/tournaments/create">Crear Torneo</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="container mx-auto px-4 max-w-7xl">
        
        {/* Header con selector de torneo */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-foreground">Dashboard Admin</h1>
              <p className="text-muted-foreground">
                Gestión completa de torneos y comodines
              </p>
            </div>

            {/* Selector de torneo */}
            {tournaments.length > 1 && (
              <div className="min-w-[280px]">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Torneo seleccionado
                </label>
                <div className="relative">
                  <select
                    value={selectedTournamentId}
                    onChange={(e) => setSelectedTournamentId(e.target.value)}
                    className="w-full appearance-none bg-background border border-border rounded-lg px-4 py-2 pr-10 text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    {tournaments.map((tournament) => (
                      <option key={tournament.id} value={tournament.id}>
                        {tournament.title} {tournament.isActive && "(Activo)"}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Info del torneo seleccionado */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span>
              {format(new Date(selectedTournament.startDate), "d MMM yyyy", { locale: es })} 
              – 
              {format(new Date(selectedTournament.endDate), "d MMM yyyy", { locale: es })}
            </span>
            <Badge variant={selectedTournament.isActive ? "default" : "secondary"}>
              {selectedTournament.isActive ? "Activo" : "Inactivo"}
            </Badge>
            {loadingStats && (
              <Badge variant="outline" className="animate-pulse">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Cargando stats...
              </Badge>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-card text-card-foreground p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Jugadores</h3>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{selectedStats.totalPlayers}</div>
            <p className="text-xs text-muted-foreground">Participantes activos</p>
          </div>

          <div className="bg-card text-card-foreground p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Rondas</h3>
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{selectedStats.activeRounds}</div>
            <p className="text-xs text-muted-foreground">de {selectedStats.totalRounds} activas</p>
          </div>

          <div className="bg-card text-card-foreground p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Pendientes</h3>
              <Clock className="h-4 w-4 text-accent" />
            </div>
            <div className="text-2xl font-bold">{selectedStats.pendingMatches}</div>
            <p className="text-xs text-muted-foreground">resultados por validar</p>
          </div>

          <div className="bg-card text-card-foreground p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Progreso</h3>
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{completionPercentage}%</div>
            <p className="text-xs text-muted-foreground">
              {selectedStats.confirmedMatches} de {selectedStats.totalMatches} partidos
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link
            href="/admin/results"
            className="block p-4 bg-primary/5 hover:bg-primary/10 rounded-lg border border-primary/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-primary" />
              <div>
                <div className="font-semibold text-foreground">Validar Resultados</div>
                <div className="text-sm text-primary">{selectedStats.pendingMatches} pendientes</div>
              </div>
            </div>
          </Link>

          {currentRound && (
            <Link
              href={`/admin/tournaments/${selectedTournament.id}?tab=comodines`}
              className="block p-4 bg-accent/5 hover:bg-accent/10 rounded-lg border border-accent/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-accent" />
                <div>
                  <div className="font-semibold text-foreground">Configurar Comodines</div>
                  <div className="text-sm text-accent">
                    {selectedStats.comodinesUsados} comodines activos
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* 🆕 VISTA GLOBAL DE GRUPOS - Usando TournamentOverviewCard DIRECTAMENTE */}
        {selectedTournament && selectedTournament.isActive && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Vista Global de Grupos
                  </CardTitle>
                  <CardDescription>
                    Estado actual de todos los grupos del torneo
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGroupsOverview(!showGroupsOverview)}
                >
                  {showGroupsOverview ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-2" />
                      Ocultar
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-2" />
                      Mostrar todos los grupos
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            {showGroupsOverview && (
              <CardContent className="pt-6">
                <TournamentOverviewCard 
                  tournamentId={selectedTournament.id}
                  compact={false}
                  showOnlyUserGroup={false}
                  refreshTrigger={refreshTrigger}
                />
              </CardContent>
            )}
          </Card>
        )}

        {/* Ronda actual */}
        {currentRound && (
          <div className="bg-card text-card-foreground p-6 rounded-lg shadow border mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Ronda Actual - {selectedTournament.title}
            </h2>
            <div className="space-y-4">
              <div>
                <div className="text-2xl font-bold">Ronda {currentRound.number}</div>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  currentRound.isClosed
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary/10 text-primary border border-primary/20"
                }`}>
                  {currentRound.isClosed ? "Cerrada" : "Activa"}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Grupos</div>
                  <div className="font-bold">{currentRound.groupsCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Partidos</div>
                  <div className="font-bold">{currentRound.matchesCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Pendientes</div>
                  <div className="font-bold text-orange-600">{currentRound.pendingMatches}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Comodines</div>
                  <div className="font-bold text-blue-600">{selectedStats.comodinesUsados}</div>
                </div>
              </div>

              {/* Mensajes de recálculo */}
              {(recalcMessage || recalcError) && (
                <div
                  className={`mt-2 text-sm rounded-md border px-3 py-2 ${
                    recalcError
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-green-200 bg-green-50 text-green-700"
                  }`}
                >
                  {recalcError || recalcMessage}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-4">
                <Button asChild>
                  <Link href={`/admin/rounds/${currentRound.id}`}>
                    Gestionar Ronda
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/admin/rounds/${currentRound.id}/comodines`}>
                    Gestionar Comodines
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/admin/tournaments/${selectedTournament.id}`}>
                    Configurar Torneo
                  </Link>
                </Button>
                {/* Acción: Recalcular puntos de la ronda */}
                <Button
                  size="sm"
                  variant="default"
                  className="flex items-center gap-2"
                  onClick={handleRecalculatePoints}
                  disabled={isRecalculating || !currentRound?.id}
                  title="Recalcular puntos, rachas y clasificaciones de la ronda"
                >
                  <RefreshCw className={`w-4 h-4 ${isRecalculating ? "animate-spin" : ""}`} />
                  {isRecalculating ? "Recalculando..." : "Recalcular Puntos"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Gestión avanzada del torneo seleccionado */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel principal de gestión */}
          <div className="bg-card text-card-foreground rounded-lg shadow border">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Gestión Rápida
              </h3>
            </div>
            <div className="p-6 space-y-3">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/admin/tournaments/${selectedTournament.id}`}>
                  <Trophy className="w-4 h-4 mr-2" />
                  Configurar Torneo
                </Link>
              </Button>
              
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/admin/tournaments/${selectedTournament.id}?tab=players`}>
                  <Users className="w-4 h-4 mr-2" />
                  Gestionar Jugadores
                </Link>
              </Button>

              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/admin/tournaments/${selectedTournament.id}?tab=comodines`}>
                  <Zap className="w-4 h-4 mr-2" />
                  Configurar Comodines
                </Link>
              </Button>

              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/admin/users">
                  <Key className="w-4 h-4 mr-2" />
                  Gestionar Usuarios
                </Link>
              </Button>
            </div>
          </div>

          {/* Panel de stats de comodines */}
          <div className="bg-card text-card-foreground rounded-lg shadow border">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-medium text-foreground">Estado Comodines</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">{selectedStats.comodinesUsados}</div>
                  <div className="text-muted-foreground">Activos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{selectedStats.suplentesActivos}</div>
                  <div className="text-muted-foreground">Sustitutos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{selectedStats.revocables}</div>
                  <div className="text-muted-foreground">Revocables</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{selectedStats.mediaUsados}</div>
                  <div className="text-muted-foreground">Media</div>
                </div>
              </div>

              {currentRound && (
                <div className="mt-4 space-y-2">
                  <Button size="sm" className="w-full" asChild>
                    <Link href={`/admin/rounds/${currentRound.id}/comodines`}>
                      Gestionar por Ronda
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" className="w-full" asChild>
                    <Link href={`/admin/tournaments/${selectedTournament.id}?tab=comodines`}>
                      Configurar Torneo
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Panel de acciones rápidas por ronda */}
          {currentRound && (
            <div className="bg-card text-card-foreground rounded-lg shadow border">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-medium text-foreground">
                  Ronda {currentRound.number}
                </h3>
              </div>
              <div className="p-6 space-y-3">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estado:</span>
                    <Badge variant={currentRound.isClosed ? "secondary" : "default"}>
                      {currentRound.isClosed ? "Cerrada" : "Activa"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Progreso:</span>
                    <span className="font-medium">
                      {currentRound.matchesCount - currentRound.pendingMatches}/{currentRound.matchesCount}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t space-y-2">
                  <Button size="sm" variant="outline" className="w-full" asChild>
                    <Link href={`/admin/rounds/${currentRound.id}`}>
                      <Calendar className="w-4 h-4 mr-2" />
                      Gestionar Grupos
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" className="w-full" asChild>
                    <Link href="/admin/results">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Validar Resultados
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    className="w-full flex items-center gap-2"
                    onClick={handleRecalculatePoints}
                    disabled={isRecalculating || !currentRound?.id}
                    title="Recalcular puntos, rachas y clasificaciones de la ronda"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRecalculating ? "animate-spin" : ""}`} />
                    {isRecalculating ? "Recalculando..." : "Recalcular Puntos"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}