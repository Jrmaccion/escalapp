// app/admin/AdminDashboardClient.tsx - OPTIMIZADO con selector de torneo
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Trophy,
  CheckCircle,
  Clock,
  FileText,
  BarChart3,
  Play,
  UserMinus,
  ChevronDown,
  Zap,
  Settings,
  Key
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  tournaments: SerializedTournament[]; // 🔄 Ahora múltiples torneos
  rounds: SerializedRound[];
  stats: Stats;
  defaultTournamentId?: string; // El torneo activo por defecto
};

export default function AdminDashboardClient({
  tournaments,
  rounds,
  stats,
  defaultTournamentId,
}: AdminDashboardClientProps) {
  const router = useRouter();
  
  // 🎯 Estado del torneo seleccionado
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    defaultTournamentId || tournaments[0]?.id || ""
  );
  
  // 📊 Estado para stats dinámicas del torneo seleccionado
  const [selectedStats, setSelectedStats] = useState<Stats>(stats);
  const [loadingStats, setLoadingStats] = useState(false);

  // 🔍 Torneo y rondas filtradas
  const selectedTournament = useMemo(
    () => tournaments.find(t => t.id === selectedTournamentId),
    [tournaments, selectedTournamentId]
  );

  const selectedRounds = useMemo(
    () => rounds.filter(r => r.groupsCount > 0), // Solo rondas con datos
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

  // 📡 Cargar stats específicas del torneo seleccionado
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

  // 🔄 Recargar stats cuando cambia el torneo
  useEffect(() => {
    if (selectedTournamentId) {
      loadTournamentStats(selectedTournamentId);
    }
  }, [selectedTournamentId]);

  // 💾 Persistir selección en localStorage
  useEffect(() => {
    if (selectedTournamentId) {
      localStorage.setItem('admin-selected-tournament', selectedTournamentId);
    }
  }, [selectedTournamentId]);

  // 🏗️ Cargar selección persistida al montar
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
        
        {/* 🎯 Header con selector de torneo */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-foreground">Dashboard Admin</h1>
              <p className="text-muted-foreground">
                Gestión completa de torneos y comodines
              </p>
            </div>

            {/* 🎛️ Selector de torneo (solo si hay múltiples) */}
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

          {/* 📅 Info del torneo seleccionado */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span>
              {format(new Date(selectedTournament.startDate), "d MMM yyyy", { locale: es })} 
              — 
              {format(new Date(selectedTournament.endDate), "d MMM yyyy", { locale: es })}
            </span>
            <Badge variant={selectedTournament.isActive ? "default" : "secondary"}>
              {selectedTournament.isActive ? "Activo" : "Inactivo"}
            </Badge>
            {loadingStats && <Badge variant="outline">Cargando stats...</Badge>}
          </div>
        </div>

        {/* 📊 Stats Cards (ahora dinámicas) */}
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

        {/* 🚀 Quick Actions (ahora dinámicas) */}
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

        {/* 🎮 Ronda actual (ahora dinámica) */}
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
              </div>
            </div>
          </div>
        )}

        {/* 🏆 Gestión avanzada del torneo seleccionado */}
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
                </div>
              </div>
            </div>
          )}
        </div>
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

            {/* ✅ NUEVO: Añadir este botón para gestión de usuarios */}
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/admin/users">
                <Key className="w-4 h-4 mr-2" />
                Gestionar Usuarios
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}