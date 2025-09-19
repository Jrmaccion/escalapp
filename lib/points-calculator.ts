// lib/points-calculator.ts - CORREGIDO CON TIPOS ACTUALIZADOS
import { prisma } from "./prisma";

export type PointsPreview = {
  playerId: string;
  playerName: string;
  currentPoints: number;
  provisionalPoints: number; // ✅ CORREGIDO: proyectado -> provisional
  deltaPoints: number; // ✅ AGREGADO
  setsWon: number;
  setsPlayed: number; // ✅ CORREGIDO: setsTotal -> setsPlayed
  gamesWon: number;
  gamesLost: number;
  gamesDifference: number;
  h2hWins: number;
  headToHeadRecord?: { // ✅ AGREGADO
    wins: number;
    losses: number;
  };
  currentPosition: number;
  provisionalPosition: number; // ✅ CORREGIDO: proyectado -> provisional
  deltaPosition: number; // ✅ AGREGADO: cambio de posición
  streak: number; // ✅ AGREGADO
  usedComodin: boolean; // ✅ AGREGADO
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
  groupLevel: number; // ✅ CORREGIDO: level -> groupLevel
  completedSets: number;
  totalSets: number;
  pendingSets: number; // ✅ AGREGADO
  completionRate: number;
  isComplete: boolean;
  players: PointsPreview[];
  movements: Record<string, PointsPreview['movement']>; // ✅ AGREGADO
  ladderInfo: { // ✅ AGREGADO
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
    
    // Solo contar si ambos jugadores están en el match en equipos opuestos
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
): { type: 'up' | 'down' | 'same'; groups: number; description: string } { // ✅ CORREGIDO: tipo explícito
  const isTopGroup = groupLevel === 1;
  const isBottomGroup = groupLevel === totalGroups;
  const isSecondGroup = groupLevel === 2;
  const isPenultimateGroup = groupLevel === totalGroups - 1;
  
  switch (position) {
    case 1: // Primer lugar
      if (isTopGroup) {
        return { type: 'same', groups: 0, description: 'Se mantiene en grupo élite' };
      } else if (isSecondGroup) {
        return { type: 'up', groups: 1, description: 'Sube al grupo élite' };
      } else {
        return { type: 'up', groups: 2, description: 'Sube 2 grupos' };
      }
    
    case 2: // Segundo lugar
      if (isTopGroup) {
        return { type: 'same', groups: 0, description: 'Se mantiene en grupo élite' };
      } else {
        return { type: 'up', groups: 1, description: 'Sube 1 grupo' };
      }
    
    case 3: // Tercer lugar
      if (isBottomGroup) {
        return { type: 'same', groups: 0, description: 'Se mantiene en grupo inferior' };
      } else {
        return { type: 'down', groups: 1, description: 'Baja 1 grupo' };
      }
    
    case 4: // Cuarto lugar
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
  // 1. Puntos proyectados (descendente)
  if (a.provisionalPoints !== b.provisionalPoints) {
    return b.provisionalPoints - a.provisionalPoints;
  }
  
  // 2. Sets ganados (descendente)
  if (a.setsWon !== b.setsWon) {
    return b.setsWon - a.setsWon;
  }
  
  // 3. Diferencia de juegos (descendente)
  if (a.gamesDifference !== b.gamesDifference) {
    return b.gamesDifference - a.gamesDifference;
  }
  
  // 4. Head-to-head wins (descendente)
  if (a.h2hWins !== b.h2hWins) {
    return b.h2hWins - a.h2hWins;
  }
  
  // 5. Juegos ganados totales (descendente)
  if (a.gamesWon !== b.gamesWon) {
    return b.gamesWon - a.gamesWon;
  }
  
  return 0; // Empate total
}

// Función principal para obtener preview de puntos
export async function getGroupPointsPreview(groupId: string): Promise<GroupPointsPreview> {
  console.log(`🎯 Calculando preview de puntos para grupo: ${groupId}`);

  // Obtener datos completos del grupo
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
  const pendingSets = totalSets - completedSets; // ✅ AGREGADO
  const completionRate = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  // ✅ Calcular información de la escalera
  const totalGroupsInTournament = await prisma.group.count({
    where: { round: { tournamentId: group.round.tournamentId, isClosed: false } }
  });

  const ladderInfo = {
    isTopGroup: group.level === 1,
    isBottomGroup: group.level === totalGroupsInTournament,
    totalGroups: totalGroupsInTournament
  };
  
  // Calcular preview para cada jugador
  const playersPreview: PointsPreview[] = group.players.map(groupPlayer => {
    const stats = calculatePlayerStats(groupPlayer.playerId, group.matches);
    
    // Calcular puntos actuales y proyectados
    const currentPoints = groupPlayer.points || 0;
    let provisionalPoints = currentPoints;
    
    // Agregar puntos de sets completados que aún no están en groupPlayer.points
    const pendingPoints = stats.setsWon * 1.0; // 1 punto por set ganado
    provisionalPoints = Math.max(currentPoints, pendingPoints);
    
    // Si hay rachas de continuidad habilitadas, estimarlas
    if (group.round.tournament.continuityEnabled && groupPlayer.streak > 0) {
      const streakBonus = Math.min(
        groupPlayer.streak * (group.round.tournament.continuityPointsPerSet || 1),
        group.round.tournament.continuityMaxBonus || 10
      );
      provisionalPoints += streakBonus;
    }

    const deltaPoints = provisionalPoints - currentPoints; // ✅ AGREGADO

    return {
      playerId: groupPlayer.playerId,
      playerName: groupPlayer.player.name,
      currentPoints,
      provisionalPoints,
      deltaPoints, // ✅ AGREGADO
      setsWon: stats.setsWon,
      setsPlayed: stats.setsPlayed, // ✅ CORREGIDO
      gamesWon: stats.gamesWon,
      gamesLost: stats.gamesLost,
      gamesDifference: stats.gamesDifference,
      h2hWins: stats.h2hWins,
      headToHeadRecord: { // ✅ AGREGADO
        wins: stats.h2hWins,
        losses: stats.setsPlayed - stats.setsWon
      },
      currentPosition: groupPlayer.position,
      provisionalPosition: 0, // Se calculará después del ordenamiento
      deltaPosition: 0, // ✅ AGREGADO
      streak: groupPlayer.streak, // ✅ AGREGADO
      usedComodin: groupPlayer.usedComodin, // ✅ AGREGADO
      movement: { type: 'same', groups: 0, description: '' },
      tiebreakInfo: {
        criteria: ['Puntos', 'Sets', 'Dif. Juegos', 'H2H', 'Juegos'],
        values: [provisionalPoints, stats.setsWon, stats.gamesDifference, stats.h2hWins, stats.gamesWon]
      }
    };
  });

  // Resolver empates con head-to-head directo
  for (let i = 0; i < playersPreview.length; i++) {
    for (let j = i + 1; j < playersPreview.length; j++) {
      const playerA = playersPreview[i];
      const playerB = playersPreview[j];
      
      // Si están empatados en puntos y sets, calcular H2H directo
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

  // Ordenar jugadores con criterios de desempate
  playersPreview.sort(comparePlayersWithTiebreakers);

  // ✅ Crear mapa de movimientos
  const movements: Record<string, PointsPreview['movement']> = {};

  // Asignar posiciones proyectadas y calcular movimientos
  playersPreview.forEach((player, index) => {
    const provisionalPosition = index + 1;
    player.provisionalPosition = provisionalPosition;
    player.deltaPosition = player.currentPosition - provisionalPosition; // ✅ AGREGADO
    player.movement = calculateLadderMovement(
      provisionalPosition, 
      group.level, 
      totalGroupsInTournament
    );
    
    // ✅ Agregar al mapa de movimientos
    movements[player.playerId] = player.movement;
  });

  console.log(`✅ Preview calculado: ${playersPreview.length} jugadores, ${completionRate.toFixed(1)}% completado`);

  return {
    groupId,
    groupNumber: group.number,
    groupLevel: group.level, // ✅ CORREGIDO
    completedSets,
    totalSets,
    pendingSets, // ✅ AGREGADO
    completionRate: Math.round(completionRate),
    isComplete: completionRate === 100,
    players: playersPreview,
    movements, // ✅ AGREGADO
    ladderInfo, // ✅ AGREGADO
    lastUpdated: new Date().toISOString()
  };
}

// Función auxiliar para obtener preview de un jugador específico
export async function getPlayerPointsPreview(
  groupId: string, 
  playerId: string
): Promise<PointsPreview | null> {
  const groupPreview = await getGroupPointsPreview(groupId);
  return groupPreview.players.find(p => p.playerId === playerId) || null;
}

// Función para calcular estadísticas rápidas del grupo
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
    hasRecentChanges: false // Se puede implementar lógica de timestamps
  };
}

// Función para validar integridad de datos
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

  // Validar número de jugadores
  if (group.players.length !== 4) {
    errors.push(`Grupo debe tener exactamente 4 jugadores, tiene ${group.players.length}`);
  }

  // Validar número de sets
  if (group.matches.length !== 3) {
    errors.push(`Grupo debe tener exactamente 3 sets, tiene ${group.matches.length}`);
  }

  // Validar posiciones únicas
  const positions = group.players.map(p => p.position).sort();
  const expectedPositions = [1, 2, 3, 4];
  if (JSON.stringify(positions) !== JSON.stringify(expectedPositions)) {
    errors.push("Las posiciones de los jugadores no son únicas o están fuera de rango");
  }

  // Validar que todos los jugadores participen en todos los sets
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

    // Verificar que todos los jugadores del grupo están en el match
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
export { getGroupPointsPreview as calculateGroupPointsPreview };