"use client";

import { useState } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEligiblePlayersForRound } from "@/lib/rounds";
import Breadcrumbs from "@/components/Breadcrumbs";
import MatchGenerationPanel from "@/components/MatchGenerationPanel";
import GroupManagementPanel from "@/components/GroupManagementPanel";
import CloseRoundButton from "@/components/CloseRoundButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, CheckCircle, Clock, ArrowLeft, Play, Plus } from "lucide-react";
import { format, differenceInDays, isAfter, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

type RoundDetailPageProps = {
  params: {
    id: string;
  };
};

type Match = {
  id: string;
  setNumber: number;
  team1Player1Id: string;
  team1Player2Id: string;
  team2Player1Id: string;
  team2Player2Id: string;
  team1Games: number | null;
  team2Games: number | null;
  tiebreakScore: string | null;
  isConfirmed: boolean;
  groupNumber: number;
};

// Convertir a Client Component para manejar el estado del filtro
export default function RoundDetailClient({ 
  round, 
  eligiblePlayers 
}: { 
  round: any; 
  eligiblePlayers: any[] 
}) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Preparar todos los matches con información del grupo
  const allMatches: Match[] = round.groups.flatMap((group: any) =>
    group.matches.map((match: any) => ({
      ...match,
      groupNumber: group.number,
    }))
  );

  // Estadísticas
  const now = new Date();
  const daysToEnd = differenceInDays(round.endDate, now);
  const daysToStart = differenceInDays(round.startDate, now);

  const status = round.isClosed
    ? "closed"
    : isBefore(now, round.startDate)
    ? "upcoming"
    : isAfter(now, round.endDate)
    ? "overdue"
    : "active";

  const totalSets = allMatches.length;
  const totalPartidos = Math.ceil(totalSets / 3);
  const completedSets = allMatches.filter(m => m.isConfirmed).length;
  const scheduledSets = allMatches.filter((m: any) => m.status === "SCHEDULED").length;

  // Filtrar matches según el filtro seleccionado
  const filteredMatches = allMatches.filter(match => {
    const hasResult = match.team1Games !== null && match.team2Games !== null;
    
    switch (selectedFilter) {
      case 'pending':
        return !match.isConfirmed;
      case 'completed':
        return match.isConfirmed;
      default:
        return true;
    }
  });

  // Breadcrumbs
  const breadcrumbItems = [
    { label: "Inicio", href: "/dashboard" },
    { label: "Admin", href: "/admin" },
    { label: "Rondas", href: "/admin/rounds" },
    { label: `Ronda ${round.number}`, current: true },
  ];

  const getPlayerName = (playerId: string): string => {
    for (const group of round.groups) {
      const gp = group.players.find((p: any) => p.player.id === playerId);
      if (gp) return gp.player.name;
    }
    return "Jugador desconocido";
  };

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-6">
      <Breadcrumbs items={breadcrumbItems} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">
            Ronda {round.number} - {round.tournament.title}
          </h1>
          <p className="text-gray-600">
            {format(round.startDate, "d 'de' MMMM", { locale: es })} -{" "}
            {format(round.endDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/admin/rounds">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Rondas
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/admin/tournaments/${round.tournament.id}`}>Ver Torneo</Link>
          </Button>
        </div>
      </div>

      {/* Estado */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Estado</span>
              </div>
              <div>
                {status === "closed" && <Badge className="bg-gray-200 text-gray-800">Cerrada</Badge>}
                {status === "upcoming" && (
                  <Badge className="bg-blue-100 text-blue-700">Próxima ({daysToStart} días)</Badge>
                )}
                {status === "active" && (
                  <Badge className="bg-green-100 text-green-700">Activa ({daysToEnd} días restantes)</Badge>
                )}
                {status === "overdue" && <Badge variant="destructive">Fuera de plazo</Badge>}
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="w-5 h-5 text-purple-600" />
                <span className="font-medium">Partidos</span>
              </div>
              <div className="text-2xl font-bold">{totalPartidos}</div>
              <div className="text-xs text-gray-500">{totalSets} sets</div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium">Sets Completados</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {completedSets}/{totalSets}
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Sets Programados</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{scheduledSets}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug info - temporal */}
      {eligiblePlayers.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="text-yellow-800">
              <strong>DEBUG:</strong> No se encontraron jugadores elegibles para esta ronda.
              <br />
              Ronda: {round.number} | Torneo: {round.tournament.id} | Título: {round.tournament.title}
              <br />
              Revisa que los jugadores estén inscritos con joinedRound ≤ {round.number}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Panel de gestión de grupos */}
      <GroupManagementPanel
        roundId={round.id}
        roundNumber={round.number}
        tournament={{
          id: round.tournament.id,
          title: round.tournament.title,
          totalPlayers: eligiblePlayers.length,
        }}
        groups={round.groups.map((group: any) => ({
          id: group.id,
          number: group.number,
          level: group.level,
          players: group.players.map((gp: any) => ({
            id: gp.player.id,
            name: gp.player.name,
            position: gp.position,
          })),
        }))}
        availablePlayers={eligiblePlayers.length}
        isAdmin={true}
      />

      {/* Panel de generación de partidos */}
      <MatchGenerationPanel
        roundId={round.id}
        groups={round.groups.map((group: any) => ({
          id: group.id,
          number: group.number,
          level: group.level,
          players: group.players.map((gp: any) => ({
            id: gp.player.id,
            name: gp.player.name,
            position: gp.position,
          })),
          matches: group.matches.map((m: any) => ({
            id: m.id,
            setNumber: m.setNumber,
          })),
        }))}
        isAdmin={true}
      />

      {/* Panel de gestión de resultados - NUEVO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Gestión de Resultados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Resumen de estado */}
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

            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={selectedFilter === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setSelectedFilter('all')}
                >
                  Todos ({totalSets})
                </Button>
                <Button 
                  variant={selectedFilter === 'pending' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setSelectedFilter('pending')}
                >
                  Pendientes ({totalSets - completedSets})
                </Button>
                <Button 
                  variant={selectedFilter === 'completed' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setSelectedFilter('completed')}
                >
                  Completados ({completedSets})
                </Button>
              </div>
              <div className="text-sm text-gray-500">
                {filteredMatches.length} sets mostrados
              </div>
            </div>

            {/* Lista compacta de todos los sets */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredMatches.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No hay sets que coincidan con el filtro seleccionado</p>
                </div>
              ) : (
                filteredMatches.map((match) => {
                  const hasResult = match.team1Games !== null && match.team2Games !== null;
                  const team1Score = match.team1Games ?? "-";
                  const team2Score = match.team2Games ?? "-";
                  
                  return (
                    <div
                      key={match.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        match.isConfirmed
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
                              Grupo {match.groupNumber} - Set {match.setNumber}
                            </Badge>
                            {match.isConfirmed && (
                              <Badge className="bg-green-100 text-green-700 shrink-0">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Confirmado
                              </Badge>
                            )}
                            {hasResult && !match.isConfirmed && (
                              <Badge className="bg-yellow-100 text-yellow-700 shrink-0">
                                <Clock className="w-3 h-3 mr-1" />
                                Por validar
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="truncate">
                                {getPlayerName(match.team1Player1Id)} + {getPlayerName(match.team1Player2Id)}
                              </span>
                              <span className="font-bold text-lg ml-2">{team1Score}</span>
                            </div>
                            
                            <div className="text-center text-xs text-gray-400">vs</div>
                            
                            <div className="flex items-center justify-between">
                              <span className="truncate">
                                {getPlayerName(match.team2Player1Id)} + {getPlayerName(match.team2Player2Id)}
                              </span>
                              <span className="font-bold text-lg ml-2">{team2Score}</span>
                            </div>
                          </div>

                          {match.tiebreakScore && (
                            <div className="text-xs text-blue-600 mt-1">
                              Tie-break: {match.tiebreakScore}
                            </div>
                          )}
                        </div>

                        <div className="ml-4 flex items-center gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/match/${match.id}`}>
                              {hasResult ? (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Ver
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4 mr-2" />
                                  Introducir
                                </>
                              )}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Acciones masivas */}
            {!round.isClosed && (
              <div className="flex flex-wrap gap-3 pt-4 border-t">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/results">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Validar Resultados
                  </Link>
                </Button>
                
                {totalSets - completedSets > 0 && (
                  <Button variant="outline" size="sm">
                    <Clock className="w-4 h-4 mr-2" />
                    Enviar recordatorios ({totalSets - completedSets} pendientes)
                  </Button>
                )}
                
                {completedSets === totalSets && (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle className="w-4 w-4" />
                    Todos los sets completados - Lista para cerrar
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Acciones de administración */}
      {!round.isClosed && (
        <Card>
          <CardHeader>
            <CardTitle>Acciones de Administración</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link href="/admin/results">Validar Resultados</Link>
              </Button>

              <CloseRoundButton roundId={round.id} />

              <Button variant="outline" asChild>
                <Link href="/admin/players">Gestionar Jugadores</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}