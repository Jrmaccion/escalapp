// app/dashboard/PlayerDashboardClient.tsx — sin stats duplicadas, coherente con el API
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
  Info,
  Trophy,
} from "lucide-react";
import Link from "next/link";

type ApiResponse = {
  activeTournament: {
    id: string;
    title: string;
    currentRound: number;
    totalRounds: number;
    roundEndDate: string;
  } | null;
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
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showSecondaryActions, setShowSecondaryActions] = useState(false);

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
    return { type: "WAIT", title: "Todo al día", description: "No tienes acciones pendientes", priority: "low" };
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/player/dashboard", { cache: "no-store" });
      if (res.status === 401) {
        setData(PREVIEW_DATA);
        setIsPreviewMode(true);
        return;
      }
      if (!res.ok) throw new Error("Error al cargar datos");
      const api: ApiResponse = await res.json();

      if (!api.activeTournament) {
        setData({
          ...PREVIEW_DATA,
          nextAction: { type: "WAIT", title: "Sin torneo activo", description: "Aún no estás en un torneo activo.", priority: "low" },
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

      setData(simplified);
      setIsPreviewMode(false);
    } catch {
      setError("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Cargando tu información...</p>
              <p className="text-sm text-gray-500 mt-2">Esto puede tardar unos segundos</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center py-20">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-600 mb-2">Error al cargar datos</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchDashboard}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const daysUntilRoundEnd = data.activeTournament
    ? Math.max(0, Math.ceil((new Date(data.activeTournament.roundEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
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
        return "from-red-500 to-orange-500 text-white";
      case "medium":
        return "from-yellow-500 to-orange-500 text-white";
      default:
        return "from-green-500 to-blue-500 text-white";
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 py-8 ${isPreviewMode ? "opacity-90" : ""}`}>
      <div className="container mx-auto px-4 max-w-4xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Hola, {session?.user?.name?.split(" ")[0] ?? "Jugador"}
          </h1>
          <div className="flex items-center justify-center gap-3">
            <p className="text-gray-600">
              {data.activeTournament
                ? `${data.activeTournament.title} - Ronda ${data.activeTournament.currentRound}`
                : "Sin torneo activo"}
            </p>
            {isPreviewMode && <Badge variant="secondary">Vista Previa</Badge>}
            {data.myStatus?.streak && data.myStatus.streak > 0 && (
              <Badge className="bg-orange-100 text-orange-700">
                <Flame className="w-3 h-3 mr-1" />
                Racha x{data.myStatus.streak}
              </Badge>
            )}
          </div>
        </div>

        {/* Próxima acción */}
        {data.nextAction && (
          <Card className={`border-2 bg-gradient-to-r ${getActionColors(data.nextAction.priority)} shadow-lg`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {React.createElement(getActionIcon(data.nextAction.type), { className: "w-6 h-6" })}
                    <h2 className="text-xl font-bold">{data.nextAction.title}</h2>
                  </div>
                  <p className="text-white/90 mb-4 text-lg">{data.nextAction.description}</p>

                  {data.nextAction.actionUrl && !isPreviewMode && (
                    <Link href={data.nextAction.actionUrl}>
                      <Button className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                        {data.nextAction.type === "PLAY_MATCH" ? "Ir a Mi Grupo" : "Ir"}
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                  )}

                  {isPreviewMode && (
                    <Button className="bg-white/20 text-white border-white/30" disabled>
                      Ir a Mi Grupo
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vista general con progress/días calculados dentro */}
        <EnhancedDashboardSection
          data={{
            activeTournament: data.activeTournament,
            myStatus: data.myStatus,
            nextAction: data.nextAction,
            quickStats: data.quickStats,
          }}
        />

        {/* Acciones rápidas */}
        <Card>
          <CardContent className="p-4">
            <button
              onClick={() => setShowSecondaryActions(!showSecondaryActions)}
              className="w-full flex items-center justify-between text-left hover:bg-gray-50 -m-4 p-4 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">Acciones rápidas</span>
                <Badge variant="outline" className="text-xs">{showSecondaryActions ? "Ocultar" : "Mostrar"}</Badge>
              </div>
              {showSecondaryActions ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {showSecondaryActions && (
              <div className="mt-4 space-y-3">
                <Link href="/mi-grupo">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Mi Grupo Completo</h3>
                          <p className="text-sm text-gray-600">Ver sets y posiciones detalladas</p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/clasificaciones">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Rankings Completos</h3>
                          <p className="text-sm text-gray-600">Oficial e Ironman</p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/historial">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Mi Historial</h3>
                          <p className="text-sm text-gray-600">Resultados anteriores</p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </CardContent>
                  </Card>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aviso de fin de ronda */}
        {daysUntilRoundEnd <= 1 && daysUntilRoundEnd > 0 && !isPreviewMode && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-800">¡Último día de la ronda!</p>
                  <p className="text-sm text-orange-700 mt-1">Completa todos tus sets para mantener tu racha activa.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA preview */}
        {isPreviewMode && (
          <Card className="border-dashed border-2 border-blue-300 bg-blue-50">
            <CardContent className="p-8 text-center">
              <Crown className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-blue-900 mb-2">¡Únete a un Torneo Real!</h3>
              <p className="text-blue-700 mb-6">Estos son datos de ejemplo. Contacta con el administrador para participar.</p>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">Contactar Administrador</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
