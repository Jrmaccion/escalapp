// lib/ranking.ts - REEMPLAZAR completamente:
import { prisma } from "@/lib/prisma";

export async function getTournamentRanking(tournamentId: string, upToRound?: number) {
  const where: any = { tournamentId };
  if (typeof upToRound === "number") where.roundNumber = upToRound;

  if (upToRound == null) {
    const last = await prisma.ranking.findFirst({
      where: { tournamentId },
      orderBy: [{ roundNumber: "desc" }, { position: "asc" }],
    });
    if (!last) return [];
    const lastRound = last.roundNumber;
    return prisma.ranking.findMany({
      where: { tournamentId, roundNumber: lastRound },
      orderBy: { position: "asc" },
    });
  }

  return prisma.ranking.findMany({
    where,
    orderBy: { position: "asc" },
  });
}

export async function recalcRankingForRound(tournamentId: string, roundNumber: number) {
  const tPlayers = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    include: { player: true },
  });

  const resultsByPlayer = new Map<string, number>();

  for (const tp of tPlayers) {
    const ptsAgg = await prisma.matchResult.aggregate({
      _sum: { points: true },
      where: {
        playerId: tp.playerId,
        matchId: { // CAMBIAR: usar matchId en lugar de match
          in: await prisma.match.findMany({
            where: {
              group: { round: { tournamentId, number: roundNumber } }
            },
            select: { id: true }
          }).then(matches => matches.map(m => m.id))
        }
      },
    });
    resultsByPlayer.set(tp.playerId, (ptsAgg._sum?.points ?? 0) as number); // CAMBIAR: agregar ?
  }

  const totalByPlayer = new Map<string, number>();
  for (const tp of tPlayers) {
    const matchIds = await prisma.match.findMany({
      where: {
        group: { round: { tournamentId, number: { lte: roundNumber } } }
      },
      select: { id: true }
    }).then(matches => matches.map(m => m.id));

    const agg = await prisma.matchResult.aggregate({
      _sum: { points: true },
      where: {
        playerId: tp.playerId,
        matchId: { in: matchIds } // CAMBIAR: usar matchId
      },
    });
    totalByPlayer.set(tp.playerId, (agg._sum?.points ?? 0) as number); // CAMBIAR: agregar ?
  }

  const sorted = [...totalByPlayer.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([playerId, totalPoints], idx) => ({
      playerId,
      totalPoints,
      position: idx + 1,
    }));

  await prisma.$transaction(async (tx) => {
    await tx.ranking.deleteMany({ where: { tournamentId, roundNumber } });
    for (const row of sorted) {
      await tx.ranking.create({
        data: {
          tournamentId,
          playerId: row.playerId,
          roundNumber,
          totalPoints: row.totalPoints,
          roundsPlayed: 0,
          averagePoints: 0,
          position: row.position,
          ironmanPosition: 0,
          movement: "",
        },
      });
    }
  });

  return sorted;
}