// lib/ranking.ts
export type PlayerRoundPoints = {
  playerId: string;
  roundId: string;
  points: number;
  played: boolean;
};

export type PlayerSetStat = {
  playerId: string;
  roundId: string;
  setNumber: number;
  gamesWon: number;
  setWon: boolean;
};

export type PlayerTotals = {
  playerId: string;
  totalPoints: number;
  roundsPlayed: number;
  averagePoints: number;
  totalSetsWon?: number;
  totalGamesWon?: number;
};

export type RankingRow = PlayerTotals;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** NUEVO:
 * Forzar `played=false` cuando el jugador usó comodín.
 * Llama a esta utilidad en el sitio donde mapeas los datos de DB -> PlayerRoundPoints[].
 */
export function toRoundPointsRespectingComodin(input: {
  playerId: string;
  roundId: string;
  points: number;
  usedComodin?: boolean;
}): PlayerRoundPoints {
  return {
    playerId: input.playerId,
    roundId: input.roundId,
    points: input.points,
    played: !input.usedComodin, // comodín => no cuenta como jugada
  };
}

export function accumulateFromRoundPoints(
  entries: PlayerRoundPoints[],
): Map<string, PlayerTotals> {
  const acc = new Map<string, PlayerTotals>();
  for (const e of entries) {
    const prev = acc.get(e.playerId) ?? {
      playerId: e.playerId,
      totalPoints: 0,
      roundsPlayed: 0,
      averagePoints: 0,
    };
    const totalPoints = prev.totalPoints + e.points;
    const roundsPlayed = prev.roundsPlayed + (e.played ? 1 : 0);
    const averagePoints = roundsPlayed > 0 ? round2(totalPoints / roundsPlayed) : 0;
    acc.set(e.playerId, { ...prev, totalPoints, roundsPlayed, averagePoints });
  }
  return acc;
}

export function addSetGameAggregates(
  acc: Map<string, PlayerTotals>,
  setStats: PlayerSetStat[],
): Map<string, PlayerTotals> {
  const withStats = new Map(acc);
  for (const s of setStats) {
    const prev = withStats.get(s.playerId) ?? {
      playerId: s.playerId,
      totalPoints: 0,
      roundsPlayed: 0,
      averagePoints: 0,
      totalSetsWon: 0,
      totalGamesWon: 0,
    };
    const totalSetsWon = (prev.totalSetsWon ?? 0) + (s.setWon ? 1 : 0);
    const totalGamesWon = (prev.totalGamesWon ?? 0) + s.gamesWon;
    withStats.set(s.playerId, { ...prev, totalSetsWon, totalGamesWon });
  }
  return withStats;
}

export function getIronmanRanking(totals: Map<string, PlayerTotals>): RankingRow[] {
  return [...totals.values()].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if ((b.totalSetsWon ?? 0) !== (a.totalSetsWon ?? 0)) {
      return (b.totalSetsWon ?? 0) - (a.totalSetsWon ?? 0);
    }
    if ((b.totalGamesWon ?? 0) !== (a.totalGamesWon ?? 0)) {
      return (b.totalGamesWon ?? 0) - (a.totalGamesWon ?? 0);
    }
    if (a.roundsPlayed !== b.roundsPlayed) return a.roundsPlayed - b.roundsPlayed;
    return a.playerId.localeCompare(b.playerId);
  });
}

export function getOfficialRanking(totals: Map<string, PlayerTotals>): RankingRow[] {
  return [...totals.values()].sort((a, b) => {
    if (b.averagePoints !== a.averagePoints) return b.averagePoints - a.averagePoints;
    if (b.roundsPlayed !== a.roundsPlayed) return b.roundsPlayed - a.roundsPlayed;
    if ((b.totalSetsWon ?? 0) !== (a.totalSetsWon ?? 0)) {
      return (b.totalSetsWon ?? 0) - (a.totalSetsWon ?? 0);
    }
    if ((b.totalGamesWon ?? 0) !== (a.totalGamesWon ?? 0)) {
      return (b.totalGamesWon ?? 0) - (a.totalGamesWon ?? 0);
    }
    return a.playerId.localeCompare(b.playerId);
  });
}

export function buildRankings(
  roundPoints: PlayerRoundPoints[],
  setStats?: PlayerSetStat[],
) {
  const totals = accumulateFromRoundPoints(roundPoints);
  const totalsPlus = setStats ? addSetGameAggregates(totals, setStats) : totals;
  return {
    ironman: getIronmanRanking(totalsPlus),
    official: getOfficialRanking(totalsPlus),
    totals: totalsPlus,
  };
}

export async function recomputeRankingsTx(
  _tx: unknown,
  _roundId: string,
  _data: { roundPoints: PlayerRoundPoints[]; setStats?: PlayerSetStat[] },
): Promise<void> {
  // TODO: persistir cuando definamos los modelos de ranking
  return;
}
