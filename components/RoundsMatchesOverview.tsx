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
  Plus,
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
  totalMatches: number;
  confirmedMatches: number;
  pendingDates: number;
  scheduledMatches: number;
  completedMatches: number;
  proposedDates: number;
  completionRate: number;
};

type RoundsMatchesOverviewProps = {
  roundId: string;
  isAdmin?: boolean;
};

export default function RoundsMatchesOverview({ roundId, isAdmin = false }: RoundsMatchesOverviewProps) {
  // IMPORTANTE: este componente es “visual”.
  // La página SSR ya trae el contenido de la ronda, pero lo mantenemos con un fetch ligero
  // por si ya lo usabas como refresco. Si prefieres, puedes eliminar todo el fetch y
  // pasar los datos por props en el futuro.
  const [round, setRound] = useState<RoundData | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoundData = async () => {
    try {
      setLoading(true);
      // ⚠️ No llamamos a generate-matches en GET (solo es POST)
      // Aquí podrías crear un endpoint /api/rounds/:id/summary (GET) si quieres refresco real.
      // De momento, dejamos un “no-op” para no romper experiencias existentes.
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoundData();
  }, [roundId]);

  if (loading && !round) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Cargando partidos...
      </div>
    );
  }

  // La página SSR es la que debería pintar los datos;
  // si no tienes estos datos aquí, igualmente el botón “Abrir partido” funciona.
  const getPlayerName = (groupPlayers: Group["players"], pid: string) =>
    groupPlayers.find((gp) => gp.player.id === pid)?.player.name || "Jugador desconocido";

  return (
    <div className="space-y-6">
      {/* Tabs por estados */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Todos los grupos</TabsTrigger>
          <TabsTrigger value="pending">Sin fecha ({stats?.pendingDates || 0})</TabsTrigger>
          <TabsTrigger value="scheduled">Programados ({stats?.scheduledMatches || 0})</TabsTrigger>
          <TabsTrigger value="completed">Completados ({stats?.completedMatches || 0})</TabsTrigger>
        </TabsList>

        {/* Render genérico de grupos y partidos (sin filtro para simplificar) */}
        <TabsContent value="all" className="space-y-4">
          {groups.length === 0 ? (
            <div className="text-sm text-gray-500">La información de grupos se carga desde el SSR.</div>
          ) : (
            groups.map((group) => (
              <Card key={group.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Grupo {group.number} - Nivel {group.level}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {group.matches.map((match) => (
                    <div key={match.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-gray-600">Set {match.setNumber}</div>
                          <div className="text-sm font-medium">
                            {getPlayerName(group.players, match.team1Player1Id)} + {getPlayerName(group.players, match.team1Player2Id)}
                          </div>
                          <div className="text-xs text-gray-500">vs</div>
                          <div className="text-sm font-medium">
                            {getPlayerName(group.players, match.team2Player1Id)} + {getPlayerName(group.players, match.team2Player2Id)}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {/* Estado */}
                          <div className="text-right">
                            {match.isConfirmed ? (
                              <Badge className="bg-green-600">Confirmado</Badge>
                            ) : match.status === "SCHEDULED" ? (
                              <Badge variant="secondary">Programado</Badge>
                            ) : match.status === "DATE_PROPOSED" ? (
                              <Badge variant="outline">Fecha propuesta</Badge>
                            ) : (
                              <Badge variant="outline">Pendiente</Badge>
                            )}
                          </div>

                          {/* CTA para abrir el partido */}
                          <Link href={`/match/${match.id}`} className="w-full">
                            <Button className="w-full" size="sm">
                              Abrir partido
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          {/* Si quieres filtros, puedes mapear groups.flatMap(m) y filtrar por status === 'SCHEDULED' */}
          <div className="text-sm text-gray-500">Filtrado de programados pendiente de tus datos.</div>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <div className="text-sm text-gray-500">Filtrado de completados pendiente de tus datos.</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
