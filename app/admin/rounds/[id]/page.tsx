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
import { Calendar, Users, CheckCircle, Clock, ArrowLeft, Play } from "lucide-react";
import { format, differenceInDays, isAfter, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

/** Tipos mínimos necesarios según los select/include usados en este fichero */
type PlayerLite = { id: string; name: string };

type GroupPlayerLite = {
  position: number;
  player: PlayerLite;
};

type MatchLite = {
  id: string;
  setNumber: number;
  isConfirmed: boolean;
  status: "PENDING" | "SCHEDULED" | "PLAYED" | "CONFIRMED" | string;
  proposer: { name: string } | null;
};

type GroupLite = {
  id: string;
  number: number;
  level: number | null;
  players: GroupPlayerLite[];
  matches: MatchLite[];
};

type RoundData = {
  id: string;
  number: number;
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  tournament: { id: string; title: string };
  groups: GroupLite[];
};

type EligiblePlayer = { playerId: string; name: string };

type RoundDetailPageProps = {
  params: { id: string };
};

export const metadata = {
  title: "Detalle de Ronda | Escalapp",
  description: "Vista detallada de la ronda con todos los partidos y programación",
};

async function getRoundData(roundId: string): Promise<RoundData | null> {
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

    // Cast controlado al shape que usamos aquí
    return round as unknown as RoundData | null;
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

  // 1) Jugadores elegibles (toda la ronda)
  const eligiblePlayers = (await getEligiblePlayersForRound(
    round.tournament.id,
    round.number
  )) as EligiblePlayer[];

  // 2) SIN ASIGNAR = elegibles - ya asignados en grupos
  const assignedIds = new Set<string>(
    round.groups.flatMap((g: GroupLite) =>
      g.players.map((gp: GroupPlayerLite) => gp.player.id)
    )
  );

  const unassigned = eligiblePlayers
    .filter((p: EligiblePlayer) => !assignedIds.has(p.playerId))
    .map((p: EligiblePlayer) => ({ id: p.playerId, name: p.name }));

  // Estadísticas
  const now = new Date();
  const daysToEnd = differenceInDays(round.endDate, now);
  const daysToStart = differenceInDays(round.startDate, now);

  const status: "closed" | "upcoming" | "overdue" | "active" =
    round.isClosed
      ? "closed"
      : isBefore(now, round.startDate)
      ? "upcoming"
      : isAfter(now, round.endDate)
      ? "overdue"
      : "active";

  const totalSets = round.groups.reduce<number>(
    (acc: number, group: GroupLite) => acc + group.matches.length,
    0
  );
  const totalPartidos = Math.ceil(totalSets / 3);

  const completedSets = round.groups.reduce<number>(
    (acc: number, group: GroupLite) =>
      acc + group.matches.filter((m: MatchLite) => m.isConfirmed).length,
    0
  );

  const scheduledSets = round.groups.reduce<number>(
    (acc: number, group: GroupLite) =>
      acc + group.matches.filter((m: MatchLite) => m.status === "SCHEDULED").length,
    0
  );

  // Breadcrumbs - usar array mutable
  const breadcrumbItems = [
    { label: "Inicio", href: "/dashboard" },
    { label: "Admin", href: "/admin" },
    { label: "Rondas", href: "/admin/rounds" },
    { label: `Ronda ${round.number}`, current: true },
  ];

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

      {/* Aviso si no hay elegibles */}
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
        roundId={params.id}
        roundNumber={round.number}
        tournament={{
          id: round.tournament.id,
          title: round.tournament.title,
          totalPlayers: eligiblePlayers.length,
        }}
        groups={round.groups.map((group: GroupLite) => ({
          id: group.id,
          number: group.number,
          level: group.level ?? 0,
          players: group.players.map((gp: GroupPlayerLite) => ({
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
        roundId={params.id}
        groups={round.groups.map((group: GroupLite) => ({
          id: group.id,
          number: group.number,
          level: group.level ?? 0,
          players: group.players.map((gp: GroupPlayerLite) => ({
            id: gp.player.id,
            name: gp.player.name,
            position: gp.position,
          })),
          matches: group.matches.map((m: MatchLite) => ({
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
