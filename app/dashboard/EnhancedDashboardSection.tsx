// app/dashboard/EnhancedDashboardSection.tsx
"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Target,
  ArrowUp,
  ArrowDown,
  Trophy,
  Clock,
  TrendingUp,
  ChevronRight,
  Play,
  Calendar,
  Flame,
  Info,
} from "lucide-react";
import Link from "next/link";

/** Mantén este tipo en línea con PlayerDashboardClient */
export type DashboardData = {
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

type Props = { data: DashboardData };

/**
 * EnhancedDashboardSection
 * - Ya NO usa hooks propios ni hace fetching.
 * - Recibe los datos del padre y los presenta con un layout claramente distinto:
 *   banda de resumen, barra de progreso, bloques compactos y CTA.
 */
export function EnhancedDashboardSection({ data }: Props) {
  const { activeTournament, myStatus, nextAction, quickStats } = data;

  const daysLeft =
    activeTournament?.roundEndDate
      ? Math.ceil(
          (new Date(activeTournament.roundEndDate).getTime() -
            new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

  const progressPct =
    activeTournament
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (activeTournament.currentRound / activeTournament.totalRounds) *
                100
            )
          )
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* BANDA RESUMEN (nuevo look) */}
      {activeTournament && (
        <Card className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-sm text-white/85 mb-1">
                  {activeTournament.title}
                </div>
                <div className="text-2xl font-extrabold tracking-tight">
                  Ronda {activeTournament.currentRound} de{" "}
                  {activeTournament.totalRounds}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge className="bg-white/15 text-white border-white/20">
                    <Calendar className="w-3.5 h-3.5 mr-1" />
                    {daysLeft} día{daysLeft === 1 ? "" : "s"} restantes
                  </Badge>
                  {!!quickStats?.matchesPending && quickStats.matchesPending > 0 && (
                    <Badge className="bg-orange-500/90 text-white">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      {quickStats.matchesPending} set
                      {quickStats.matchesPending > 1 ? "s" : ""} pendiente
                      {quickStats.matchesPending > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {myStatus?.streak ? (
                    <Badge className="bg-amber-500/90 text-white">
                      <Flame className="w-3.5 h-3.5 mr-1" />
                      Racha x{myStatus.streak}
                    </Badge>
                  ) : null}
                </div>
              </div>

              {/* Progreso del torneo */}
              <div className="md:min-w-[260px]">
                <div className="text-sm mb-2 text-white/85">
                  Progreso del torneo
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-white"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="mt-1 text-right text-xs text-white/85">
                  {progressPct}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MI SITUACIÓN (rediseño, distinto al anterior) */}
      {myStatus && (
        <Card className="overflow-hidden shadow-md">
          <CardContent className="p-0">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-xl font-bold">#{myStatus.position}</div>
                  <div className="text-emerald-100 text-xs">Posición</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{myStatus.groupNumber}</div>
                  <div className="text-emerald-100 text-xs">Mi grupo</div>
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {myStatus.points.toFixed(1)}
                  </div>
                  <div className="text-emerald-100 text-xs">Puntos</div>
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {myStatus.streak ? `x${myStatus.streak}` : "—"}
                  </div>
                  <div className="text-emerald-100 text-xs">Racha</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {myStatus.position <= 2 ? (
                    <>
                      <ArrowUp className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">
                        Sube {myStatus.position === 1 ? "2" : "1"} grupo
                        {myStatus.position === 1 ? "s" : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-4 h-4 text-rose-600" />
                      <span className="text-rose-700">
                        Baja {myStatus.position === 4 ? "2" : "1"} grupo
                        {myStatus.position === 4 ? "s" : ""}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">
                    Movimientos aplicados al cerrar ronda
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CTA contextual */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Play className="w-5 h-5" />
            Tu siguiente paso
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-blue-800">
            {nextAction?.title || "Todo al día"}
            <div className="text-xs text-blue-700/90">
              {nextAction?.description || "No tienes acciones pendientes"}
            </div>
          </div>

          <div>
            {nextAction?.actionUrl ? (
              <Button asChild>
                <Link href={nextAction.actionUrl}>
                  {nextAction.type === "PLAY_MATCH" ? "Ir a Mi Grupo" : "Ir"}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            ) : (
              <Button disabled>Sin acciones</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats rápidas (compactas y distintas) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="p-4 text-center">
            <Trophy className="w-7 h-7 text-yellow-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-yellow-700">
              #{quickStats?.officialRank ?? "—"}
            </div>
            <div className="text-xs text-gray-600">Ranking Oficial</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-7 h-7 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-700">
              {(myStatus?.points ?? 0).toFixed(1)}
            </div>
            <div className="text-xs text-gray-600">Promedio (por ronda)</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="p-4 text-center">
            <Flame className="w-7 h-7 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-700">
              x{myStatus?.streak ?? 0}
            </div>
            <div className="text-xs text-gray-600">Racha</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="p-4 text-center">
            <Calendar className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-emerald-700">
              {quickStats?.matchesPending ?? 0}
            </div>
            <div className="text-xs text-gray-600">Sets pendientes</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default EnhancedDashboardSection;
