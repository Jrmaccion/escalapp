/**
 * lib/round-reopen.ts
 *
 * Utilidades para reabrir rondas cerradas y limpiar los efectos secundarios
 * del cierre (streaks, puntos técnicos, estados de grupos, etc.)
 */

import { prisma } from "./prisma";
import { logger } from "./logger";

/**
 * Limpia los efectos secundarios de cerrar una ronda:
 * - Elimina registros de StreakHistory
 * - Recalcula puntos de GroupPlayers desde los matches (elimina bonus y puntos técnicos)
 * - Resetea estados de grupos a PENDING
 * - Resetea rachas a 0
 *
 * IMPORTANTE: Esta función debe llamarse ANTES de cambiar isClosed a false
 */
export async function cleanupRoundClosureEffects(roundId: string): Promise<{
  success: boolean;
  streakHistoryDeleted: number;
  groupsReset: number;
  playersRecalculated: number;
}> {
  logger.debug(`Limpiando efectos de cierre para ronda ${roundId}`);

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Eliminar registros de StreakHistory para esta ronda
      const deletedStreaks = await tx.streakHistory.deleteMany({
        where: { roundId }
      });
      logger.debug(`Eliminados ${deletedStreaks.count} registros de StreakHistory`);

      // 2. Obtener todos los grupos de la ronda
      const groups = await tx.group.findMany({
        where: { roundId },
        include: {
          players: {
            include: {
              player: true
            }
          },
          matches: {
            where: { isConfirmed: true },
            select: {
              id: true,
              team1Player1Id: true,
              team1Player2Id: true,
              team2Player1Id: true,
              team2Player2Id: true,
              team1Games: true,
              team2Games: true,
            }
          }
        }
      });

      // 3. Resetear estado de grupos a PENDING y limpiar skippedReason
      const resetGroups = await tx.group.updateMany({
        where: { roundId },
        data: {
          status: 'PENDING',
          skippedReason: null
        }
      });
      logger.debug(`Reseteados ${resetGroups.count} grupos a PENDING`);

      // 4. Recalcular puntos de cada jugador desde cero (solo desde matches confirmados)
      let playersRecalculated = 0;

      for (const group of groups) {
        for (const groupPlayer of group.players) {
          // Recalcular puntos base desde matches confirmados
          const basePoints = calculatePlayerPointsFromMatches(
            groupPlayer.player.id,
            group.matches
          );

          // Actualizar GroupPlayer con puntos recalculados y streak a 0
          await tx.groupPlayer.update({
            where: { id: groupPlayer.id },
            data: {
              points: basePoints,
              streak: 0,
              // Resetear otros campos que podrían haber sido modificados
              // pero mantener usedComodin y substitutePlayerId que son datos del jugador
            }
          });

          playersRecalculated++;
        }
      }

      logger.debug(`Recalculados puntos de ${playersRecalculated} jugadores`);

      return {
        success: true,
        streakHistoryDeleted: deletedStreaks.count,
        groupsReset: resetGroups.count,
        playersRecalculated
      };
    });
  } catch (error) {
    logger.error("Error limpiando efectos de cierre de ronda", error);
    throw error;
  }
}

/**
 * Calcula los puntos base de un jugador desde los matches confirmados
 * Usa la misma lógica que points-calculator pero sin bonus ni puntos técnicos
 */
function calculatePlayerPointsFromMatches(
  playerId: string,
  matches: Array<{
    id: string;
    team1Player1Id: string;
    team1Player2Id: string;
    team2Player1Id: string;
    team2Player2Id: string;
    team1Games: number | null;
    team2Games: number | null;
  }>
): number {
  let totalPoints = 0;

  for (const match of matches) {
    if (match.team1Games === null || match.team2Games === null) {
      continue; // Match no confirmado, skip
    }

    const isTeam1 =
      match.team1Player1Id === playerId ||
      match.team1Player2Id === playerId;

    const isTeam2 =
      match.team2Player1Id === playerId ||
      match.team2Player2Id === playerId;

    if (!isTeam1 && !isTeam2) {
      continue; // Jugador no participa en este match
    }

    // Determinar ganador
    const team1Won = match.team1Games > match.team2Games;
    const team2Won = match.team2Games > match.team1Games;

    // Puntos por ganar/perder (estándar: 3 por ganar, 1 por perder)
    if (isTeam1 && team1Won) {
      totalPoints += 3;
    } else if (isTeam2 && team2Won) {
      totalPoints += 3;
    } else if (isTeam1 && team2Won) {
      totalPoints += 1;
    } else if (isTeam2 && team1Won) {
      totalPoints += 1;
    }

    // Puntos por games ganados (1 punto por game ganado)
    if (isTeam1) {
      totalPoints += match.team1Games;
    } else if (isTeam2) {
      totalPoints += match.team2Games;
    }
  }

  return totalPoints;
}

/**
 * Reabre una ronda cerrada, limpiando primero todos los efectos secundarios
 * del cierre para evitar duplicación de datos al volver a cerrar.
 *
 * @param roundId - ID de la ronda a reabrir
 * @returns Resultado de la operación con estadísticas de limpieza
 */
export async function reopenRound(roundId: string): Promise<{
  success: boolean;
  message: string;
  cleanup: {
    streakHistoryDeleted: number;
    groupsReset: number;
    playersRecalculated: number;
  };
}> {
  logger.apiRequest("REOPEN", `/rounds/${roundId}`, { roundId });

  try {
    // Verificar que la ronda existe y está cerrada
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        number: true,
        isClosed: true,
        tournamentId: true
      }
    });

    if (!round) {
      throw new Error("Ronda no encontrada");
    }

    if (!round.isClosed) {
      return {
        success: true,
        message: "La ronda ya estaba abierta",
        cleanup: {
          streakHistoryDeleted: 0,
          groupsReset: 0,
          playersRecalculated: 0
        }
      };
    }

    // 1. Limpiar efectos del cierre
    const cleanupResult = await cleanupRoundClosureEffects(roundId);

    // 2. Marcar ronda como abierta
    await prisma.round.update({
      where: { id: roundId },
      data: { isClosed: false }
    });

    logger.debug(`Ronda ${round.number} reabierta exitosamente`, cleanupResult);

    return {
      success: true,
      message: `Ronda ${round.number} reabierta correctamente`,
      cleanup: cleanupResult
    };
  } catch (error: any) {
    logger.error(`Error reabriendo ronda ${roundId}`, error);
    throw new Error(`Error al reabrir ronda: ${error.message}`);
  }
}
