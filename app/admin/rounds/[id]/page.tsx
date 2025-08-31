import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Breadcrumbs from "@/components/Breadcrumbs";
import MatchGenerationPanel from "@/components/MatchGenerationPanel";
import GroupManagementPanel from "@/components/GroupManagementPanel";
import CloseRoundButton from "@/components/CloseRoundButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, CheckCircle, Clock, ArrowLeft, Play } from "lucide-react";
import { format, differenceInDays, isAfter, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

type RoundDetailPageProps = {
  params: {
    id: string;
  };
};

export const metadata = {
  title: "Detalle de Ronda | Escalapp",
  description: "Vista detallada de la ronda con todos los partidos y programación",
};

async function getRoundData(roundId: string) {
  try {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: { select: { id: true, title: true } },
        groups: {
          include: {
            players: {
              include: { player: { select: { id: true, name: true } } },
              orderBy: { position: "asc" },
            },
            matches: {
              include: { proposer: { select: { name: true } } },
              orderBy: { setNumber: "asc" },
            },
          },
          orderBy: { number: "asc" },
        },
      },
    });
    return round;
  } catch (error) {
    console.error("Error fetching round data:", error);
    return null;
  }
}

export default async function RoundDetailPage({ params }: RoundDetailPageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  const round = await getRoundData(params.id);
  if (!round) notFound();

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

  const totalSets = round.groups.reduce((acc, group) => acc + group.matches.length, 0);
  const totalPartidos = Math.ceil(totalSets / 3);
  const completedSets = round.groups.reduce(
    (acc, group) => acc + group.matches.filter((m) => m.isConfirmed).length,
    0
  );
  const scheduledSets = round.groups.reduce(
    (acc, group) => acc + group.matches.filter((m: any) => m.status === "SCHEDULED").length,
    0
  );

  // Breadcrumbs
  const breadcrumbItems = [
    { label: "Inicio", href: "/dashboard" },
    { label: "Admin", href: "/admin" },
    { label: "Rondas", href: "/admin/rounds" },
    { label: `Ronda ${round.number}`, current: true },
  ];

  const getPlayerName = (playerId: string): string => {
    for (const group of round.groups) {
      const gp = group.players.find((p) => p.player.id === playerId);
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

      {/* Panel de gestión de grupos */}
      <GroupManagementPanel
        roundId={params.id}
        roundNumber={round.number}
        tournament={{
          id: round.tournament.id,
          title: round.tournament.title,
          totalPlayers: 0,
        }}
        groups={round.groups.map((group) => ({
          id: group.id,
          number: group.number,
          level: group.level,
          players: group.players.map((gp) => ({
            id: gp.player.id,
            name: gp.player.name,
            position: gp.position,
          })),
        }))}
        availablePlayers={round.groups.reduce((acc, group) => acc + group.players.length, 0)}
        isAdmin={true}
      />

      {/* Panel de generación de partidos */}
      <MatchGenerationPanel
        roundId={params.id}
        groups={round.groups.map((group) => ({
          id: group.id,
          number: group.number,
          level: group.level,
          players: group.players.map((gp) => ({
            id: gp.player.id,
            name: gp.player.name,
            position: gp.position,
          })),
          // 👇 AÑADIMOS matches + corregimos paréntesis
          matches: group.matches.map((m) => ({
            id: m.id,
            setNumber: m.setNumber,
          })),
        }))}
        isAdmin={true}
      />

      {/* Vista global de partidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Vista General de Partidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{Math.ceil(totalSets / 3)}</div>
              <div className="text-sm text-gray-600">Partidos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{totalSets}</div>
              <div className="text-sm text-gray-600">Sets totales</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{completedSets}</div>
              <div className="text-sm text-gray-600">Sets completados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0}%
              </div>
              <div className="text-sm text-gray-600">Progreso</div>
            </div>
          </div>
          <p className="text-sm text-gray-500 text-center">
            Los detalles completos están disponibles en las secciones de arriba
          </p>
        </CardContent>
      </Card>

      {/* Listado por grupo (en bloques de 3 sets) */}
      {round.groups.map((group) => {
        const sortedMatches = [...group.matches].sort((a, b) => a.setNumber - b.setNumber);

        const matchBlocks: Array<{
          blockNumber: number;
          sets: typeof group.matches;
          players: string[];
        }> = [];

        for (let i = 0; i < sortedMatches.length; i += 3) {
          const blockSets = sortedMatches.slice(i, i + 3);
          const blockNumber = Math.floor(i / 3) + 1;

          const playerIds = new Set<string>();
          blockSets.forEach((set) => {
            playerIds.add(set.team1Player1Id);
            playerIds.add(set.team1Player2Id);
            playerIds.add(set.team2Player1Id);
            playerIds.add(set.team2Player2Id);
          });

          const players = Array.from(playerIds).map((id) => getPlayerName(id));
          matchBlocks.push({ blockNumber, sets: blockSets, players });
        }

        if (matchBlocks.length === 0) {
          return (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Grupo {group.number} - Nivel {group.level}
                  <Badge variant="outline">{group.players.length} jugadores</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No hay partidos generados para este grupo</p>
                  <p className="text-sm">Usa el panel de generación de partidos</p>
                </div>
              </CardContent>
            </Card>
          );
        }

        return (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Grupo {group.number} - Nivel {group.level}
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{group.players.length} jugadores</Badge>
                  <Badge variant="outline">
                    {matchBlocks.length} partido{matchBlocks.length > 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {matchBlocks.map((block) => {
                const completedSetsInBlock = block.sets.filter((s) => s.isConfirmed).length;
                const totalSetsInBlock = block.sets.length;
                const matchStatus =
                  completedSetsInBlock === totalSetsInBlock
                    ? "completed"
                    : completedSetsInBlock > 0
                    ? "in-progress"
                    : "pending";

                return (
                  <div key={block.blockNumber} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-lg">
                          Partido {block.blockNumber}
                          {matchBlocks.length === 1 ? "" : ` de ${matchBlocks.length}`}
                        </h4>
                        <p className="text-sm text-gray-600">Jugadores: {block.players.join(", ")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {matchStatus === "completed" && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Completado
                          </Badge>
                        )}
                        {matchStatus === "in-progress" && (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <Clock className="w-3 h-3 mr-1" />
                            En progreso ({completedSetsInBlock}/{totalSetsInBlock})
                          </Badge>
                        )}
                        {matchStatus === "pending" && (
                          <Badge variant="outline">
                            <Clock className="w-3 h-3 mr-1" />
                            Pendiente
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {block.sets.map((set, index) => {
                        const team1Score = set.team1Games ?? "-";
                        const team2Score = set.team2Games ?? "-";
                        const hasResult = set.team1Games !== null && set.team2Games !== null;

                        return (
                          <div
                            key={set.id}
                            className={`p-3 rounded border ${
                              set.isConfirmed
                                ? "bg-green-50 border-green-200"
                                : hasResult
                                ? "bg-yellow-50 border-yellow-200"
                                : "bg-gray-50 border-gray-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">Set {index + 1}</span>
                                  {set.isConfirmed && <CheckCircle className="w-4 h-4 text-green-600" />}
                                </div>

                                <div className="grid grid-cols-1 gap-1 text-sm">
                                  <div className="flex items-center justify-between">
                                    <span>
                                      {getPlayerName(set.team1Player1Id)} + {getPlayerName(set.team1Player2Id)}
                                    </span>
                                    <span className="font-bold text-lg">{team1Score}</span>
                                  </div>

                                  <div className="text-center text-xs text-gray-500">vs</div>

                                  <div className="flex items-center justify-between">
                                    <span>
                                      {getPlayerName(set.team2Player1Id)} + {getPlayerName(set.team2Player2Id)}
                                    </span>
                                    <span className="font-bold text-lg">{team2Score}</span>
                                  </div>
                                </div>

                                {set.tiebreakScore && (
                                  <div className="text-xs text-blue-600 mt-1">Tie-break: {set.tiebreakScore}</div>
                                )}
                              </div>

                              <div className="ml-4">
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/match/${set.id}`}>
                                    {hasResult ? "Ver resultado" : "Introducir resultado"}
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

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

              {/* Botón que hace POST al endpoint real */}
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
