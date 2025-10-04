// lib/points-calculator.ts - VERSIÓN COMPLETA CON PUNTOS TÉCNICOS
import { prisma } from "./prisma";
import { GroupStatus } from "@prisma/client";

export type PointsPreview = {
  playerId: string;
  playerName: string;
  currentPoints: number;
  provisionalPoints: number;
  deltaPoints: number;
  setsWon: number;
  setsPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDifference: number;
  h2hWins: number;
  headToHeadRecord?: {
    wins: number;
    losses: number;
  };
  currentPosition: number;
  provisionalPosition: number;
  deltaPosition: number;
  streak: number;
  usedComodin: boolean;
  movement: {
    type: 'up' | 'down' | 'same';
    groups: number;
    description: string;
  };
  tiebreakInfo?: {
    criteria: string[];
    values: (string | number)[];
  };
};

export type GroupPointsPreview = {
  groupId: string;
  groupNumber: number;
  groupLevel: number;
  completedSets: number;
  totalSets: number;
  pendingSets: number;
  completionRate: number;
  isComplete: boolean;
  players: PointsPreview[];
  movements: Record<string, PointsPreview['movement']>;
  ladderInfo: {
    isTopGroup: boolean;
    isBottomGroup: boolean;
    totalGroups: number;
  };
  lastUpdated: string;
};

// Función para calcular head-to-head entre dos jugadores específicos
function calculateDirectH2H(playerId1: string, playerId2: string, matches: any[]): number {
  let player1Wins = 0;
  
  for (const match of matches) {
    if (!match.isConfirmed) continue;
    
    const p1InTeam1 = [match.team1Player1Id, match.team1Player2Id].includes(playerId1);
    const p1InTeam2 = [match.team2Player1Id, match.team2Player2Id].includes(playerId1);
    const p2InTeam1 = [match.team1Player1Id, match.team1Player2Id].includes(playerId2);
    const p2InTeam2 = [match.team2Player1Id, match.team2Player2Id].includes(playerId2);
    
    if ((p1InTeam1 && p2InTeam2) || (p1InTeam2 && p2InTeam1)) {
      const team1Won = (match.team1Games || 0) > (match.team2Games || 0);
      if ((p1InTeam1 && team1Won) || (p1InTeam2 && !team1Won)) {
        player1Wins++;
      }
    }
  }
  
  return player1Wins;
}

// Función para calcular estadísticas de un jugador
function calculatePlayerStats(playerId: string, matches: any[]) {
  let setsWon = 0;
  let gamesWon = 0;
  let gamesLost = 0;
  let h2hWins = 0;
  let totalSetsPlayed = 0;
  
  for (const match of matches) {
    const isInTeam1 = [match.team1Player1Id, match.team1Player2Id].includes(playerId);
    const isInTeam2 = [match.team2Player1Id, match.team2Player2Id].includes(playerId);
    
    if (isInTeam1 || isInTeam2) {
      totalSetsPlayed++;
    }
    
    if (!match.isConfirmed) continue;
    
    if (isInTeam1) {
      gamesWon += match.team1Games || 0;
      gamesLost += match.team2Games || 0;
      if ((match.team1Games || 0) > (match.team2Games || 0)) {
        setsWon++;
        h2hWins++;
      }
    } else if (isInTeam2) {
      gamesWon += match.team2Games || 0;
      gamesLost += match.team1Games || 0;
      if ((match.team2Games || 0) > (match.team1Games || 0)) {
        setsWon++;
        h2hWins++;
      }
    }
  }
  
  return { 
    setsWon, 
    setsPlayed: totalSetsPlayed,
    gamesWon, 
    gamesLost, 
    gamesDifference: gamesWon - gamesLost,
    h2hWins 
  };
}

// Función para determinar movimiento de escalera
function calculateLadderMovement(
  position: number, 
  groupLevel: number, 
  totalGroups: number = 10
): { type: 'up' | 'down' | 'same'; groups: number; description: string } {
  const isTopGroup = groupLevel === 1;
  const isBottomGroup = groupLevel === totalGroups;
  const isSecondGroup = groupLevel === 2;
  const isPenultimateGroup = groupLevel === totalGroups - 1;
  
  switch (position) {
    case 1:
      if (isTopGroup) {
        return { type: 'same', groups: 0, description: 'Se mantiene en grupo élite' };
      } else if (isSecondGroup) {
        return { type: 'up', groups: 1, description: 'Sube al grupo élite' };
      } else {
        return { type: 'up', groups: 2, description: 'Sube 2 grupos' };
      }
    
    case 2:
      if (isTopGroup) {
        return { type: 'same', groups: 0, description: 'Se mantiene en grupo élite' };
      } else {
        return { type: 'up', groups: 1, description: 'Sube 1 grupo' };
      }
    
    case 3:
      if (isBottomGroup) {
        return { type: 'same', groups: 0, description: 'Se mantiene en grupo inferior' };
      } else {
        return { type: 'down', groups: 1, description: 'Baja 1 grupo' };
      }
    
    case 4:
      if (isBottomGroup) {
        return { type: 'same', groups: 0, description: 'Se mantiene en grupo inferior' };
      } else if (isPenultimateGroup) {
        return { type: 'down', groups: 1, description: 'Baja al grupo inferior' };
      } else {
        return { type: 'down', groups: 2, description: 'Baja 2 grupos' };
      }
    
    default:
      return { type: 'same', groups: 0, description: 'Se mantiene' };
  }
}

// Función de comparación mejorada con desempates
function comparePlayersWithTiebreakers(a: any, b: any): number {
  if (a.provisionalPoints !== b.provisionalPoints) {
    return b.provisionalPoints - a.provisionalPoints;
  }
  
  if (a.setsWon !== b.setsWon) {
    return b.setsWon - a.setsWon;
  }
  
  if (a.gamesDifference !== b.gamesDifference) {
    return b.gamesDifference - a.gamesDifference;
  }
  
  if (a.h2hWins !== b.h2hWins) {
    return b.h2hWins - a.h2hWins;
  }
  
  if (a.gamesWon !== b.gamesWon) {
    return b.gamesWon - a.gamesWon;
  }
  
  return 0;
}

// Función principal para obtener preview de puntos
export async function getGroupPointsPreview(groupId: string): Promise<GroupPointsPreview> {
  console.log(`Calculando preview de puntos para grupo: ${groupId}`);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      round: {
        include: {
          tournament: {
            select: {
              continuityEnabled: true,
              continuityPointsPerSet: true,
              continuityPointsPerRound: true,
              continuityMinRounds: true,
              continuityMaxBonus: true,
              continuityMode: true,
            }
          }
        }
      },
      players: {
        include: {
          player: {
            include: {
              user: { select: { name: true } }
            }
          }
        },
        orderBy: { position: 'asc' }
      },
      matches: {
        orderBy: { setNumber: 'asc' }
      }
    }
  });

  if (!group) {
    throw new Error("Grupo no encontrado");
  }

  const completedSets = group.matches.filter(m => m.isConfirmed).length;
  const totalSets = group.matches.length;
  const pendingSets = totalSets - completedSets;
  const completionRate = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  const totalGroupsInTournament = await prisma.group.count({
    where: { round: { tournamentId: group.round.tournamentId, isClosed: false } }
  });

  const ladderInfo = {
    isTopGroup: group.level === 1,
    isBottomGroup: group.level === totalGroupsInTournament,
    totalGroups: totalGroupsInTournament
  };
  
  const playersPreview: PointsPreview[] = group.players.map(groupPlayer => {
    const stats = calculatePlayerStats(groupPlayer.playerId, group.matches);
    
    const currentPoints = groupPlayer.points || 0;
    let provisionalPoints = currentPoints;
    
    const pendingPoints = stats.setsWon * 1.0;
    provisionalPoints = Math.max(currentPoints, pendingPoints);
    
    if (group.round.tournament.continuityEnabled && groupPlayer.streak > 0) {
      const streakBonus = Math.min(
        groupPlayer.streak * (group.round.tournament.continuityPointsPerSet || 1),
        group.round.tournament.continuityMaxBonus || 10
      );
      provisionalPoints += streakBonus;
    }

    const deltaPoints = provisionalPoints - currentPoints;

    return {
      playerId: groupPlayer.playerId,
      playerName: groupPlayer.player.name,
      currentPoints,
      provisionalPoints,
      deltaPoints,
      setsWon: stats.setsWon,
      setsPlayed: stats.setsPlayed,
      gamesWon: stats.gamesWon,
      gamesLost: stats.gamesLost,
      gamesDifference: stats.gamesDifference,
      h2hWins: stats.h2hWins,
      headToHeadRecord: {
        wins: stats.h2hWins,
        losses: stats.setsPlayed - stats.setsWon
      },
      currentPosition: groupPlayer.position,
      provisionalPosition: 0,
      deltaPosition: 0,
      streak: groupPlayer.streak,
      usedComodin: groupPlayer.usedComodin,
      movement: { type: 'same', groups: 0, description: '' },
      tiebreakInfo: {
        criteria: ['Puntos', 'Sets', 'Dif. Juegos', 'H2H', 'Juegos'],
        values: [provisionalPoints, stats.setsWon, stats.gamesDifference, stats.h2hWins, stats.gamesWon]
      }
    };
  });

  for (let i = 0; i < playersPreview.length; i++) {
    for (let j = i + 1; j < playersPreview.length; j++) {
      const playerA = playersPreview[i];
      const playerB = playersPreview[j];
      
      if (playerA.provisionalPoints === playerB.provisionalPoints && 
          playerA.setsWon === playerB.setsWon) {
        const directH2H = calculateDirectH2H(playerA.playerId, playerB.playerId, group.matches);
        
        if (directH2H > 0) {
          playerA.tiebreakInfo!.criteria.push('H2H Directo');
          playerA.tiebreakInfo!.values.push(`${directH2H}-${0}`);
          playerB.tiebreakInfo!.criteria.push('H2H Directo');
          playerB.tiebreakInfo!.values.push(`${0}-${directH2H}`);
        }
      }
    }
  }

  playersPreview.sort(comparePlayersWithTiebreakers);

  const movements: Record<string, PointsPreview['movement']> = {};

  playersPreview.forEach((player, index) => {
    const provisionalPosition = index + 1;
    player.provisionalPosition = provisionalPosition;
    player.deltaPosition = player.currentPosition - provisionalPosition;
    player.movement = calculateLadderMovement(
      provisionalPosition, 
      group.level, 
      totalGroupsInTournament
    );
    
    movements[player.playerId] = player.movement;
  });

  console.log(`Preview calculado: ${playersPreview.length} jugadores, ${completionRate.toFixed(1)}% completado`);

  return {
    groupId,
    groupNumber: group.number,
    groupLevel: group.level,
    completedSets,
    totalSets,
    pendingSets,
    completionRate: Math.round(completionRate),
    isComplete: completionRate === 100,
    players: playersPreview,
    movements,
    ladderInfo,
    lastUpdated: new Date().toISOString()
  };
}

export async function getPlayerPointsPreview(
  groupId: string, 
  playerId: string
): Promise<PointsPreview | null> {
  const groupPreview = await getGroupPointsPreview(groupId);
  return groupPreview.players.find(p => p.playerId === playerId) || null;
}

export async function getGroupStats(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      matches: { select: { isConfirmed: true } },
      players: { select: { id: true } }
    }
  });

  if (!group) {
    throw new Error("Grupo no encontrado");
  }

  const completedSets = group.matches.filter(m => m.isConfirmed).length;
  const totalSets = group.matches.length;
  
  return {
    completionRate: totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0,
    completedSets,
    totalSets,
    playersCount: group.players.length,
    hasRecentChanges: false
  };
}

export async function validateGroupIntegrity(groupId: string): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      players: { include: { player: true } },
      matches: true
    }
  });

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!group) {
    errors.push("Grupo no encontrado");
    return { isValid: false, errors, warnings };
  }

  if (group.players.length !== 4) {
    errors.push(`Grupo debe tener exactamente 4 jugadores, tiene ${group.players.length}`);
  }

  if (group.matches.length !== 3) {
    errors.push(`Grupo debe tener exactamente 3 sets, tiene ${group.matches.length}`);
  }

  const positions = group.players.map(p => p.position).sort();
  const expectedPositions = [1, 2, 3, 4];
  if (JSON.stringify(positions) !== JSON.stringify(expectedPositions)) {
    errors.push("Las posiciones de los jugadores no son únicas o están fuera de rango");
  }

  for (const match of group.matches) {
    const playersInMatch = [
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id
    ].filter(Boolean);

    const uniquePlayers = new Set(playersInMatch);
    if (uniquePlayers.size !== 4) {
      warnings.push(`Set ${match.setNumber} no tiene exactamente 4 jugadores únicos`);
    }

    const groupPlayerIds = group.players.map(p => p.playerId);
    for (const playerId of groupPlayerIds) {
      if (!playersInMatch.includes(playerId)) {
        warnings.push(`Jugador ${playerId} no participa en set ${match.setNumber}`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ======================================================================
// ✅ NUEVO: FUNCIONES PARA PUNTOS TÉCNICOS (GRUPOS SKIPPED)
// ======================================================================

/**
 * Calcula puntos técnicos para grupos SKIPPED
 * R1-R2: 50% de la media de la jornada
 * R≥3: 50% de la media personal del jugador
 */
export async function calculateTechnicalPoints(
  roundId: string,
  roundNumber: number
): Promise<Map<string, number>> {
  const technicalPoints = new Map<string, number>();

  if (roundNumber <= 2) {
    // R1-R2: 50% de la media de la jornada
    const playedGroups = await prisma.group.findMany({
      where: { 
        roundId,
        status: GroupStatus.PLAYED
      },
      include: {
        players: {
          select: { points: true }
        }
      }
    });

    if (playedGroups.length === 0) {
      console.log('⚠️ No hay grupos PLAYED en esta ronda, puntos técnicos = 0');
      return technicalPoints;
    }

    const totalPoints = playedGroups.reduce((sum, group) => {
      return sum + group.players.reduce((gSum: number, p: any) => gSum + p.points, 0);
    }, 0);

    const totalPlayers = playedGroups.reduce((sum, group) => sum + group.players.length, 0);
    const averagePoints = totalPlayers > 0 ? totalPoints / totalPlayers : 0;
    const technicalValue = Math.round((averagePoints * 0.5) * 10) / 10; // 50% penalización

    console.log(`💰 Puntos técnicos R${roundNumber}: ${technicalValue} (50% de ${averagePoints.toFixed(1)})`);

    const skippedGroups = await prisma.group.findMany({
      where: {
        roundId,
        status: GroupStatus.SKIPPED
      },
      include: {
        players: {
          select: { playerId: true }
        }
      }
    });

    for (const group of skippedGroups) {
      for (const player of group.players) {
        technicalPoints.set(player.playerId, technicalValue);
      }
    }

  } else {
    // R≥3: 50% de la media personal
    const skippedGroups = await prisma.group.findMany({
      where: {
        roundId,
        status: GroupStatus.SKIPPED
      },
      include: {
        players: true,
        round: {
          select: {
            tournamentId: true
          }
        }
      }
    });

    for (const group of skippedGroups) {
      for (const gp of group.players) {
        const previousRounds = await prisma.groupPlayer.findMany({
          where: {
            playerId: gp.playerId,
            usedComodin: false,
            group: {
              round: {
                tournamentId: group.round.tournamentId,
                number: { lt: roundNumber },
                isClosed: true
              },
              status: GroupStatus.PLAYED
            }
          },
          select: { points: true }
        });

        if (previousRounds.length === 0) {
          technicalPoints.set(gp.playerId, 0);
          console.log(`⚠️ Jugador ${gp.playerId} sin historial, puntos técnicos = 0`);
          continue;
        }

        const totalPoints = previousRounds.reduce((sum: number, r: any) => sum + r.points, 0);
        const averagePoints = totalPoints / previousRounds.length;
        const technicalValue = Math.round((averagePoints * 0.5) * 10) / 10; // 50% penalización

        technicalPoints.set(gp.playerId, technicalValue);
        console.log(`💰 Jugador ${gp.playerId}: ${technicalValue} pts técnicos (50% de ${averagePoints.toFixed(1)})`);
      }
    }
  }

  return technicalPoints;
}

/**
 * Aplica puntos técnicos a jugadores de grupos SKIPPED
 */
export async function applyTechnicalPoints(
  roundId: string,
  roundNumber: number
): Promise<void> {
  const technicalPoints = await calculateTechnicalPoints(roundId, roundNumber);

  if (technicalPoints.size === 0) {
    console.log('ℹ️ No hay puntos técnicos que aplicar');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const [playerId, points] of technicalPoints.entries()) {
      const groupPlayer = await tx.groupPlayer.findFirst({
        where: {
          playerId,
          group: {
            roundId,
            status: GroupStatus.SKIPPED
          }
        }
      });

      if (groupPlayer) {
        await tx.groupPlayer.update({
          where: { id: groupPlayer.id },
          data: {
            points,
            streak: 0, // Rompe racha
            locked: true // Bloquea movimientos
          }
        });

        // Registrar ruptura de racha
        await tx.streakHistory.create({
          data: {
            playerId,
            roundId,
            groupId: groupPlayer.groupId,
            streakType: 'BROKEN_NO_PLAY',
            streakCount: 0,
            bonusPoints: 0
          }
        });
      }
    }
  });

  console.log(`✅ Puntos técnicos aplicados a ${technicalPoints.size} jugadores`);
}

export { getGroupPointsPreview as calculateGroupPointsPreview };