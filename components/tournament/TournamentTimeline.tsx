// components/tournament/TournamentTimeline.tsx - ACTUALIZADO CON NUEVA LÓGICA
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Star, 
  UserX,
  Medal,
  Calendar,
  Users,
  Activity,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Target,
  Award,
  Crown,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Movement = "up" | "down" | "stay" | "new" | "absent" | "up2" | "down2";

type RoundDTO = { 
  number: number; 
  startDate: string; 
  endDate: string; 
  isClosed: boolean;
  matchesTotal?: number;
  matchesCompleted?: number;
};

type PlayerHistoryPoint = { 
  round: number; 
  group: number | null; 
  movement: Movement;
  points?: number;
  position?: number;
};

type PlayerDTO = { 
  playerId: string; 
  name: string; 
  history: PlayerHistoryPoint[];
  totalPoints?: number;
  averagePoints?: number;
  totalRoundsPlayed?: number;
  currentStreak?: number;
  bestGroup?: number;
};

type GroupStats = {
  number: number;
  players: number;
  avgPoints?: number;
  level: "premium" | "intermediate" | "starter";
};

type TimelineAPI = { 
  rounds: RoundDTO[]; 
  players: PlayerDTO[];
  groupStats?: GroupStats[];
  tournamentStats?: {
    totalPlayers: number;
    activeRounds: number;
    completionRate: number;
  };
};

type Props = { tournamentId: string };

// ESTILOS ACTUALIZADOS CON NUEVA LÓGICA DE MOVIMIENTOS
const MOVE_STYLES: Record<Movement, { 
  bg: string; 
  text: string; 
  border: string;
  icon: React.ComponentType<{ className?: string }>; 
  label: string;
  chip: string;
  description: string;
}> = {
  up2: { 
    bg: "bg-emerald-50", 
    text: "text-emerald-700", 
    border: "border-emerald-200",
    icon: ChevronsUp, 
    label: "Sube 2", 
    chip: "⏫",
    description: "1° lugar - Sube 2 grupos"
  },
  up: { 
    bg: "bg-green-50", 
    text: "text-green-700", 
    border: "border-green-200",
    icon: ArrowUp, 
    label: "Sube 1", 
    chip: "⬆️",
    description: "2° lugar - Sube 1 grupo"
  },
  stay: { 
    bg: "bg-blue-50", 
    text: "text-blue-700", 
    border: "border-blue-200",
    icon: Minus, 
    label: "Mantiene", 
    chip: "➡️",
    description: "Permanece en el mismo grupo"
  },
  down: { 
    bg: "bg-orange-50", 
    text: "text-orange-700", 
    border: "border-orange-200",
    icon: ArrowDown, 
    label: "Baja 1", 
    chip: "⬇️",
    description: "3° lugar - Baja 1 grupo"
  },
  down2: { 
    bg: "bg-rose-50", 
    text: "text-rose-700", 
    border: "border-rose-200",
    icon: ChevronsDown, 
    label: "Baja 2", 
    chip: "⏬",
    description: "4° lugar - Baja 2 grupos"
  },
  new: { 
    bg: "bg-amber-50", 
    text: "text-amber-700", 
    border: "border-amber-200",
    icon: Star, 
    label: "Nuevo", 
    chip: "⭐",
    description: "Nuevo jugador en el torneo"
  },
  absent: { 
    bg: "bg-slate-50", 
    text: "text-slate-500", 
    border: "border-slate-200",
    icon: UserX, 
    label: "Ausente", 
    chip: "⚫",
    description: "No participó en esta ronda"
  },
};

const GROUP_LEVELS = {
  1: { name: "Elite", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Crown },
  2: { name: "Avanzado", color: "bg-blue-100 text-blue-800 border-blue-300", icon: Medal },
  3: { name: "Intermedio", color: "bg-green-100 text-green-800 border-green-300", icon: Target },
  4: { name: "Desarrollo", color: "bg-purple-100 text-purple-800 border-purple-300", icon: Award },
};

// FUNCIÓN AUXILIAR PARA DETERMINAR MOVIMIENTO BASADO EN POSICIÓN
const getMovementFromPosition = (position: number | undefined): Movement => {
  switch (position) {
    case 1: return "up2"; // 1° lugar sube 2
    case 2: return "up";  // 2° lugar sube 1
    case 3: return "down"; // 3° lugar baja 1
    case 4: return "down2"; // 4° lugar baja 2
    default: return "stay"; // Sin posición definida
  }
};

export default function TournamentTimeline({ tournamentId }: Props) {
  const [data, setData] = useState<TimelineAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<number | "all">("all");
  const [movementFilter, setMovementFilter] = useState<Movement | "all">("all");
  const [roundRange, setRoundRange] = useState<[number, number] | null>(null);
  const [viewMode, setViewMode] = useState<"compact" | "detailed">("detailed");

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/tournaments/${tournamentId}/timeline`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) {
          throw new Error(`Error ${res.status}: ${res.statusText}`);
        }
        const json: TimelineAPI = await res.json();
        
        // PROCESAR DATOS PARA CORREGIR MOVIMIENTOS BASADOS EN POSICIÓN
        const processedPlayers = json.players.map(player => ({
          ...player,
          history: player.history.map(point => ({
            ...point,
            movement: point.position 
              ? getMovementFromPosition(point.position)
              : (point.movement as Movement)
          }))
        }));
        
        setData({
          ...json,
          players: processedPlayers
        });
        
        // Establecer rango inicial de rondas (últimas 5 o todas si hay menos)
        if (json.rounds.length > 0) {
          const start = Math.max(1, json.rounds.length - 4);
          const end = json.rounds.length;
          setRoundRange([start, end]);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e.message || "Error cargando datos");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [tournamentId]);

  const visibleRounds = useMemo(() => {
    if (!data || !roundRange) return data?.rounds || [];
    return data.rounds.filter(r => r.number >= roundRange[0] && r.number <= roundRange[1]);
  }, [data, roundRange]);

  const lastRound = data?.rounds.length ? data.rounds[data.rounds.length - 1].number : 1;

  const ranking = useMemo(() => {
    if (!data) return [];
    return data.players
      .map((p) => {
        const last = p.history.find((h) => h.round === lastRound);
        const movement = last?.position 
          ? getMovementFromPosition(last.position)
          : (last?.movement ?? "absent") as Movement;
          
        return {
          playerId: p.playerId,
          name: p.name,
          group: last?.group ?? null,
          movement,
          points: last?.points ?? 0,
          position: last?.position,
          totalPoints: p.totalPoints ?? 0,
          averagePoints: p.averagePoints ?? 0,
          roundsPlayed: p.totalRoundsPlayed ?? 0,
          streak: p.currentStreak ?? 0,
          bestGroup: p.bestGroup ?? null,
        };
      })
      .sort((a, b) => {
        const ag = a.group ?? 9999, bg = b.group ?? 9999;
        if (ag !== bg) return ag - bg;
        if (a.position && b.position) return a.position - b.position;
        return b.averagePoints - a.averagePoints;
      });
  }, [data, lastRound]);

  const groupsAvailable = useMemo<number[]>(() => {
    const set = new Set<number>();
    ranking.forEach((r) => { if (typeof r.group === "number") set.add(r.group); });
    return [...set].sort((a, b) => a - b);
  }, [ranking]);

  const filteredPlayers = useMemo(() => {
    if (!data) return [];
    
    let filtered = data.players;

    // Filtro por nombre
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filtro por grupo (basado en última ronda)
    if (groupFilter !== "all") {
      const groupPlayerIds = new Set(
        ranking.filter(r => r.group === groupFilter).map(r => r.playerId)
      );
      filtered = filtered.filter(p => groupPlayerIds.has(p.playerId));
    }

    // Filtro por movimiento
    if (movementFilter !== "all") {
      const movePlayerIds = new Set(
        ranking.filter(r => r.movement === movementFilter).map(r => r.playerId)
      );
      filtered = filtered.filter(p => movePlayerIds.has(p.playerId));
    }

    return filtered.sort((a, b) => {
      const aRank = ranking.find(r => r.playerId === a.playerId);
      const bRank = ranking.find(r => r.playerId === b.playerId);
      
      const aGroup = aRank?.group ?? 9999;
      const bGroup = bRank?.group ?? 9999;
      
      if (aGroup !== bGroup) return aGroup - bGroup;
      return (aRank?.averagePoints ?? 0) > (bRank?.averagePoints ?? 0) ? -1 : 1;
    });
  }, [data, searchQuery, groupFilter, movementFilter, ranking]);

  const adjustRoundRange = (direction: "prev" | "next") => {
    if (!data || !roundRange) return;
    
    const [start, end] = roundRange;
    const windowSize = end - start + 1;
    
    if (direction === "prev" && start > 1) {
      const newStart = Math.max(1, start - 1);
      setRoundRange([newStart, newStart + windowSize - 1]);
    } else if (direction === "next" && end < data.rounds.length) {
      const newEnd = Math.min(data.rounds.length, end + 1);
      setRoundRange([newEnd - windowSize + 1, newEnd]);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-sm border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Estado del torneo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-muted-foreground">Cargando datos del torneo...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-sm border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700">Error al cargar datos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 text-sm">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Estado del torneo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No hay datos disponibles.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Stats generales */}
      {data.tournamentStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <Card className="border-0 shadow-sm w-full">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Jugadores</p>
                  <p className="text-2xl font-bold">{data.tournamentStats.totalPlayers}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Rondas Activas</p>
                  <p className="text-2xl font-bold">{data.tournamentStats.activeRounds}</p>
                </div>
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Progreso</p>
                  <p className="text-2xl font-bold">{Math.round(data.tournamentStats.completionRate)}%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* NUEVA SECCIÓN: Explicación del sistema de escalera */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <Trophy className="h-5 w-5" />
            Sistema de Escalera
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2 p-2 bg-emerald-100 rounded border border-emerald-200">
              <ChevronsUp className="h-4 w-4 text-emerald-700" />
              <span className="font-medium text-emerald-800">1° → Sube 2 grupos</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-green-100 rounded border border-green-200">
              <ArrowUp className="h-4 w-4 text-green-700" />
              <span className="font-medium text-green-800">2° → Sube 1 grupo</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-orange-100 rounded border border-orange-200">
              <ArrowDown className="h-4 w-4 text-orange-700" />
              <span className="font-medium text-orange-800">3° → Baja 1 grupo</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-rose-100 rounded border border-rose-200">
              <ChevronsDown className="h-4 w-4 text-rose-700" />
              <span className="font-medium text-rose-800">4° → Baja 2 grupos</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="board" className="w-full max-w-none">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="board" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Clasificación
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Movimientos
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Estadísticas
          </TabsTrigger>
        </TabsList>

        {/* Clasificación mejorada */}
        <TabsContent value="board" className="mt-6 w-full max-w-none">
          <Card className="shadow-sm border-0 w-full max-w-none">
            <CardHeader className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                    Clasificación Actual
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ronda {lastRound} • Por grupo y posición
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar jugador..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full md:w-64"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <select
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="all">Todos los grupos</option>
                      {groupsAvailable.map((g) => (
                        <option key={g} value={g}>Grupo {g}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Leyenda de movimientos actualizada */}
              <div className="flex flex-wrap gap-2">
                {(Object.entries(MOVE_STYLES) as [Movement, typeof MOVE_STYLES[Movement]][]).map(([move, style]) => {
                  const Icon = style.icon;
                  return (
                    <div 
                      key={move} 
                      className={cn("flex items-center gap-1 px-2 py-1 rounded text-xs", style.bg, style.text)}
                      title={style.description}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{style.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-6">
                {groupsAvailable.map((groupNum) => {
                  const groupPlayers = ranking.filter(r => r.group === groupNum);
                  const level = GROUP_LEVELS[groupNum as keyof typeof GROUP_LEVELS] || GROUP_LEVELS[4];
                  const GroupIcon = level.icon;

                  if (groupFilter !== "all" && groupFilter !== groupNum) return null;
                  if (groupPlayers.length === 0) return null;

                  return (
                    <div key={groupNum} className="space-y-3">
                      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", level.color)}>
                        <GroupIcon className="h-5 w-5" />
                        <h3 className="font-semibold">Grupo {groupNum} - {level.name}</h3>
                        <span className="text-xs opacity-75">{groupPlayers.length} jugadores</span>
                      </div>

                      <div className="grid gap-2">
                        {groupPlayers
                          .filter(p => searchQuery ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)
                          .map((player, index) => {
                            const style = MOVE_STYLES[player.movement];
                            const MoveIcon = style.icon;
                            
                            return (
                              <div
                                key={player.playerId}
                                className={cn(
                                  "flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-sm",
                                  style.bg, style.border
                                )}
                              >
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-muted-foreground">
                                      #{index + 1}
                                    </span>
                                    <div className="flex items-center gap-2" title={style.description}>
                                      <MoveIcon className={cn("h-4 w-4", style.text)} />
                                      <span className="text-lg">{style.chip}</span>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <div className="font-semibold">{player.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {player.averagePoints.toFixed(1)} pts/ronda • {player.roundsPlayed} rondas
                                      {player.streak > 0 && (
                                        <span className="ml-2 text-orange-600">
                                          🔥 {player.streak}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className={cn("font-bold", style.text)}>
                                    {player.totalPoints} pts
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {style.label}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}

                {/* Jugadores ausentes */}
                {ranking.filter(r => r.movement === "absent").length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                      <UserX className="h-5 w-5 text-slate-500" />
                      <h3 className="font-semibold text-slate-700">Jugadores Ausentes</h3>
                    </div>
                    <div className="grid gap-2">
                      {ranking
                        .filter(r => r.movement === "absent")
                        .filter(p => searchQuery ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)
                        .map(player => (
                          <div key={player.playerId} className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200 opacity-75">
                            <div className="flex items-center gap-3">
                              <UserX className="h-4 w-4 text-slate-500" />
                              <div>
                                <div className="font-medium text-slate-700">{player.name}</div>
                                <div className="text-xs text-slate-500">No participó en la ronda {lastRound}</div>
                              </div>
                            </div>
                            <div className="text-sm text-slate-500">
                              {player.totalPoints} pts totales
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline con movimientos corregidos */}
        <TabsContent value="timeline" className="mt-6 w-full max-w-none">
          <Card className="shadow-sm border-0 w-full max-w-none">
            <CardHeader className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    Historial de Movimientos
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Seguimiento de progreso por ronda
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar jugador..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full md:w-48"
                    />
                  </div>

                  <select
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">Todos los grupos</option>
                    {groupsAvailable.map((g) => (
                      <option key={g} value={g}>Grupo {g}</option>
                    ))}
                  </select>

                  <select
                    value={movementFilter}
                    onChange={(e) => setMovementFilter(e.target.value as Movement | "all")}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">Todos los movimientos</option>
                    {Object.entries(MOVE_STYLES).map(([move, style]) => (
                      <option key={move} value={move}>{style.label}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                    <Button
                      variant={viewMode === "compact" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("compact")}
                      className="h-8 px-3"
                    >
                      Compacto
                    </Button>
                    <Button
                      variant={viewMode === "detailed" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("detailed")}
                      className="h-8 px-3"
                    >
                      Detallado
                    </Button>
                  </div>
                </div>
              </div>

              {/* Control de navegación de rondas */}
              {data.rounds.length > 5 && (
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => adjustRoundRange("prev")}
                    disabled={!roundRange || roundRange[0] <= 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anteriores
                  </Button>
                  
                  <div className="text-sm text-muted-foreground">
                    Mostrando rondas {roundRange?.[0]} - {roundRange?.[1]} de {data.rounds.length}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => adjustRoundRange("next")}
                    disabled={!roundRange || roundRange[1] >= data.rounds.length}
                  >
                    Siguientes
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <div
                  className="grid w-full min-w-full"
                  style={{
                    gridTemplateColumns: `minmax(240px, 1fr) repeat(${visibleRounds.length}, minmax(${viewMode === "compact" ? "80px" : "120px"}, 1fr))`,
                  }}
                >
                  {/* Cabecera */}
                  <div className="sticky left-0 z-10 bg-background/95 backdrop-blur border-b border-r px-4 py-3 font-semibold">
                    Jugador
                  </div>
                  {visibleRounds.map((round) => (
                    <div key={round.number} className="border-b px-2 py-3 text-center">
                      <div className="font-medium text-sm">R{round.number}</div>
                      {viewMode === "detailed" && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(round.startDate), "dd/MM", { locale: es })}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Filas por jugador */}
                  {filteredPlayers.map((player) => (
                    <React.Fragment key={player.playerId}>
                      {/* Nombre sticky */}
                      <div className="sticky left-0 z-10 bg-background/95 backdrop-blur border-r px-4 py-3 border-b">
                        <div className="font-medium">{player.name}</div>
                        {viewMode === "detailed" && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {player.averagePoints?.toFixed(1)} pts/ronda
                          </div>
                        )}
                      </div>

                      {/* Celdas por ronda */}
                      {visibleRounds.map((round) => {
                        const history = player.history.find(h => h.round === round.number);
                        const movement = history?.position 
                          ? getMovementFromPosition(history.position)
                          : (history?.movement ?? "absent") as Movement;
                        const style = MOVE_STYLES[movement];
                        const MoveIcon = style.icon;
                        
                        return (
                          <div
                            key={`${player.playerId}-${round.number}`}
                            className={cn(
                              "border-r border-b flex flex-col items-center justify-center text-xs transition-all hover:shadow-sm",
                              style.bg, style.text,
                              viewMode === "compact" ? "py-2" : "py-3"
                            )}
                            title={`${player.name} - Ronda ${round.number} - ${style.description}${history?.group ? ` - Grupo ${history.group}` : ""}${history?.points ? ` - ${history.points} pts` : ""}`}
                          >
                            {viewMode === "detailed" ? (
                              <>
                                <MoveIcon className="h-4 w-4 mb-1" />
                                <div className="font-medium">
                                  {history?.group ? `G${history.group}` : "—"}
                                </div>
                                {history?.points !== undefined && (
                                  <div className="text-xs opacity-75">{history.points}p</div>
                                )}
                                {history?.position && (
                                  <div className="text-xs opacity-75 mt-1">#{history.position}</div>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="text-base font-bold">{style.chip}</span>
                                {history?.group && (
                                  <span className="text-xs mt-1">G{history.group}</span>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña de estadísticas actualizada */}
        <TabsContent value="stats" className="mt-6">
          <div className="grid gap-6">
            {/* Estadísticas de movimientos actualizadas */}
            <Card className="shadow-sm border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Resumen de Movimientos - Ronda {lastRound}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Distribución de movimientos según la nueva lógica de escalera
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {(Object.entries(MOVE_STYLES) as [Movement, typeof MOVE_STYLES[Movement]][])
                    .filter(([movement]) => movement !== 'new' && movement !== 'absent') // Solo movimientos activos
                    .map(([movement, style]) => {
                      const count = ranking.filter(p => p.movement === movement).length;
                      const percentage = ranking.length > 0 ? (count / ranking.length * 100) : 0;
                      const Icon = style.icon;

                      return (
                        <div key={movement} className={cn("p-4 rounded-lg border text-center", style.bg, style.border)}>
                          <Icon className={cn("h-6 w-6 mx-auto mb-2", style.text)} />
                          <div className="text-2xl font-bold">{count}</div>
                          <div className={cn("text-sm font-medium", style.text)}>{style.label}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {percentage.toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Explicación del sistema */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-3">Lógica de Movimientos</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                    <div>
                      <p className="font-medium mb-2">Ascensos:</p>
                      <ul className="space-y-1 text-xs">
                        <li className="flex items-center gap-2">
                          <ChevronsUp className="h-3 w-3 text-emerald-600" />
                          <span>1° lugar sube 2 grupos (si es posible)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <ArrowUp className="h-3 w-3 text-green-600" />
                          <span>2° lugar sube 1 grupo</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium mb-2">Descensos:</p>
                      <ul className="space-y-1 text-xs">
                        <li className="flex items-center gap-2">
                          <ArrowDown className="h-3 w-3 text-orange-600" />
                          <span>3° lugar baja 1 grupo</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <ChevronsDown className="h-3 w-3 text-rose-600" />
                          <span>4° lugar baja 2 grupos (si es posible)</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resto de las estadísticas existentes */}
            {data.groupStats && data.groupStats.length > 0 && (
              <Card className="shadow-sm border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                    Estadísticas por Grupo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.groupStats.map((group) => {
                      const level = GROUP_LEVELS[group.number as keyof typeof GROUP_LEVELS] || GROUP_LEVELS[4];
                      const GroupIcon = level.icon;
                      
                      return (
                        <div
                          key={group.number}
                          className={cn("p-4 rounded-lg border", level.color)}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <GroupIcon className="h-5 w-5" />
                            <h3 className="font-semibold">Grupo {group.number}</h3>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Jugadores:</span>
                              <span className="font-medium">{group.players}</span>
                            </div>
                            {group.avgPoints && (
                              <div className="flex justify-between">
                                <span>Promedio pts:</span>
                                <span className="font-medium">{group.avgPoints.toFixed(1)}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span>Nivel:</span>
                              <span className="font-medium">{level.name}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top performers y progreso del torneo (código existente) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                    Mejores Promedios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ranking
                      .filter(p => p.roundsPlayed > 0)
                      .sort((a, b) => b.averagePoints - a.averagePoints)
                      .slice(0, 5)
                      .map((player, index) => (
                        <div key={player.playerId} className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{player.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {player.roundsPlayed} rondas jugadas
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-yellow-600">
                              {player.averagePoints.toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground">pts/ronda</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Medal className="h-5 w-5 text-blue-600" />
                    Más Puntos Totales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ranking
                      .sort((a, b) => b.totalPoints - a.totalPoints)
                      .slice(0, 5)
                      .map((player, index) => (
                        <div key={player.playerId} className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{player.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {player.roundsPlayed} rondas jugadas
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-blue-600">
                              {player.totalPoints}
                            </div>
                            <div className="text-xs text-muted-foreground">pts totales</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Progreso del torneo */}
            <Card className="shadow-sm border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  Progreso del Torneo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.rounds.map((round, index) => {
                    const isLast = index === data.rounds.length - 1;
                    const isCurrent = !round.isClosed && index > 0 ? data.rounds[index - 1].isClosed : !round.isClosed;
                    const completionRate = round.matchesTotal && round.matchesCompleted 
                      ? (round.matchesCompleted / round.matchesTotal * 100) 
                      : round.isClosed ? 100 : 0;

                    return (
                      <div key={round.number} className="flex items-center gap-4">
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold",
                          round.isClosed 
                            ? "bg-green-100 text-green-700" 
                            : isCurrent 
                              ? "bg-blue-100 text-blue-700" 
                              : "bg-gray-100 text-gray-500"
                        )}>
                          {round.number}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">Ronda {round.number}</span>
                            <span className={cn(
                              "text-xs px-2 py-1 rounded",
                              round.isClosed 
                                ? "bg-green-100 text-green-700" 
                                : isCurrent 
                                  ? "bg-blue-100 text-blue-700" 
                                  : "bg-gray-100 text-gray-500"
                            )}>
                              {round.isClosed ? "Completada" : isCurrent ? "En curso" : "Pendiente"}
                            </span>
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(round.startDate), "d MMM", { locale: es })} - {format(new Date(round.endDate), "d MMM yyyy", { locale: es })}
                          </div>
                          
                          {/* Barra de progreso */}
                          <div className="mt-2 bg-gray-200 rounded-full h-2">
                            <div 
                              className={cn(
                                "h-2 rounded-full transition-all",
                                round.isClosed 
                                  ? "bg-green-500" 
                                  : isCurrent 
                                    ? "bg-blue-500" 
                                    : "bg-gray-300"
                              )}
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                          
                          {round.matchesTotal && round.matchesCompleted && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {round.matchesCompleted} / {round.matchesTotal} partidos ({completionRate.toFixed(0)}%)
                            </div>
                          )}
                        </div>

                        {!isLast && (
                          <div className="w-px h-8 bg-border ml-4" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}