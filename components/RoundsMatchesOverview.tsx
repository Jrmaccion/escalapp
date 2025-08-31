"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Play,
  RefreshCw,
  Target,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Player = { id: string; name: string };
type Match = {
  id: string;
  setNumber: number;
  status: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED";
  proposedDate: string | null;
  acceptedDate: string | null;
  proposedById: string | null;
  acceptedBy: string[];
  team1Player1Id: string;
  team1Player2Id: string;
  team2Player1Id: string;
  team2Player2Id: string;
  team1Games: number | null;
  team2Games: number | null;
  tiebreakScore: string | null;
  isConfirmed: boolean;
};
type Group = {
  id: string;
  number: number;
  level: string;
  players: { player: Player; position: number }[];
  matches: Match[];
};
type RoundData = {
  id: string;
  number: number;
  startDate: string;
  endDate: string;
  tournament: { id: string; title: string };
};
type Stats = {
  totalGroups: number;
  totalPartidos: number;
  totalSets: number;
  confirmedSets: number;
  pendingDates: number;
  scheduledSets: number;
  completedSets: number;
  proposedDates: number;
  completionRate: number;
};

type RoundsMatchesOverviewProps = {
  roundId: string;
  isAdmin?: boolean;
  roundData?: RoundData;
  groups?: Group[];
  stats?: Stats;
};

export default function RoundsMatchesOverview({ 
  roundId, 
  isAdmin = false,
  roundData,
  groups = [],
  stats
}: RoundsMatchesOverviewProps) {
  // Si no hay datos, mostrar que no hay información disponible
  if (!groups.length && !roundData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Vista General de Partidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No hay partidos disponibles</p>
            <p className="text-sm text-gray-500">Genera grupos y partidos primero</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // La página SSR es la que debería pintar los datos;
  // si no tienes estos datos aquí, igualmente el botón "Abrir partido" funciona.
  const getPlayerName = (groupPlayers: Group["players"], pid: string) =>
    groupPlayers.find((gp) => gp.player.id === pid)?.player.name || "Jugador desconocido";

  // Función para agrupar sets en partidos
  const groupSetsIntoMatches = (matches: Match[]) => {
    const matchBlocks: Array<{
      blockNumber: number;
      sets: Match[];
      completedSets: number;
      totalSets: number;
      matchStatus: 'completed' | 'in-progress' | 'pending';
    }> = [];

    const sortedMatches = matches.sort((a, b) => a.setNumber - b.setNumber);
    
    for (let i = 0; i < sortedMatches.length; i += 3) {
      const blockSets = sortedMatches.slice(i, i + 3);
      const blockNumber = Math.floor(i / 3) + 1;
      const completedSets = blockSets.filter(s => s.isConfirmed).length;
      const totalSets = blockSets.length;
      const matchStatus = completedSets === totalSets ? 'completed' : 
                        completedSets > 0 ? 'in-progress' : 'pending';
      
      matchBlocks.push({
        blockNumber,
        sets: blockSets,
        completedSets,
        totalSets,
        matchStatus
      });
    }

    return matchBlocks;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Vista General de Partidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Estadísticas actualizadas */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalPartidos}</div>
                <div className="text-sm text-gray-600">Partidos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalSets}</div>
                <div className="text-sm text-gray-600">Sets totales</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.confirmedSets}</div>
                <div className="text-sm text-gray-600">Sets confirmados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.completionRate}%</div>
                <div className="text-sm text-gray-600">Progreso</div>
              </div>
            </div>
          )}

          <div className="text-sm text-gray-500 text-center">
            Esta vista se complementa con la información detallada de la página principal
          </div>
        </CardContent>
      </Card>

      {/* Tabs por estados - TERMINOLOGÍA ACTUALIZADA */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Todos los partidos</TabsTrigger>
          <TabsTrigger value="pending">Sin fecha ({stats?.pendingDates || 0})</TabsTrigger>
          <TabsTrigger value="scheduled">Programados ({stats?.scheduledSets || 0})</TabsTrigger>
          <TabsTrigger value="completed">Completados ({stats?.completedSets || 0})</TabsTrigger>
        </TabsList>

        {/* Render genérico de grupos y partidos (sin filtro para simplificar) */}
        <TabsContent value="all" className="space-y-4">
          {groups.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">La información de partidos se carga desde la página principal</p>
                <p className="text-sm text-gray-500">Esta vista proporciona un resumen de estados</p>
              </CardContent>
            </Card>
          ) : (
            groups.map((group) => {
              const matchBlocks = groupSetsIntoMatches(group.matches);

              return (
                <Card key={group.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Grupo {group.number} - Nivel {group.level}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{matchBlocks.length} partido{matchBlocks.length !== 1 ? 's' : ''}</Badge>
                        <Badge variant="outline">{group.matches.length} sets</Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {matchBlocks.map((matchBlock) => (
                      <div key={matchBlock.blockNumber} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium">Partido {matchBlock.blockNumber}</h4>
                            <p className="text-sm text-gray-600">
                              {matchBlock.completedSets} de {matchBlock.totalSets} sets completados
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {matchBlock.matchStatus === 'completed' && (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Completado
                              </Badge>
                            )}
                            {matchBlock.matchStatus === 'in-progress' && (
                              <Badge className="bg-yellow-100 text-yellow-800">
                                <Clock className="w-3 h-3 mr-1" />
                                En progreso
                              </Badge>
                            )}
                            {matchBlock.matchStatus === 'pending' && (
                              <Badge variant="outline">
                                <Clock className="w-3 h-3 mr-1" />
                                Pendiente
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {matchBlock.sets.map((set) => (
                            <div key={set.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-600">Set {set.setNumber}</div>
                                <div className="text-xs font-medium truncate">
                                  {getPlayerName(group.players, set.team1Player1Id)} + {getPlayerName(group.players, set.team1Player2Id)}
                                  {" vs "}
                                  {getPlayerName(group.players, set.team2Player1Id)} + {getPlayerName(group.players, set.team2Player2Id)}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 ml-4">
                                {/* Estado del set */}
                                {set.isConfirmed ? (
                                  <Badge className="bg-green-600 text-white text-xs">Confirmado</Badge>
                                ) : set.status === "SCHEDULED" ? (
                                  <Badge variant="secondary" className="text-xs">Programado</Badge>
                                ) : set.status === "DATE_PROPOSED" ? (
                                  <Badge variant="outline" className="text-xs">Fecha propuesta</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">Pendiente</Badge>
                                )}

                                {/* CTA para abrir el set */}
                                <Link href={`/match/${set.id}`}>
                                  <Button className="h-8 px-2" size="sm">
                                    Ver set
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Vista de sets sin fecha programada</p>
              <p className="text-sm text-gray-500 mt-2">Funcionalidad disponible en próximas versiones</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Vista de sets programados</p>
              <p className="text-sm text-gray-500 mt-2">Funcionalidad disponible en próximas versiones</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Vista de sets completados</p>
              <p className="text-sm text-gray-500 mt-2">Funcionalidad disponible en próximas versiones</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Información adicional actualizada */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 mb-1">Información sobre partidos:</p>
            <ul className="text-blue-700 space-y-1">
              <li>• Cada partido está compuesto por 3 sets con rotación de jugadores</li>
              <li>• Los sets se pueden programar y jugar de forma independiente</li>
              <li>• Un partido se considera completo cuando sus 3 sets están confirmados</li>
              <li>• Esta vista complementa la información detallada de la página principal</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}