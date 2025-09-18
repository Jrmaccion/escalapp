// lib/points-calculator.ts
// Sistema de cálculo de puntos en tiempo real para preview

import { prisma } from "@/lib/prisma";

export type PointsPreview = {
  playerId: string;
  playerName: string;
  currentPoints: number;        // Puntos oficiales actuales (en BD)
  provisionalPoints: number;    // Puntos con sets confirmados incluidos
  deltaPoints: number;          // Diferencia (provisional - current)
  currentPosition: number;      // Posición oficial actual
  provisionalPosition: number;  // Posición con sets confirmados
  deltaPosition: number;        // Cambio de posición
  setsPlayed: number;          // Sets jugados (confirmados)
  setsWon: number;             // Sets ganados
  gamesWon: number;            // Juegos ganados totales
  streak: number;              // Racha actual
  usedComodin: boolean;        // Usó comodín en esta ronda
};

export type GroupPointsPreview = {
  groupId: string;
  groupNumber: number;
  roundId: string;
  lastUpdated: Date;
  players: PointsPreview[];
  completionRate: number;       // % de sets confirmados
  isComplete: boolean;          // Todos los sets confirmados
  movements: {                  // Movimientos de escalera previstos
    [playerId: string]: 'up' | 'down' | 'stay';
  };
  totalSets: number;
  completedSets: number;
  pendingSets: number;
};

/**
 * Calcula puntos provisionales para un grupo basado en sets confirmados
 */
export async function calculateGroupPointsPreview(groupId: string): Promise<GroupPointsPreview | null> {
  try {
    console.log(`[points-calculator] Calculando preview para grupo ${groupId}`);

    // 1. Cargar datos del grupo con sets
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        round: { select: { id: true, number: true } },
        players: {
          include: { player: { select: { id: true, name: true } } },
          orderBy: { position: 'asc' }
        },
        matches: {
          select: {
            id: true,
            setNumber: true,
            team1Player1Id: true,
            team1Player2Id: true,
            team2Player1Id: true,
            team2Player2Id: true,
            team1Games: true,
            team2Games: true,
            isConfirmed: true,
            updatedAt: true
          },
          orderBy: { setNumber: 'asc' }
        }
      }
    });

    if (!group) {
      console.warn(`[points-calculator] Grupo ${groupId} no encontrado`);
      return null;
    }

    // 2. Separar sets confirmados de no confirmados
    const confirmedSets = group.matches.filter(m => m.isConfirmed);
    const totalSets = group.matches.length;
    const completionRate = totalSets > 0 ? (confirmedSets.length / totalSets) * 100 : 0;

    console.log(`[points-calculator] Grupo ${group.number}: ${confirmedSets.length}/${totalSets} sets confirmados (${completionRate.toFixed(1)}%)`);

    // 3. Calcular puntos por jugador
    const playersPreview: PointsPreview[] = [];

    for (const groupPlayer of group.players) {
      const playerId = groupPlayer.playerId;
      const playerName = groupPlayer.player?.name || 'Jugador';
      
      // Puntos actuales (oficiales en BD)
      const currentPoints = groupPlayer.points || 0;
      const currentPosition = groupPlayer.position || 0;
      const streak = groupPlayer.streak || 0;
      const usedComodin = groupPlayer.usedComodin || false;
      
      // Calcular puntos provisionales de sets confirmados
      let provisionalGamesWon = 0;
      let provisionalSetsWon = 0;
      let setsParticipated = 0;
      
      for (const match of confirmedSets) {
        const { team1Games, team2Games } = match;
        if (team1Games === null || team2Games === null) continue;

        // Determinar si este jugador participó y en qué equipo
        const isTeam1 = match.team1Player1Id === playerId || match.team1Player2Id === playerId;
        const isTeam2 = match.team2Player1Id === playerId || match.team2Player2Id === playerId;
        
        if (!isTeam1 && !isTeam2) continue;

        setsParticipated++;

        // Sumar juegos ganados
        if (isTeam1) {
          provisionalGamesWon += team1Games;
          if (team1Games > team2Games) {
            provisionalSetsWon += 1;
            // +1 punto extra por ganar el set
            provisionalGamesWon += 1;
          }
        } else if (isTeam2) {
          provisionalGamesWon += team2Games;
          if (team2Games > team1Games) {
            provisionalSetsWon += 1;
            // +1 punto extra por ganar el set
            provisionalGamesWon += 1;
          }
        }
      }

      // Calcular puntos provisionales totales
      // Sistema: +1 por juego ganado, +1 extra por ganar el set (ya incluido arriba)
      const provisionalPoints = currentPoints + provisionalGamesWon;
      
      playersPreview.push({
        playerId,
        playerName,
        currentPoints,
        provisionalPoints,
        deltaPoints: provisionalPoints - currentPoints,
        currentPosition,
        provisionalPosition: 0, // Se calculará después del ordenamiento
        deltaPosition: 0,
        setsPlayed: setsParticipated,
        setsWon: provisionalSetsWon,
        gamesWon: provisionalGamesWon,
        streak,
        usedComodin
      });
    }

    // 4. Calcular posiciones provisionales (ordenar por puntos provisionales)
    const sortedByProvisional = [...playersPreview].sort((a, b) => {
      // Ordenar por puntos provisionales (descendente)
      if (b.provisionalPoints !== a.provisionalPoints) {
        return b.provisionalPoints - a.provisionalPoints;
      }
      // Desempate por sets ganados
      if (b.setsWon !== a.setsWon) {
        return b.setsWon - a.setsWon;
      }
      // Desempate por juegos ganados totales
      if (b.gamesWon !== a.gamesWon) {
        return b.gamesWon - a.gamesWon;
      }
      // Desempate por nombre (alfabético)
      return a.playerName.localeCompare(b.playerName);
    });

    // 5. Asignar posiciones provisionales y calcular cambios + movimientos
    const movements: { [playerId: string]: 'up' | 'down' | 'stay' } = {};
    
    for (let i = 0; i < sortedByProvisional.length; i++) {
      const player = sortedByProvisional[i];
      player.provisionalPosition = i + 1;
      player.deltaPosition = player.currentPosition - player.provisionalPosition;
      
      // Determinar movimiento de escalera (sistema 4 jugadores por grupo)
      // 1° sube, 2° y 3° se mantienen, 4° baja
      if (player.provisionalPosition === 1) {
        movements[player.playerId] = 'up';
      } else if (player.provisionalPosition === sortedByProvisional.length && sortedByProvisional.length > 2) {
        movements[player.playerId] = 'down';
      } else {
        movements[player.playerId] = 'stay';
      }
    }

    // 6. Restaurar orden original por posición actual para la respuesta
    playersPreview.forEach(p => {
      const sorted = sortedByProvisional.find(s => s.playerId === p.playerId);
      if (sorted) {
        p.provisionalPosition = sorted.provisionalPosition;
        p.deltaPosition = sorted.deltaPosition;
      }
    });

    // Ordenar por posición provisional para la respuesta final
    const finalPlayers = playersPreview.sort((a, b) => a.provisionalPosition - b.provisionalPosition);

    console.log(`[points-calculator] Preview calculado para ${finalPlayers.length} jugadores`);

    return {
      groupId,
      groupNumber: group.number,
      roundId: group.round.id,
      lastUpdated: new Date(),
      players: finalPlayers,
      completionRate: Math.round(completionRate * 100) / 100,
      isComplete: completionRate === 100,
      movements,
      totalSets,
      completedSets: confirmedSets.length,
      pendingSets: totalSets - confirmedSets.length
    };

  } catch (error) {
    console.error('[points-calculator] Error calculating group points preview:', error);
    return null;
  }
}

/**
 * Calcula preview para múltiples grupos de una ronda
 */
export async function calculateRoundPointsPreview(roundId: string): Promise<GroupPointsPreview[]> {
  try {
    console.log(`[points-calculator] Calculando preview para ronda ${roundId}`);

    const groups = await prisma.group.findMany({
      where: { roundId },
      select: { id: true, number: true },
      orderBy: { number: 'asc' }
    });

    console.log(`[points-calculator] Encontrados ${groups.length} grupos en la ronda`);

    const previews: GroupPointsPreview[] = [];
    
    for (const group of groups) {
      const preview = await calculateGroupPointsPreview(group.id);
      if (preview) {
        previews.push(preview);
      }
    }

    console.log(`[points-calculator] Preview calculado para ${previews.length} grupos`);
    return previews;
  } catch (error) {
    console.error('[points-calculator] Error calculating round points preview:', error);
    return [];
  }
}

/**
 * Obtiene solo la preview de un jugador específico en su grupo
 */
export async function getPlayerPointsPreview(playerId: string, roundId?: string): Promise<PointsPreview | null> {
  try {
    console.log(`[points-calculator] Obteniendo preview para jugador ${playerId}`, { roundId });

    // Buscar grupo actual del jugador
    const groupPlayer = await prisma.groupPlayer.findFirst({
      where: {
        playerId,
        ...(roundId && { group: { roundId } })
      },
      include: { 
        group: { 
          select: { id: true, roundId: true, number: true } 
        } 
      },
      orderBy: { group: { round: { number: 'desc' } } }
    });

    if (!groupPlayer) {
      console.log(`[points-calculator] No se encontró grupo para jugador ${playerId}`);
      return null;
    }

    console.log(`[points-calculator] Jugador ${playerId} encontrado en grupo ${groupPlayer.group.number}`);

    const preview = await calculateGroupPointsPreview(groupPlayer.groupId);
    const playerPreview = preview?.players.find(p => p.playerId === playerId) || null;

    if (playerPreview) {
      console.log(`[points-calculator] Preview obtenido para jugador: ${playerPreview.provisionalPoints} pts (${playerPreview.provisionalPosition}° pos)`);
    }

    return playerPreview;

  } catch (error) {
    console.error('[points-calculator] Error getting player points preview:', error);
    return null;
  }
}

/**
 * Verifica si un grupo ha cambiado desde el último cálculo
 */
export async function hasGroupChanged(groupId: string, lastCalculated: Date): Promise<boolean> {
  try {
    const latestMatch = await prisma.match.findFirst({
      where: { 
        groupId,
        updatedAt: { gt: lastCalculated }
      },
      select: { updatedAt: true }
    });

    const hasChanged = !!latestMatch;
    if (hasChanged) {
      console.log(`[points-calculator] Grupo ${groupId} ha cambiado desde ${lastCalculated.toISOString()}`);
    }

    return hasChanged;
  } catch (error) {
    console.error('[points-calculator] Error checking group changes:', error);
    return true; // En caso de error, asumir que cambió
  }
}

/**
 * Obtiene estadísticas rápidas de un grupo sin calcular todo el preview
 */
export async function getGroupQuickStats(groupId: string): Promise<{
  completionRate: number;
  completedSets: number;
  totalSets: number;
  hasChanges: boolean;
} | null> {
  try {
    const matches = await prisma.match.findMany({
      where: { groupId },
      select: { 
        id: true, 
        isConfirmed: true,
        updatedAt: true 
      }
    });

    const totalSets = matches.length;
    const completedSets = matches.filter(m => m.isConfirmed).length;
    const completionRate = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

    // Verificar si hay cambios recientes (últimos 5 minutos)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const hasChanges = matches.some(m => m.updatedAt > fiveMinutesAgo && m.isConfirmed);

    return {
      completionRate: Math.round(completionRate * 100) / 100,
      completedSets,
      totalSets,
      hasChanges
    };

  } catch (error) {
    console.error('[points-calculator] Error getting group quick stats:', error);
    return null;
  }
}