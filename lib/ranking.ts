// lib/ranking.ts - VERSIÓN UNIFICADA CON DESEMPATES MEJORADOS
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
  gamesLost: number;
  setWon: boolean;
};

export type PlayerTotals = {
  playerId: string;
  totalPoints: number;
  roundsPlayed: number;
  averagePoints: number;
  totalSetsWon?: number;
  totalGamesWon?: number;
  totalGamesLost?: number;
  gamesDifference?: number;
  h2hWins?: number;
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

// ✅ NUEVO: Agregar estadísticas detalladas para desempates
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
      totalGamesLost: 0,
      gamesDifference: 0,
      h2hWins: 0,
    };
    
    const totalSetsWon = (prev.totalSetsWon ?? 0) + (s.setWon ? 1 : 0);
    const totalGamesWon = (prev.totalGamesWon ?? 0) + s.gamesWon;
    const totalGamesLost = (prev.totalGamesLost ?? 0) + s.gamesLost;
    const gamesDifference = totalGamesWon - totalGamesLost;
    
    // h2hWins se maneja por separado en la lógica de matches
    const h2hWins = prev.h2hWins ?? 0;
    
    withStats.set(s.playerId, { 
      ...prev, 
      totalSetsWon, 
      totalGamesWon, 
      totalGamesLost,
      gamesDifference,
      h2hWins
    });
  }
  return withStats;
}

// ✅ NUEVO: Comparador unificado de desempates
function comparePlayersWithUnifiedTiebreakers(a: PlayerTotals, b: PlayerTotals): number {
  // Para ranking oficial: usar averagePoints
  // Para ranking ironman: usar totalPoints
  // Esta función sirve para ambos según qué campo se use como primario
  
  // 1. Campo principal ya comparado antes de llegar aquí
  
  // 2. Sets ganados (descendente)
  if ((b.totalSetsWon ?? 0) !== (a.totalSetsWon ?? 0)) {
    return (b.totalSetsWon ?? 0) - (a.totalSetsWon ?? 0);
  }
  
  // 3. Diferencia de juegos (descendente)
  if ((b.gamesDifference ?? 0) !== (a.gamesDifference ?? 0)) {
    return (b.gamesDifference ?? 0) - (a.gamesDifference ?? 0);
  }
  
  // 4. Head-to-head wins (descendente)
  if ((b.h2hWins ?? 0) !== (a.h2hWins ?? 0)) {
    return (b.h2hWins ?? 0) - (a.h2hWins ?? 0);
  }
  
  // 5. Juegos ganados totales (descendente)
  if ((b.totalGamesWon ?? 0) !== (a.totalGamesWon ?? 0)) {
    return (b.totalGamesWon ?? 0) - (a.totalGamesWon ?? 0);
  }
  
  // 6. Rondas jugadas (más rondas = mejor para casos límite)
  if (b.roundsPlayed !== a.roundsPlayed) {
    return b.roundsPlayed - a.roundsPlayed;
  }
  
  // 7. Desempate final por ID (alfabético)
  return a.playerId.localeCompare(b.playerId);
}

// ✅ MEJORADO: Ranking Ironman con desempates unificados
export function getIronmanRanking(totals: Map<string, PlayerTotals>): RankingRow[] {
  return [...totals.values()].sort((a, b) => {
    // 1. Puntos totales (descendente) - criterio primario para Ironman
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    
    // 2-6. Desempates unificados
    return comparePlayersWithUnifiedTiebreakers(a, b);
  });
}

// ✅ MEJORADO: Ranking Oficial con desempates unificados
export function getOfficialRanking(totals: Map<string, PlayerTotals>): RankingRow[] {
  return [...totals.values()].sort((a, b) => {
    // 1. Media de puntos (descendente) - criterio primario para Oficial
    if (b.averagePoints !== a.averagePoints) {
      return b.averagePoints - a.averagePoints;
    }
    
    // 2-6. Desempates unificados
    return comparePlayersWithUnifiedTiebreakers(a, b);
  });
}

// ✅ NUEVO: Función para calcular head-to-head wins
export function calculateH2HWins(
  playerId: string, 
  matches: Array<{
    team1Player1Id: string;
    team1Player2Id: string;
    team2Player1Id: string;
    team2Player2Id: string;
    team1Games: number;
    team2Games: number;
    isConfirmed: boolean;
  }>
): number {
  let h2hWins = 0;
  
  for (const match of matches) {
    if (!match.isConfirmed) continue;
    
    const isInTeam1 = [match.team1Player1Id, match.team1Player2Id].includes(playerId);
    const isInTeam2 = [match.team2Player1Id, match.team2Player2Id].includes(playerId);
    
    if (isInTeam1 && match.team1Games > match.team2Games) {
      h2hWins++;
    } else if (isInTeam2 && match.team2Games > match.team1Games) {
      h2hWins++;
    }
  }
  
  return h2hWins;
}

// ✅ MEJORADO: Builder principal con todas las estadísticas
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

// ✅ NUEVO: Función para recalcular rankings con toda la información
export async function recomputeRankingsTx(
  tx: any, // Prisma transaction client
  tournamentId: string,
  roundNumber: number,
  data: { 
    roundPoints: PlayerRoundPoints[]; 
    setStats?: PlayerSetStat[];
    matches?: Array<{
      playerId: string;
      team1Player1Id: string;
      team1Player2Id: string;
      team2Player1Id: string;
      team2Player2Id: string;
      team1Games: number;
      team2Games: number;
      isConfirmed: boolean;
    }>;
  },
): Promise<void> {
  // Calcular rankings
  const rankings = buildRankings(data.roundPoints, data.setStats);
  
  // Calcular h2h wins si hay matches
  const h2hWinsMap = new Map<string, number>();
  if (data.matches) {
    const playerIds = new Set(data.roundPoints.map(rp => rp.playerId));
    for (const playerId of playerIds) {
      h2hWinsMap.set(playerId, calculateH2HWins(playerId, data.matches));
    }
  }
  
  // Persistir en base de datos
  for (let i = 0; i < rankings.official.length; i++) {
    const player = rankings.official[i];
    const ironmanPos = rankings.ironman.findIndex(p => p.playerId === player.playerId) + 1;
    
    await tx.ranking.upsert({
      where: {
        tournamentId_playerId_roundNumber: {
          tournamentId,
          playerId: player.playerId,
          roundNumber,
        },
      },
      update: {
        totalPoints: player.totalPoints,
        roundsPlayed: player.roundsPlayed,
        averagePoints: player.averagePoints,
        position: i + 1,
        ironmanPosition: ironmanPos,
        movement: 'updated', // Puede mejorarse con lógica de movimiento
      },
      create: {
        tournamentId,
        playerId: player.playerId,
        roundNumber,
        totalPoints: player.totalPoints,
        roundsPlayed: player.roundsPlayed,
        averagePoints: player.averagePoints,
        position: i + 1,
        ironmanPosition: ironmanPos,
        movement: 'new',
      },
    });
  }
}

// ✅ NUEVO: Utilidad para debug de desempates
export function debugTiebreaker(players: PlayerTotals[], field: 'official' | 'ironman' = 'official') {
  console.log(`\n🔍 DEBUG DESEMPATES - Ranking ${field.toUpperCase()}`);
  console.log("=============================================");
  
  const sorted = field === 'official' 
    ? getOfficialRanking(new Map(players.map(p => [p.playerId, p])))
    : getIronmanRanking(new Map(players.map(p => [p.playerId, p])));
    
  sorted.forEach((player, index) => {
    console.log(`${index + 1}. ${player.playerId}:`);
    console.log(`   ${field === 'official' ? 'Media' : 'Total'}: ${field === 'official' ? player.averagePoints.toFixed(2) : player.totalPoints.toFixed(1)}`);
    console.log(`   Sets: ${player.totalSetsWon || 0} | Dif: ${player.gamesDifference || 0} | H2H: ${player.h2hWins || 0} | Juegos: ${player.totalGamesWon || 0}`);
    console.log(`   Rondas: ${player.roundsPlayed}`);
    console.log("");
  });
}

export default {
  toRoundPointsRespectingComodin,
  accumulateFromRoundPoints,
  addSetGameAggregates,
  getIronmanRanking,
  getOfficialRanking,
  buildRankings,
  recomputeRankingsTx,
  calculateH2HWins,
  debugTiebreaker,
};