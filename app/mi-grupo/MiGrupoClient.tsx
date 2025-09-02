"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  CheckCircle,
  Play,
  CalendarPlus,
} from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";

type GroupData = {
  hasGroup: boolean;
  message?: string;
  tournament?: {
    title: string;
    currentRound: number;
  };
  group?: {
    number: number;
    level: string;
    totalPlayers: number;
  };
  myStatus?: {
    position: number;
    points: number;
    streak: number;
  };
  players?: Array<{
    id: string;
    name: string;
    points: number;
    position: number;
    isCurrentUser: boolean;
  }>;
  nextMatches?: Array<{
    id: string;
    setNumber: number;
    partner: string;
    opponents: string[];
    hasResult: boolean;
    isPending: boolean;
    isConfirmed: boolean;
    status?: string;
    proposedDate?: string | null;
    acceptedDate?: string | null;
    acceptedCount?: number;
    team1Player1Name?: string;
    team1Player2Name?: string;
    team2Player1Name?: string;
    team2Player2Name?: string;
    team1Games?: number | null;
    team2Games?: number | null;
  }>;
  allMatches?: Array<{
    id: string;
    setNumber: number;
    partner: string;
    opponents: string[];
    hasResult: boolean;
    isPending: boolean;
    isConfirmed: boolean;
    status?: string;
    proposedDate?: string | null;
    acceptedDate?: string | null;
    acceptedCount?: number;
    team1Player1Name?: string;
    team1Player2Name?: string;
    team2Player1Name?: string;
    team2Player2Name?: string;
    team1Games?: number | null;
    team2Games?: number | null;
  }>;
};

export default function MiGrupoClient() {
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/player/group", { cache: "no-store" });
      if (response.ok) {
        const groupData = (await response.json()) as GroupData;
        setData(groupData);
      } else {
        setData({
          hasGroup: false,
          message: "No se pudo cargar tu grupo.",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      setData({
        hasGroup: false,
        message: "Error de conexión al cargar el grupo.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getMatchStatusInfo = (match: NonNullable<GroupData["allMatches"]>[0]) => {
    if (match.isConfirmed) {
      return {
        label: "Completado",
        color: "bg-green-100 text-green-700",
        icon: CheckCircle,
      };
    }

    if (match.hasResult) {
      return {
        label: "Por confirmar",
        color: "bg-yellow-100 text-yellow-700",
        icon: Clock,
      };
    }

    switch (match.status) {
      case "SCHEDULED":
        return {
          label: "Programado",
          color: "bg-blue-100 text-blue-700",
          icon: Calendar,
        };
      case "DATE_PROPOSED":
        return {
          label: `Fecha propuesta (${match.acceptedCount || 0}/4)`,
          color: "bg-purple-100 text-purple-700",
          icon: Clock,
        };
      default:
        return {
          label: "Sin programar",
          color: "bg-gray-100 text-gray-700",
          icon: CalendarPlus,
        };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // Estado global del "partido" (los 3 sets)
  const getPartyScheduleStatus = (matches: NonNullable<GroupData["allMatches"]>) => {
    if (!matches || matches.length === 0) return null;

    const firstMatch = matches[0];
    const allScheduled = matches.every((m) => m.status === "SCHEDULED");
    const someProposed = matches.some((m) => m.status === "DATE_PROPOSED");

    if (allScheduled) {
      return {
        label: "Partido programado",
        color: "bg-green-100 text-green-700",
        icon: Calendar,
        date: firstMatch.acceptedDate ?? null,
      };
    }

    if (someProposed || firstMatch.status === "DATE_PROPOSED") {
      return {
        label: `Fecha propuesta (${firstMatch.acceptedCount || 0}/4)`,
        color: "bg-purple-100 text-purple-700",
        icon: Clock,
        date: firstMatch.proposedDate ?? null,
      };
    }

    return {
      label: "Sin programar",
      color: "bg-gray-100 text-gray-700",
      icon: CalendarPlus,
      date: null as string | null,
    };
  };

  if (loading) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (!data?.hasGroup) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <div className="text-center py-20">
          <AlertTriangle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sin Grupo Asignado</h2>
          <p className="text-gray-600 mb-4">
            {data?.message || "No estás asignado a ningún grupo en el torneo activo."}
          </p>
        </div>
      </div>
    );
  }

  const matches = (data.allMatches || data.nextMatches || []).slice().sort((a, b) => a.setNumber - b.setNumber);
  const completedMatches = matches.filter((m) => m.isConfirmed);
  const partyStatus = getPartyScheduleStatus(matches);

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Mi Grupo</h1>
        <div className="text-right text-sm text-gray-600">
          <div>{data.tournament?.title}</div>
          <div>Ronda {data.tournament?.currentRound}</div>
        </div>
      </div>

      {/* Estado del partido completo */}
      {partyStatus && (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const PartyIcon = partyStatus.icon;
                  return <PartyIcon className="w-5 h-5 text-purple-600" />;
                })()}
                <div>
                  <div className="font-medium">Estado del Partido (3 sets)</div>
                  <div className="text-sm text-gray-600">
                    Los 4 jugadores juegan los 3 sets con rotación fija de parejas.
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded text-sm font-medium ${partyStatus.color}`}>
                {partyStatus.label}
                {partyStatus.date ? ` · ${formatDate(partyStatus.date)}` : ""}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen del grupo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">Grupo {data.group?.number}</div>
              <div className="text-sm text-gray-600">{data.group?.level}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data.myStatus?.position}°</div>
              <div className="text-sm text-gray-600">Mi posición</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data.myStatus?.points}</div>
              <div className="text-sm text-gray-600">Mis puntos</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {completedMatches.length}/{matches.length}
              </div>
              <div className="text-sm text-gray-600">Sets jugados</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clasificación del grupo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Clasificación del Grupo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.players?.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    player.isCurrentUser
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-sm">
                      {player.position}
                    </div>
                    <div>
                      <div className="font-medium">
                        {player.name} {player.isCurrentUser && "(Tú)"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{player.points}</div>
                    <div className="text-xs text-gray-500">puntos</div>
                  </div>
                </div>
              ))}
              {(!data.players || data.players.length === 0) && (
                <div className="text-sm text-gray-500">
                  No hay jugadores listados en este grupo.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mis sets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Mis Sets de la Ronda
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No hay sets programados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match) => {
                  const statusInfo = getMatchStatusInfo(match);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div
                      key={match.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Set {match.setNumber}</Badge>
                          <Badge className={statusInfo.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <Button size="sm" asChild>
                          {/* Mantengo tu ruta antigua /match/[id] */}
                          <Link href={`/match/${match.id}`}>
                            {match.isConfirmed
                              ? "Ver resultado"
                              : match.hasResult
                              ? "Confirmar"
                              : "Programar/Jugar"}
                          </Link>
                        </Button>
                      </div>

                      {/* Presentación de equipos (usa partner/opponents si vienen; si no, usa los nombres de equipo) */}
                      <div className="text-sm space-y-1">
                        <div className="font-medium text-blue-700">
                          {match.partner
                            ? `Tú + ${match.partner}`
                            : `${match.team1Player1Name ?? "—"} + ${match.team1Player2Name ?? "—"}`}
                        </div>
                        <div className="text-gray-500 text-center text-xs">vs</div>
                        <div className="font-medium text-red-700">
                          {match.opponents?.length
                            ? match.opponents.join(" + ")
                            : `${match.team2Player1Name ?? "—"} + ${match.team2Player2Name ?? "—"}`}
                        </div>
                      </div>

                      {/* Resultado si existe */}
                      {match.hasResult && (
                        <div className="mt-2 text-center">
                          <span className="font-mono text-lg">
                            {match.team1Games != null && match.team2Games != null
                              ? `${match.team1Games}-${match.team2Games}`
                              : "Resultado pendiente"}
                          </span>
                        </div>
                      )}

                      {/* Información de programación */}
                      {match.status === "SCHEDULED" && match.acceptedDate && (
                        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm">
                          <div className="flex items-center gap-1 text-green-700">
                            <Calendar className="w-4 h-4" />
                            <span className="font-medium">Programado:</span>
                            <span>{formatDate(match.acceptedDate)}</span>
                          </div>
                        </div>
                      )}

                      {match.status === "DATE_PROPOSED" && match.proposedDate && (
                        <div className="mt-3 p-2 bg-purple-50 border border-purple-200 rounded text-sm">
                          <div className="flex items-center gap-1 text-purple-700">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">Fecha propuesta:</span>
                            <span>{formatDate(match.proposedDate)}</span>
                          </div>
                          <div className="text-purple-600 text-xs mt-1">
                            Confirmado por {match.acceptedCount || 0} de 4 jugadores
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
