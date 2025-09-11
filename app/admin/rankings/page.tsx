import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import RankingsClient from "./RankingsClient";

export const metadata: Metadata = {
  title: "Rankings | PadelRise (Admin)",
  description: "Clasificaciones y ranking del torneo",
};

type RankingRow = {
  playerId: string;
  position: number | null;
  totalPoints: any;
  roundsPlayed: any;
  averagePoints: any;
  ironmanPosition: any;
  movement: string | null;
};

type StatsRow = {
  playerId: string;
  playerName: string;
  position: number;
  totalPoints: number;
  roundsPlayed: number;
  averagePoints: number;
  ironmanPosition: number;
  movement: "up" | "down" | "stable" | "new";
};

async function pickTournamentId(preferredId?: string) {
  if (preferredId) {
    const t = await prisma.tournament.findUnique({ where: { id: preferredId } });
    if (t) return t.id;
  }
  const active = await prisma.tournament.findFirst({ where: { isActive: true } });
  if (active) {
    const rankCount = await prisma.ranking.count({ where: { tournamentId: active.id } });
    const hasResults = await prisma.match.count({
      where: { isConfirmed: true, group: { round: { tournamentId: active.id } } },
    });
    if (rankCount > 0 || hasResults > 0) return active.id;
  }
  const tournaments = await prisma.tournament.findMany({ orderBy: { startDate: "desc" }, take: 5 });
  for (const t of tournaments) {
    const rankCount = await prisma.ranking.count({ where: { tournamentId: t.id } });
    if (rankCount > 0) return t.id;
    const hasResults = await prisma.match.count({
      where: { isConfirmed: true, group: { round: { tournamentId: t.id } } },
    });
    if (hasResults > 0) return t.id;
  }
  if (active) return active.id;
  const latest = await prisma.tournament.findFirst({ orderBy: { startDate: "desc" } });
  return latest?.id ?? null;
}

export default async function AdminRankingsPage({
  searchParams,
}: {
  searchParams?: { tournamentId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  const tournamentId = await pickTournamentId(searchParams?.tournamentId);
  if (!tournamentId) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="text-2xl font-bold mb-4">No hay torneos</h1>
          <p className="text-gray-600">Crea un torneo para ver los rankings.</p>
        </div>
      </div>
    );
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      rounds: { orderBy: { number: "desc" }, select: { id: true, number: true, isClosed: true } },
    },
  });
  if (!tournament) redirect("/admin");

  const latestClosed = tournament.rounds.find((r) => r.isClosed);
  const referenceRound = latestClosed ?? tournament.rounds[0];
  const refRoundNumber = referenceRound?.number ?? 1;

  // 1) Ranking persistido
  const persisted = (await prisma.ranking.findMany({
    where: { tournamentId: tournament.id, roundNumber: refRoundNumber },
    orderBy: { position: "asc" },
  })) as unknown as RankingRow[];

  let playersWithStats: StatsRow[] = [];

  if (persisted.length > 0) {
    const players = await prisma.player.findMany({
      where: { id: { in: persisted.map((r) => r.playerId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(players.map((p) => [p.id, p.name]));

    const asNumber = (v: any) => (typeof v === "number" ? v : v ? Number(v) : 0);

    playersWithStats = persisted.map((r, i) => ({
      playerId: r.playerId,
      playerName: nameById.get(r.playerId) ?? "Jugador desconocido",
      position: r.position ?? i + 1,
      totalPoints: asNumber(r.totalPoints),
      roundsPlayed: asNumber(r.roundsPlayed),
      averagePoints: asNumber(r.averagePoints),
      ironmanPosition: asNumber(r.ironmanPosition ?? r.position ?? i + 1),
      movement: (r.movement ?? "stable") as "up" | "down" | "stable" | "new",
    }));
  } else {
    // 2) Fallback por resultados
    const confirmedMatches = await prisma.match.findMany({
      where: {
        isConfirmed: true,
        group: { round: { tournamentId: tournament.id, number: { lte: refRoundNumber } } },
      },
      select: { id: true, group: { select: { round: { select: { number: true } } } } },
    });

    const matchIds = confirmedMatches.map((m) => m.id);
    const matchIdToRoundNum = new Map<string, number>(
      confirmedMatches.map((m) => [m.id, m.group.round.number]),
    );

    const results = await prisma.matchResult.findMany({
      where: matchIds.length ? { matchId: { in: matchIds } } : { matchId: { in: [""] } },
      select: { playerId: true, points: true, matchId: true },
    });

    const pointsByPlayer = new Map<string, number>();
    const roundsSetByPlayer = new Map<string, Set<number>>();

    for (const r of results) {
      const pid = r.playerId;
      const roundNum = matchIdToRoundNum.get(r.matchId);
      const pts = typeof r.points === "number" ? r.points : Number(r.points ?? 0);
      pointsByPlayer.set(pid, (pointsByPlayer.get(pid) ?? 0) + pts);
      if (roundNum !== undefined) {
        const set = roundsSetByPlayer.get(pid) ?? new Set<number>();
        set.add(roundNum);
        roundsSetByPlayer.set(pid, set);
      }
    }

    const tPlayers = await prisma.tournamentPlayer.findMany({
      where: { tournamentId: tournament.id },
      include: { player: { select: { id: true, name: true } } },
      orderBy: { player: { name: "asc" } },
    });

    playersWithStats = tPlayers.map((tp, idx) => {
      const pid = tp.player.id;
      const totalPoints = pointsByPlayer.get(pid) ?? 0;
      const roundsPlayed = (roundsSetByPlayer.get(pid)?.size ?? 0);
      const averagePoints = roundsPlayed > 0 ? totalPoints / roundsPlayed : 0;
      return {
        playerId: pid,
        playerName: tp.player.name,
        position: idx + 1,
        totalPoints,
        roundsPlayed,
        averagePoints,
        ironmanPosition: idx + 1,
        movement: "stable",
      };
    });

    playersWithStats.sort((a, b) => {
      if (b.averagePoints !== a.averagePoints) return b.averagePoints - a.averagePoints;
      return b.totalPoints - a.totalPoints;
    });

    playersWithStats = playersWithStats.map((row, i) => ({
      ...row,
      position: i + 1,
      ironmanPosition: i + 1,
    }));
  }

  const serializedTournament = {
    id: tournament.id,
    title: tournament.title,
    currentRound: refRoundNumber,
    totalRounds: tournament.rounds[0]?.number ?? refRoundNumber,
  };

  return <RankingsClient rankings={playersWithStats} tournament={serializedTournament} />;
}
