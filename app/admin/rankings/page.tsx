import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import RankingsClient from "./RankingsClient";

export const metadata: Metadata = {
  title: "Rankings | Escalapp",
  description: "Clasificaciones y ranking del torneo",
};

// Tipos ligeros usados en los filtros/cálculos
type TournamentLinkLite = { tournamentId: string };
type GroupPlayerLite = {
  points: number;
  group: { round: { id: string; number: number; tournamentId: string } };
};
type PlayerForStats = {
  id: string;
  name: string;
  tournaments: TournamentLinkLite[];
  groupPlayers: GroupPlayerLite[];
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

export default async function AdminRankingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  // Obtener torneo activo + rondas
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    include: {
      rounds: {
        orderBy: { number: "desc" },
      },
    },
  });

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="text-2xl font-bold mb-4">No hay torneo activo</h1>
          <p className="text-gray-600">Crea un torneo para ver los rankings.</p>
        </div>
      </div>
    );
  }

  // Ronda más reciente (si no hay, usamos 1 por compatibilidad)
  const latestRound = tournament.rounds[0];

  // Rankings almacenados (si existen)
  const rankings = await prisma.ranking.findMany({
    where: {
      tournamentId: tournament.id,
      roundNumber: latestRound?.number || 1,
    },
    orderBy: [{ position: "asc" }],
  });

  let playersWithStats: StatsRow[] = [];

  if (rankings.length === 0) {
    // ---- Calcular estadísticas manualmente ----
    const playersDb = (await prisma.player.findMany({
      include: {
        tournaments: {
          where: { tournamentId: tournament.id },
          select: { tournamentId: true },
        },
        groupPlayers: {
          select: {
            points: true,
            group: { select: { round: { select: { id: true, number: true, tournamentId: true } } } },
          },
        },
      },
      orderBy: { name: "asc" },
    })) as unknown as PlayerForStats[];

    // Filtrar inscritos en este torneo (tipamos el array, no el parámetro del callback)
    const tournamentPlayers = (playersDb as PlayerForStats[]).filter((p) =>
      p.tournaments.some((tp) => tp.tournamentId === tournament.id)
    );

    playersWithStats = await Promise.all(
      (tournamentPlayers as PlayerForStats[]).map(async (p, index) => {
        // Partidos confirmados en los que participa (4 consultas; se puede optimizar más adelante)
        const matchesAsTeam1Player1 = await prisma.match.count({
          where: { team1Player1Id: p.id, isConfirmed: true },
        });
        const matchesAsTeam1Player2 = await prisma.match.count({
          where: { team1Player2Id: p.id, isConfirmed: true },
        });
        const matchesAsTeam2Player1 = await prisma.match.count({
          where: { team2Player1Id: p.id, isConfirmed: true },
        });
        const matchesAsTeam2Player2 = await prisma.match.count({
          where: { team2Player2Id: p.id, isConfirmed: true },
        });

        const totalMatches =
          matchesAsTeam1Player1 +
          matchesAsTeam1Player2 +
          matchesAsTeam2Player1 +
          matchesAsTeam2Player2;

        // Puntos acumulados desde GroupPlayer
        const totalPoints = p.groupPlayers.reduce((acc, gp) => acc + (gp.points ?? 0), 0);
        const roundsPlayed = p.groupPlayers.length;
        const averagePoints = totalMatches > 0 ? totalPoints / totalMatches : 0;

        return {
          playerId: p.id,
          playerName: p.name,
          position: index + 1, // se recalcula tras ordenar
          totalPoints,
          roundsPlayed,
          averagePoints,
          ironmanPosition: index + 1,
          movement: "stable",
        } as StatsRow;
      })
    );

    // Ordenar por puntos totales y reasignar posición
    playersWithStats.sort((a, b) => b.totalPoints - a.totalPoints);
    playersWithStats = playersWithStats.map((row, idx) => ({
      ...row,
      position: idx + 1,
    }));
  } else {
    // ---- Usar rankings persistidos ----
    playersWithStats = await Promise.all(
      rankings.map(async (r) => {
        const player = await prisma.player.findUnique({
          where: { id: r.playerId },
          select: { name: true },
        });

        return {
          playerId: r.playerId,
          playerName: player?.name || "Jugador desconocido",
          position: r.position,
          totalPoints: r.totalPoints,
          roundsPlayed: r.roundsPlayed,
          averagePoints: r.averagePoints,
          ironmanPosition: r.ironmanPosition,
          movement: (r.movement as "up" | "down" | "stable" | "new") ?? "stable",
        } as StatsRow;
      })
    );
  }

  const serializedTournament = {
    id: tournament.id,
    title: tournament.title,
    currentRound: latestRound?.number || 1,
    totalRounds: tournament.totalRounds,
  };

  return <RankingsClient rankings={playersWithStats} tournament={serializedTournament} />;
}
