// lib/streak-calculator.ts - VERSIÓN CORREGIDA PARA RACHAS DE CONTINUIDAD
import { prisma } from "@/lib/prisma";

export interface ContinuityStreakConfig {
  continuityEnabled: boolean;
  continuityPointsPerSet: number;    // Puntos por set en ronda consecutiva
  continuityPointsPerRound: number;  // Puntos por ronda consecutiva  
  continuityMinRounds: number;       // Rondas mínimas para bonus (normalmente 2)
  continuityMaxBonus: number;        // Límite máximo de puntos bonus por ronda
  continuityMode: "SETS" | "MATCHES" | "BOTH"; // "SETS" = por set jugado, "MATCHES" = por ronda
}

export interface PlayerContinuityData {
  playerId: string;
  roundsStreak: number;           // Rondas consecutivas participadas
  bonusPoints: number;            // Puntos bonus obtenidos esta ronda
  hasParticipated: boolean;       // Si participó en esta ronda
}

/**
 * Calcula rachas de continuidad al cerrar una ronda
 * Se ejecuta DESPUÉS de que todos los matches están confirmados
 */
export async function calculateContinuityStreaksForRound(
  roundId: string,
  config: ContinuityStreakConfig
): Promise<Map<string, PlayerContinuityData>> {
  if (!config.continuityEnabled) {
    return new Map();
  }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      tournament: { select: { id: true } },
      groups: {
        include: {
          players: {
            include: { player: { select: { id: true, name: true } } }
          }
        }
      }
    }
  });

  if (!round) {
    throw new Error("Ronda no encontrada");
  }

  const streakUpdates = new Map<string, PlayerContinuityData>();

  // Obtener todas las rondas anteriores del torneo (ordenadas por número)
  const allRounds = await prisma.round.findMany({
    where: { 
      tournamentId: round.tournamentId,
      number: { lte: round.number }
    },
    orderBy: { number: 'asc' },
    include: {
      groups: {
        include: {
          players: {
            select: { 
              playerId: true, 
              usedComodin: true, 
              points: true 
            }
          }
        }
      }
    }
  });

  // Procesar cada jugador que participó en esta ronda
  for (const group of round.groups) {
    for (const groupPlayer of group.players) {
      const playerId = groupPlayer.playerId;
      
      // Determinar si participó en esta ronda (no usó comodín)
      const hasParticipated = !groupPlayer.usedComodin;
      
      // Calcular racha de continuidad
      const continuityStreak = calculatePlayerContinuityStreak(
        playerId, 
        allRounds, 
        round.number, 
        hasParticipated
      );

      // Calcular bonus points si tiene racha
      let bonusPoints = 0;
      if (hasParticipated && continuityStreak >= config.continuityMinRounds) {
        if (config.continuityMode === "SETS") {
          // Bonus por cada set (3 sets por ronda)
          bonusPoints = config.continuityPointsPerSet * 3;
        } else if (config.continuityMode === "MATCHES") {
          // Bonus por ronda completa
          bonusPoints = config.continuityPointsPerRound;
        } else { // "BOTH"
          // Ambos modos (sets + ronda)
          bonusPoints = (config.continuityPointsPerSet * 3) + config.continuityPointsPerRound;
        }
        
        // Aplicar límite máximo
        bonusPoints = Math.min(bonusPoints, config.continuityMaxBonus);
      }

      streakUpdates.set(playerId, {
        playerId,
        roundsStreak: continuityStreak,
        bonusPoints,
        hasParticipated
      });
    }
  }

  return streakUpdates;
}

/**
 * Calcula la racha de continuidad de un jugador específico
 * Cuenta rondas consecutivas donde participó (sin comodín)
 */
function calculatePlayerContinuityStreak(
  playerId: string,
  allRounds: any[],
  currentRoundNumber: number,
  participatedThisRound: boolean
): number {
  // Si no participó esta ronda, la racha se rompe
  if (!participatedThisRound) {
    return 0;
  }

  let streak = 1; // Esta ronda cuenta como 1

  // Ir hacia atrás contando rondas consecutivas de participación
  for (let roundNum = currentRoundNumber - 1; roundNum >= 1; roundNum--) {
    const round = allRounds.find(r => r.number === roundNum);
    if (!round) break;

    // Buscar si el jugador participó en esta ronda
    let participatedInRound = false;
    for (const group of round.groups) {
      const groupPlayer = group.players.find((gp: any) => gp.playerId === playerId);
      if (groupPlayer && !groupPlayer.usedComodin) {
        participatedInRound = true;
        break;
      }
    }

    if (participatedInRound) {
      streak++;
    } else {
      // Se rompe la racha
      break;
    }
  }

  return streak;
}

/**
 * Aplica las actualizaciones de rachas de continuidad a la base de datos
 */
export async function applyContinuityStreakUpdates(
  roundId: string,
  streakUpdates: Map<string, PlayerContinuityData>
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const [playerId, data] of streakUpdates) {
      // Encontrar el GroupPlayer para este jugador en esta ronda
      const groupPlayer = await tx.groupPlayer.findFirst({
        where: {
          playerId,
          group: {
            roundId: roundId
          }
        }
      });

      if (!groupPlayer) continue;

      // Actualizar la racha y añadir puntos bonus
      await tx.groupPlayer.update({
        where: { id: groupPlayer.id },
        data: {
          streak: data.roundsStreak,
          points: {
            increment: data.bonusPoints
          }
        }
      });

      // Registrar en historial si hubo bonus
      if (data.bonusPoints > 0) {
        await tx.streakHistory.create({
          data: {
            playerId,
            roundId: roundId,
            groupId: groupPlayer.groupId,
            streakType: "CONTINUITY_BONUS",
            streakCount: data.roundsStreak,
            bonusPoints: data.bonusPoints
          }
        });
      }
    }
  });
}

/**
 * Función principal que combina cálculo y aplicación
 * Se llama desde el endpoint de cerrar ronda
 */
export async function processContinuityStreaksForRound(
  roundId: string,
  config: ContinuityStreakConfig
): Promise<void> {
  if (!config.continuityEnabled) return;

  try {
    const streakUpdates = await calculateContinuityStreaksForRound(roundId, config);
    await applyContinuityStreakUpdates(roundId, streakUpdates);
    
    console.log(`Rachas de continuidad procesadas para ronda ${roundId}:`, {
      playersProcessed: streakUpdates.size,
      totalBonusAwarded: Array.from(streakUpdates.values())
        .reduce((sum, data) => sum + data.bonusPoints, 0)
    });
  } catch (error) {
    console.error("Error procesando rachas de continuidad:", error);
    throw error;
  }
}

/**
 * Obtiene estadísticas de rachas de continuidad para un jugador
 */
export async function getPlayerContinuityStats(
  playerId: string,
  tournamentId: string
): Promise<{
  currentStreak: number;
  totalBonusPoints: number;
  bestStreak: number;
  roundsWithBonus: number;
}> {
  // Obtener racha actual
  const currentGroup = await prisma.groupPlayer.findFirst({
    where: {
      playerId,
      group: {
        round: {
          tournamentId,
          isClosed: false
        }
      }
    },
    select: { streak: true }
  });

  // Obtener historial de rachas de continuidad
  const streakHistory = await prisma.streakHistory.findMany({
    where: {
      playerId,
      streakType: "CONTINUITY_BONUS",
      roundId: {
        in: await prisma.round.findMany({
          where: { tournamentId },
          select: { id: true }
        }).then(rounds => rounds.map(r => r.id))
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return {
    currentStreak: currentGroup?.streak || 0,
    totalBonusPoints: streakHistory.reduce((sum, s) => sum + s.bonusPoints, 0),
    bestStreak: Math.max(...streakHistory.map(s => s.streakCount), 0),
    roundsWithBonus: streakHistory.length
  };
}

// MANTENER PARA COMPATIBILIDAD CON CÓDIGO LEGACY (deprecated)
export const calculateStreaksForMatch = async () => {
  console.warn("calculateStreaksForMatch está deprecated. Usar processContinuityStreaksForRound");
  return new Map();
};

export const calculateMatchStreaksForRound = async () => {
  console.warn("calculateMatchStreaksForRound está deprecated. Usar processContinuityStreaksForRound");
};

export const applyStreakUpdates = async () => {
  console.warn("applyStreakUpdates está deprecated. Usar applyContinuityStreakUpdates");
};