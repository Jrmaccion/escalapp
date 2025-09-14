// app/dashboard/PlayerDashboardClient.tsx - SELECTOR DE TORNEOS TOTALMENTE FUNCIONAL
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EnhancedDashboardSection from "./EnhancedDashboardSection";
import {
  Calendar,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Play,
  ArrowRight,
  Crown,
  Flame,
  ChevronDown,
  ChevronUp,
  Trophy,
  Target,
  Settings,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

/** ===== Tipos de API del Dashboard ===== */
type ApiResponse = {
  activeTournament: {
    id: string;
    title: string;
    currentRound: number;
    totalRounds: number;
    roundEndDate: string;
  } | null;
  availableTournaments?: {
    id: string;
    title: string;
    isActive: boolean;
    isCurrent: boolean;
  }[];
  currentGroup: {
    id: string;
    number: number;
    level?: string | null;
    position: number;
    points: number;
    streak: number;
  } | null;
  ranking: {
    position: number;
    averagePoints: number;
    totalPoints: number;
    roundsPlayed: number;
    ironmanPosition: number;
  } | null;
  stats: {
    matchesPlayed: number;
    matchesPending: number;
    winRate: number;
    currentStreak: number;
    partiesPlayed: number;
    partiesPending: number;
    partyWinRate: number;
    totalPartiesInTournament: number;
  };
};

/** ===== Tipos del Dashboard simplificado ===== */
type DashboardData = {
  activeTournament: {
    id: string;
    title: string;
    currentRound: number;
    totalRounds: number;
    roundEndDate: string;
  } | null;
  myStatus: {
    groupNumber: number;
    position: number;
    points: number;
    streak: number;
  } | null;
  nextAction: {
    type: "PLAY_MATCH" | "CONFIRM_RESULT" | "WAIT";
    title: string;
    description: string;
    actionUrl?: string;
    priority: "high" | "medium" | "low";
  } | null;
  quickStats: {
    officialRank: number;
    ironmanRank: number;
    matchesPending: number;
  };
};

/** ===== Data de vista previa ===== */
const PREVIEW_DATA: DashboardData = {
  activeTournament: null,
  myStatus: null,
  nextAction: {
    type: "WAIT",
    title: "Sin perfil de jugador",
    description: "Este usuario no tiene perfil de jugador asociado.",
    priority: "low",
  },
  quickStats: { officialRank: 0, ironmanRank: 0, matchesPending: 0 },
};

export default function PlayerDashboardClient() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showSecondaryActions, setShowSecondaryActions] = useState(false);

  // Estado del selector de torneos - MEJORADO
  const [availableTournaments, setAvailableTournaments] = useState<
    { id: string; title: string; isActive: boolean; isCurrent: boolean }[]
  >([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [showTournamentSelector, setShowTournamentSelector] = useState(false);
  const [isChangingTournament, setIsChangingTournament] = useState(false);

  /** Determina la próxima acción según sets pendientes */
  const deriveNextAction = (matchesPending: number): DashboardData["nextAction"] => {
    if (matchesPending > 0) {
      return {
        type: "PLAY_MATCH",
        title: "Tienes sets pendientes",
        description: `${matchesPending} set${matchesPending > 1 ? "s" : ""} por completar`,
        actionUrl: "/mi-grupo",
        priority: "high",
      };
    }
    return {
      type: "WAIT",
      title: "Todo al día",
      description: "No tienes acciones pendientes",
      priority: "low",
    };
  };

  /** Fallback: trae availableTournaments desde /api/player/group */
  const fetchAvailableTournamentsFallback = async (): Promise<
    NonNullable<ApiResponse["availableTournaments"]>
  > => {
    try {
      console.log("🔄 Fallback: Obteniendo torneos desde /api/player/group");
      const res = await fetch("/api/player/group", {
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        console.log("❌ Error en fallback:", res.status);
        return [];
      }

      const json = (await res.json()) as {
        availableTournaments?: NonNullable<ApiResponse["availableTournaments"]>;
      };

      const tournaments = json.availableTournaments ?? [];
      console.log("📋 Torneos desde fallback:", tournaments);
      return tournaments;
    } catch (err) {
      console.error("❌ Error en fetchAvailableTournamentsFallback:", err);
      return [];
    }
  };

  /** Carga datos del dashboard - COMPLETAMENTE REESCRITO */
  const fetchDashboard = async (tournamentId?: string) => {
    try {
      console.log("🚀 Fetching dashboard data...", {
        tournamentId,
        selectedTournamentId,
        isChangingTournament,
      });

      setLoading(true);
      setError(null);

      const url = new URL("/api/player/dashboard", window.location.origin);
      if (tournamentId) {
        url.searchParams.set("tournamentId", tournamentId);
        console.log("🎯 Consultando torneo específico:", tournamentId);
      }

      console.log("📡 URL completa:", url.toString());

      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("📥 Response status:", res.status);

      if (res.status === 401) {
        console.log("🔐 Usuario no autorizado - mostrando preview");
        setData(PREVIEW_DATA);
        setIsPreviewMode(true);
        setAvailableTournaments([]);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Error al cargar datos`);
      }

      const api: ApiResponse = await res.json();
      console.log("📊 API Response completa:", api);

      // CRÍTICO: Extraer lista de torneos ANTES de procesar datos
      let tournaments = api.availableTournaments ?? [];
      console.log("🏆 Torneos desde dashboard API:", tournaments);

      if (tournaments.length === 0) {
        console.log("⚠️ Sin torneos en dashboard API, usando fallback...");
        tournaments = await fetchAvailableTournamentsFallback();
      }

      // Actualizar estado de torneos disponibles SIEMPRE
      if (tournaments.length > 0) {
        console.log("✅ Actualizando lista de torneos:", tournaments);
        setAvailableTournaments(tournaments);

        // Establecer torneo seleccionado si no hay uno o si el actual no existe
        if (!selectedTournamentId || !tournaments.find((t) => t.id === selectedTournamentId)) {
          const current = tournaments.find((t) => t.isCurrent) || tournaments[0];
          console.log("🎯 Estableciendo torneo seleccionado:", current?.id);
          if (current) {
            setSelectedTournamentId(current.id);
          }
        }
      } else {
        console.log("⚠️ No se encontraron torneos disponibles");
        setAvailableTournaments([]);
      }

      if (!api.activeTournament) {
        console.log("⚠️ Sin torneo activo en response");
        setData({
          ...PREVIEW_DATA,
          nextAction: {
            type: "WAIT",
            title: "Sin torneo activo",
            description: "Aún no estás en un torneo activo.",
            priority: "low",
          },
        });
        setIsPreviewMode(true);
        return;
      }

      const simplified: DashboardData = {
        activeTournament: api.activeTournament,
        myStatus: api.currentGroup
          ? {
              groupNumber: api.currentGroup.number,
              position: api.currentGroup.position ?? 0,
              points: api.currentGroup.points ?? 0,
              streak: api.currentGroup.streak ?? 0,
            }
          : null,
        nextAction: deriveNextAction(api.stats?.matchesPending ?? 0),
        quickStats: {
          officialRank: api.ranking?.position ?? 0,
          ironmanRank: api.ranking?.ironmanPosition ?? 0,
          matchesPending: api.stats?.matchesPending ?? 0,
        },
      };

      console.log("✅ Dashboard data procesado:", simplified);

      // CRÍTICO: Sincronizar torneo seleccionado con el activo
      if (simplified.activeTournament?.id && simplified.activeTournament.id !== selectedTournamentId) {
        console.log(
          "🔄 Sincronizando torneo seleccionado con activo:",
          simplified.activeTournament.id
        );
        setSelectedTournamentId(simplified.activeTournament.id);
      }

      setData(simplified);
      setIsPreviewMode(false);
    } catch (err) {
      console.error("❌ Error en fetchDashboard:", err);
      setError(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setLoading(false);
      setIsChangingTournament(false);
    }
  };

  /** Manejar cambio de torneo - COMPLETAMENTE REESCRITO */
  const handleTournamentChange = async (tournamentId: string) => {
    console.log("🔄 handleTournamentChange:", {
      tournamentId,
      currentSelected: selectedTournamentId,
      isChangingTournament,
    });

    if (tournamentId === selectedTournamentId) {
      console.log("⚠️ Mismo torneo seleccionado, cerrando selector");
      setShowTournamentSelector(false);
      return;
    }

    if (isChangingTournament) {
      console.log("⚠️ Ya hay un cambio de torneo en proceso");
      return;
    }

    console.log("🔄 Iniciando cambio de torneo...");
    setIsChangingTournament(true);
    setShowTournamentSelector(false);

    // Actualizar inmediatamente el estado
    setSelectedTournamentId(tournamentId);

    // Delay pequeño para mejorar UX
    setTimeout(() => {
      fetchDashboard(tournamentId);
    }, 100);
  };

  /** Efecto inicial */
  useEffect(() => {
    if (session?.user && status === "authenticated") {
      console.log("🚀 Usuario autenticado, cargando dashboard inicial");
      fetchDashboard();
    }
  }, [session, status]);

  // Cerrar selector al click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showTournamentSelector) {
        const target = event.target as Element;
        if (!target.closest("[data-tournament-selector]")) {
          console.log("👆 Click fuera del selector, cerrando");
          setShowTournamentSelector(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTournamentSelector]);

  // Loading state
  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 py-8">
        <div className="container mx-auto px-4 max-w-6xl space-y-6">
          <div className="text-center space-y-4 animate-pulse">
            <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg">
              <div className="w-6 h-6 bg-orange-200 rounded-full" />
              <div className="h-6 bg-orange-200 rounded w-32" />
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="h-4 bg-gray-200 rounded w-48" />
              <div className="h-6 bg-orange-200 rounded-full w-20" />
            </div>
          </div>
          <div className="h-32 bg-gradient-to-r from-orange-200 via-red-100 to-orange-200 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-orange-100 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="text-center mt-8">
            <div className="inline-flex items-center gap-2 text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600" />
              <span className="text-sm">Cargando tu información...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  const handleRetryClick = () => {
    const id = selectedTournamentId || data?.activeTournament?.id;
    fetchDashboard(id);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <h3 className="text-xl font-semibold text-red-600 mb-3">
              Error al cargar datos
            </h3>
            <p className="text-red-600 mb-6 max-w-md mx-auto">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={handleRetryClick}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reintentar
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Recargar página
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const daysUntilRoundEnd = data.activeTournament
    ? Math.max(
        0,
        Math.ceil(
          (new Date(data.activeTournament.roundEndDate).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  const getActionIcon = (type: string) => {
    switch (type) {
      case "PLAY_MATCH":
        return Play;
      case "CONFIRM_RESULT":
        return Clock;
      default:
        return CheckCircle;
    }
  };

  const getActionColors = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-gradient-to-r from-orange-600 via-red-600 to-rose-600 shadow-xl";
      case "medium":
        return "bg-gradient-to-r from-orange-500 via-red-500 to-rose-500 shadow-lg";
      default:
        return "bg-gradient-to-r from-orange-400 via-red-400 to-rose-400 shadow-lg";
    }
  };

  // Encontrar el torneo seleccionado actual
  const currentTournament = availableTournaments.find((t) => t.id === selectedTournamentId);

  console.log("🎯 Render state:", {
    availableTournaments: availableTournaments.length,
    selectedTournamentId,
    currentTournament: currentTournament?.title,
    showSelector: showTournamentSelector,
    isChangingTournament,
  });

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 py-8 ${
        isPreviewMode ? "opacity-90" : ""
      }`}
    >
      <div className="container mx-auto px-4 max-w-6xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg border border-white/20">
            <Crown className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              ¡Hola, {session?.user?.name?.split(" ")[0] ?? "Jugador"}!
            </h1>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            {data.activeTournament ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500/10 text-orange-700 border-orange-200 backdrop-blur-sm">
                    {data.activeTournament.title}
                  </Badge>

                  {/* Selector de torneos MEJORADO - FUNCIONAL */}
                  {availableTournaments.length > 1 && (
                    <div className="relative" data-tournament-selector>
                      <button
                        onClick={() => setShowTournamentSelector(!showTournamentSelector)}
                        disabled={isChangingTournament}
                        className={`ml-1 p-1.5 rounded-full transition-colors ${
                          isChangingTournament
                            ? "bg-orange-200 cursor-not-allowed"
                            : "hover:bg-orange-100 hover:shadow-sm"
                        }`}
                        title={`Cambiar torneo (${availableTournaments.length} disponibles)`}
                      >
                        {isChangingTournament ? (
                          <RefreshCw className="w-4 h-4 text-orange-600 animate-spin" />
                        ) : (
                          <Settings className="w-4 h-4 text-orange-600" />
                        )}
                      </button>

                      {showTournamentSelector && (
                        <div className="absolute top-8 left-0 z-50 min-w-[320px]">
                          <Card className="border shadow-xl bg-white/95 backdrop-blur-sm">
                            <CardContent className="p-4">
                              <div className="space-y-1">
                                <div className="px-2 py-1 text-xs font-medium text-gray-500 border-b mb-2">
                                  Seleccionar Torneo ({availableTournaments.length} disponibles)
                                </div>

                                {availableTournaments.map((tournament) => {
                                  const isSelected = tournament.id === selectedTournamentId;

                                  return (
                                    <button
                                      key={tournament.id}
                                      onClick={() => handleTournamentChange(tournament.id)}
                                      disabled={isChangingTournament || isSelected}
                                      className={`w-full text-left p-3 rounded-lg transition-colors text-sm ${
                                        isSelected
                                          ? "bg-orange-100 border border-orange-200 ring-1 ring-orange-300"
                                          : "hover:bg-orange-50 border border-transparent"
                                      } ${isChangingTournament ? "opacity-50 cursor-not-allowed" : ""}`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Trophy className="w-3 h-3 text-orange-600" />
                                          <span className="font-medium">{tournament.title}</span>
                                          {isSelected && (
                                            <CheckCircle className="w-3 h-3 text-orange-600" />
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {tournament.isCurrent && (
                                            <Badge className="bg-orange-500 text-white text-xs">Actual</Badge>
                                          )}
                                          {tournament.isActive && !tournament.isCurrent && (
                                            <Badge className="bg-green-500 text-white text-xs">Activo</Badge>
                                          )}
                                          {!tournament.isActive && (
                                            <Badge variant="secondary" className="text-xs">
                                              Finalizado
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </div>
                  )}
                </div> {/* ✅ Cierra el div de "flex items-center gap-2" que faltaba */}

                <Badge className="bg-red-500/10 text-red-700 border-red-200 backdrop-blur-sm">
                  Ronda {data.activeTournament.currentRound} de {data.activeTournament.totalRounds}
                </Badge>
              </>
            ) : (
              <Badge className="bg-gray-500/10 text-gray-700 border-gray-200">Sin torneo activo</Badge>
            )}

            {isPreviewMode && <Badge variant="secondary" className="backdrop-blur-sm">Vista Previa</Badge>}

            {data.myStatus?.streak && data.myStatus.streak > 0 && (
              <Badge className="bg-orange-500/10 text-orange-700 border-orange-200 backdrop-blur-sm">
                <Flame className="w-3 h-3 mr-1" />
                Racha x{data.myStatus.streak}
              </Badge>
            )}

            {isChangingTournament && (
              <Badge className="bg-blue-100 text-blue-700 animate-pulse">Cambiando torneo...</Badge>
            )}
          </div>
        </div>

        {/* Action Card */}
        {data.nextAction && (
          <Card className="relative overflow-hidden border-0 shadow-xl">
            <div className={`absolute inset-0 ${getActionColors(data.nextAction.priority)}`} />
            <CardContent className="relative p-8 text-white">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      {React.createElement(getActionIcon(data.nextAction.type), {
                        className: "w-6 h-6",
                      })}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{data.nextAction.title}</h2>
                      <p className="text-white/90 text-lg">{data.nextAction.description}</p>
                    </div>
                  </div>

                  {data.nextAction.actionUrl && !isPreviewMode && (
                    <Link href={data.nextAction.actionUrl}>
                      <Button className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm transition-all duration-300">
                        {data.nextAction.type === "PLAY_MATCH" ? "Ir a Mi Grupo" : "Ir"}
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                  )}

                  {isPreviewMode && (
                    <Button className="bg-white/20 text-white border-white/30 backdrop-blur-sm" disabled>
                      Ir a Mi Grupo
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  )}
                </div>

                <div className="hidden md:block">
                  <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <Target className="w-16 h-16 text-white/80" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sección resumida */}
        <EnhancedDashboardSection data={data} />

        {/* Quick Actions */}
        <Card className="bg-white/80 backdrop-blur-sm border-gray-200 shadow-lg">
          <CardContent className="p-4">
            <button
              onClick={() => setShowSecondaryActions(!showSecondaryActions)}
              className="w-full flex items-center justify-between text-left hover:bg-gray-50/80 -m-4 p-4 rounded-lg transition-all duration-300"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">Acciones rápidas</span>
                <Badge variant="outline" className="text-xs backdrop-blur-sm">
                  {showSecondaryActions ? "Ocultar" : "Mostrar"}
                </Badge>
              </div>
              {showSecondaryActions ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {showSecondaryActions && (
              <div className="mt-4 space-y-3">
                <Link href="/mi-grupo">
                  <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-orange-200 bg-gradient-to-br from-white to-orange-50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <Users className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Mi Grupo Completo</h3>
                          <p className="text-sm text-gray-600">Ver sets y posiciones detalladas</p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all duration-300" />
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/clasificaciones">
                  <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-red-200 bg-gradient-to-br from-white to-red-50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <Trophy className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Rankings Completos</h3>
                          <p className="text-sm text-gray-600">Oficial e Ironman</p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-red-500 group-hover:translate-x-1 transition-all duration-300" />
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/historial">
                  <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-amber-200 bg-gradient-to-br from-white to-amber-50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <Calendar className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Mi Historial</h3>
                          <p className="text-sm text-gray-600">Resultados anteriores</p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all duration-300" />
                    </CardContent>
                  </Card>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aviso de fin de ronda */}
        {daysUntilRoundEnd <= 1 && daysUntilRoundEnd > 0 && !isPreviewMode && (
          <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-orange-800 text-lg">¡Último día de la ronda!</p>
                  <p className="text-orange-700 mt-1">Completa todos tus sets para mantener tu racha activa.</p>
                  <div className="mt-3">
                    <Link href="/mi-grupo">
                      <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                        Ver mis sets
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA Preview */}
        {isPreviewMode && (
          <Card className="border-dashed border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-red-50 shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Crown className="h-10 w-10 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold text-orange-900 mb-3">¡Únete a un Torneo Real!</h3>
              <p className="text-orange-700 mb-6 max-w-md mx-auto">
                Estos son datos de ejemplo. Contacta con el administrador para participar en torneos reales.
              </p>
              <Button className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg">
                Contactar Administrador
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
