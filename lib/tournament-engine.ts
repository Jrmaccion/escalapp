// lib/tournament-engine.ts - VERSIÓN COMPLETA CON GESTIÓN DE GRUPOS SKIPPED
import { prisma } from './prisma';
import { addDays } from 'date-fns';
import { computeSubstituteCreditsForRound } from './rounds';
import { processContinuityStreaksForRound } from './streak-calculator';
import { GroupManager } from './group-manager';
import { GroupStatus } from '@prisma/client';

// ===============================
// Errores específicos del engine
// ===============================
enum TournamentEngineError {
  ROUND_NOT_FOUND = "ROUND_NOT_FOUND",
  ROUND_ALREADY_CLOSED = "ROUND_ALREADY_CLOSED",
  TOURNAMENT_NOT_FOUND = "TOURNAMENT_NOT_FOUND",
  INVALID_ROUND_DATA = "INVALID_ROUND_DATA",
  MATCHES_INCOMPLETE = "MATCHES_INCOMPLETE",
  GROUPS_INVALID = "GROUPS_INVALID",
  PLAYER_COUNT_MISMATCH = "PLAYER_COUNT_MISMATCH",
  CONCURRENT_MODIFICATION = "CONCURRENT_MODIFICATION",
  ROLLBACK_FAILED = "ROLLBACK_FAILED",
  INTEGRITY_CHECK_FAILED = "INTEGRITY_CHECK_FAILED"
}

const ENGINE_ERROR_MESSAGES = {
  [TournamentEngineError.ROUND_NOT_FOUND]: "Ronda no encontrada",
  [TournamentEngineError.ROUND_ALREADY_CLOSED]: "La ronda ya está cerrada",
  [TournamentEngineError.TOURNAMENT_NOT_FOUND]: "Torneo no encontrado",
  [TournamentEngineError.INVALID_ROUND_DATA]: "Los datos de la ronda son inválidos",
  [TournamentEngineError.MATCHES_INCOMPLETE]: "Hay partidos sin completar en la ronda",
  [TournamentEngineError.GROUPS_INVALID]: "Los grupos no tienen la estructura correcta",
  [TournamentEngineError.PLAYER_COUNT_MISMATCH]: "El número de jugadores no coincide entre rondas",
  [TournamentEngineError.CONCURRENT_MODIFICATION]: "Los datos han sido modificados por otro proceso",
  [TournamentEngineError.ROLLBACK_FAILED]: "Error crítico: no se pudo deshacer la operación",
  [TournamentEngineError.INTEGRITY_CHECK_FAILED]: "Verificación de integridad fallida",
} as const;

// ===============================
// Tipos internos unificados
// ===============================
interface RoundIntegrityData {
  roundId: string;
  tournamentId: string;
  roundNumber: number;
  isClosed: boolean;
  groupsCount: number;
  playersCount: number;
  matchesCount: number;
  completedMatches: number;
  timestamp: Date;
}

interface RoundSnapshot {
  roundId: string;
  isClosed: boolean;
  playerPositions: Array<{
    groupPlayerId: string;
    position: number;
    points: number;
    streak: number;
  }>;
  timestamp: Date;
}

interface PlayerStats {
  playerId: string;
  points: number;
  setsWon: number;
  gamesWon: number;
  gamesLost: number;
  gamesDifference: number;
  h2hWins: number;
}

type SubstituteCredit = {
  playerId: string;
  points: number;
};

// ===============================
// Funciones unificadas de desempate
// ===============================

function calculatePlayerStatsInGroup(playerId: string, matches: any[]): PlayerStats {
  let setsWon = 0;
  let gamesWon = 0;
  let gamesLost = 0;
  let h2hWins = 0;

  for (const match of matches) {
    if (!match.isConfirmed) continue;

    const isInTeam1 = [match.team1Player1Id, match.team1Player2Id].includes(playerId);
    const isInTeam2 = [match.team2Player1Id, match.team2Player2Id].includes(playerId);

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
    playerId,
    points: 0,
    setsWon,
    gamesWon,
    gamesLost,
    gamesDifference: gamesWon - gamesLost,
    h2hWins
  };
}

function comparePlayersWithUnifiedTiebreakers(a: PlayerStats, b: PlayerStats): number {
  if (a.points !== b.points) return b.points - a.points;
  if (a.setsWon !== b.setsWon) return b.setsWon - a.setsWon;
  if (a.gamesDifference !== b.gamesDifference) return b.gamesDifference - a.gamesDifference;
  if (a.h2hWins !== b.h2hWins) return b.h2hWins - a.h2hWins;
  if (a.gamesWon !== b.gamesWon) return b.gamesWon - a.gamesWon;
  return 0;
}

/**
 * Calcula movimientos de escalera según premisa correcta
 */
function calculateUnifiedLadderMovement(position: number, groupLevel: number, totalGroups: number) {
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

// ===============================
// Helpers de integridad y rollback
// ===============================
async function validateRoundIntegrity(roundId: string): Promise<RoundIntegrityData> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      tournament: { select: { id: true, title: true, totalRounds: true, roundDurationDays: true } },
      groups: {
        include: {
          players: { select: { id: true } },
          matches: {
            select: {
              id: true,
              isConfirmed: true,
              team1Games: true,
              team2Games: true,
            },
          },
        },
      },
    },
  });

  if (!round) {
    throw new Error(TournamentEngineError.ROUND_NOT_FOUND);
  }
  if (round.isClosed) {
    throw new Error(TournamentEngineError.ROUND_ALREADY_CLOSED);
  }

  const groupsCount = round.groups.length;
  const playersCount = round.groups.reduce((acc, g) => acc + g.players.length, 0);
  const matchesCount = round.groups.reduce((acc, g) => acc + g.matches.length, 0);
  const completedMatches = round.groups.reduce(
    (acc, g) => acc + g.matches.filter((m) => m.isConfirmed).length,
    0
  );

  if (groupsCount === 0) {
    throw new Error(TournamentEngineError.GROUPS_INVALID);
  }

  const invalidGroups = round.groups.filter((g) => g.players.length !== 4);
  if (invalidGroups.length > 0) {
    throw new Error(TournamentEngineError.GROUPS_INVALID);
  }

  const invalidMatches = round.groups.filter((g) => g.matches.length !== 3);
  if (invalidMatches.length > 0) {
    throw new Error(TournamentEngineError.INVALID_ROUND_DATA);
  }

  return {
    roundId,
    tournamentId: round.tournament.id,
    roundNumber: round.number,
    isClosed: round.isClosed,
    groupsCount,
    playersCount,
    matchesCount,
    completedMatches,
    timestamp: new Date(),
  };
}

async function validateAllMatchesCompleted(roundId: string): Promise<boolean> {
  // ✅ CORREGIDO: Excluir matches de grupos SKIPPED
  const incompleteMatches = await prisma.match.count({
    where: { 
      group: { 
        roundId,
        status: { not: GroupStatus.SKIPPED } // ← AÑADIR ESTA LÍNEA
      }, 
      isConfirmed: false 
    },
  });
  
  if (incompleteMatches > 0) {
    throw new Error(TournamentEngineError.MATCHES_INCOMPLETE);
  }
  return true;
}

async function createRoundSnapshot(roundId: string): Promise<RoundSnapshot> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { id: true, isClosed: true },
  });
  if (!round) throw new Error(TournamentEngineError.ROUND_NOT_FOUND);

  const players = await prisma.groupPlayer.findMany({
    where: { group: { roundId } },
    select: { id: true, position: true, points: true, streak: true },
  });

  return {
    roundId,
    isClosed: round.isClosed,
    playerPositions: players.map((p) => ({
      groupPlayerId: p.id,
      position: p.position,
      points: p.points,
      streak: p.streak,
    })),
    timestamp: new Date(),
  };
}

async function restoreFromSnapshot(snapshot: RoundSnapshot): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.round.update({
        where: { id: snapshot.roundId },
        data: { isClosed: snapshot.isClosed },
      });

      for (const player of snapshot.playerPositions) {
        await tx.groupPlayer.update({
          where: { id: player.groupPlayerId },
          data: {
            position: player.position,
            points: player.points,
            streak: player.streak,
          },
        });
      }
    });
  } catch (error) {
    console.error("CRITICAL: Failed to restore snapshot", { snapshot, error });
    throw new Error(TournamentEngineError.ROLLBACK_FAILED);
  }
}

// ===============================
// Motor principal
// ===============================
export class TournamentEngine {
  static async closeRoundAndGenerateNext(roundId: string) {
    let snapshot: RoundSnapshot | null = null;

    try {
      const integrity = await validateRoundIntegrity(roundId);
      console.log(`Cerrando ronda ${integrity.roundNumber} del torneo ${integrity.tournamentId}`);

      snapshot = await createRoundSnapshot(roundId);
      await validateAllMatchesCompleted(roundId);

      const tournament = await prisma.tournament.findUnique({
        where: { id: integrity.tournamentId },
        select: {
          continuityEnabled: true,
          continuityPointsPerSet: true,
          continuityPointsPerRound: true,
          continuityMinRounds: true,
          continuityMaxBonus: true,
          continuityMode: true,
        },
      });

      if (tournament?.continuityEnabled) {
        await processContinuityStreaksForRound(roundId, {
          continuityEnabled: tournament.continuityEnabled,
          continuityPointsPerSet: tournament.continuityPointsPerSet || 0,
          continuityPointsPerRound: tournament.continuityPointsPerRound || 0,
          continuityMinRounds: tournament.continuityMinRounds || 2,
          continuityMaxBonus: tournament.continuityMaxBonus || 10,
          continuityMode: (tournament.continuityMode as "SETS" | "MATCHES" | "BOTH") || "SETS",
        });
        console.log(`Rachas de continuidad procesadas para ronda ${integrity.roundNumber}`);
      }

      await this.recalculatePositionsWithTiebreakers(roundId);

      const roundData = await prisma.$transaction(async (tx) => {
        const currentRound = await tx.round.findUnique({
          where: { id: roundId },
          select: { id: true, isClosed: true, number: true, tournamentId: true },
        });
        if (!currentRound || currentRound.isClosed) {
          throw new Error("La ronda ya está cerrada o no existe");
        }

        await tx.round.update({
          where: { id: roundId },
          data: { isClosed: true },
        });

        const roundWithGroups = await tx.round.findUnique({
          where: { id: roundId },
          include: {
            tournament: true,
            groups: {
              include: {
                players: {
                  include: { player: true },
                  orderBy: { position: 'asc' },
                },
                matches: {
                  select: {
                    isConfirmed: true,
                    team1Games: true,
                    team2Games: true,
                    team1Player1Id: true,
                    team1Player2Id: true,
                    team2Player1Id: true,
                    team2Player2Id: true,
                  },
                },
              },
              orderBy: { level: 'asc' },
            },
          },
        });

        return roundWithGroups;
      });

      if (!roundData) throw new Error("Error obteniendo datos de la ronda");

      const movements = await this.calculateUnifiedLadderMovements(roundData.groups);
      console.log(`Movimientos calculados: ${movements.length} jugadores`);

      const scRaw: any = await computeSubstituteCreditsForRound(roundId);
      const substituteCredits: SubstituteCredit[] = Array.isArray(scRaw)
        ? (scRaw as SubstituteCredit[])
        : (Array.isArray(scRaw?.credits) ? (scRaw.credits as SubstituteCredit[]) : []);

      let nextRoundGenerated = false;
      if (roundData.number < roundData.tournament.totalRounds) {
        const nextRoundId = await this.generateNextRoundWithGroupManager(
          roundData.tournament.id,
          roundData.number + 1,
          movements
        );
        console.log(`Nueva ronda generada: ${nextRoundId}`);
        nextRoundGenerated = true;
      }

      for (const credit of substituteCredits) {
        await this.applySubstituteCredit(roundData.tournament.id, credit);
      }

      await this.updateRankings(roundData.tournament.id, roundData.number);

      console.log(`Ronda ${roundData.number} cerrada exitosamente`);
      return {
        success: true,
        movements,
        substituteCredits,
        roundNumber: roundData.number,
        nextRoundGenerated,
      };
    } catch (error: any) {
      console.error(`Error cerrando ronda ${roundId}:`, error);
      if (snapshot) {
        try {
          await restoreFromSnapshot(snapshot);
          console.log(`Rollback completado exitosamente`);
        } catch (rollbackError) {
          console.error(`CRITICAL: Rollback failed`, { error, rollbackError, snapshot });
          throw new Error(ENGINE_ERROR_MESSAGES[TournamentEngineError.ROLLBACK_FAILED]);
        }
      }

      if (Object.values(TournamentEngineError).includes(error?.message)) {
        throw new Error(ENGINE_ERROR_MESSAGES[error.message as TournamentEngineError]);
      }
      throw error;
    }
  }

  // ===============================
  // Recálculo de posiciones con desempates
  // ===============================
  private static async recalculatePositionsWithTiebreakers(roundId: string): Promise<void> {
  console.log(`Recalculando posiciones con desempates para ronda ${roundId}`);

  const groups = await prisma.group.findMany({
    where: { roundId },
    include: {
      players: { include: { player: true } },
      matches: {
        where: { isConfirmed: true },
        select: {
          team1Games: true,
          team2Games: true,
          team1Player1Id: true,
          team1Player2Id: true,
          team2Player1Id: true,
          team2Player2Id: true,
        }
      }
    }
  });

  for (const group of groups) {
    const playersWithStats = group.players.map(gp => {
      const stats = calculatePlayerStatsInGroup(gp.playerId, group.matches);
      return {
        ...stats,
        points: gp.points || 0,
        groupPlayerId: gp.id
      };
    });

    playersWithStats.sort(comparePlayersWithUnifiedTiebreakers);

    // Usar una única operación de actualización batch
    await prisma.$transaction(
      playersWithStats.map((player, index) =>
        prisma.groupPlayer.update({
          where: { id: player.groupPlayerId },
          data: { position: 1000 + index } // Temporal alto para evitar conflictos
        })
      )
    );

    // Ahora actualizar a posiciones finales
    await prisma.$transaction(
      playersWithStats.map((player, index) =>
        prisma.groupPlayer.update({
          where: { id: player.groupPlayerId },
          data: { position: index + 1 }
        })
      )
    );

    playersWithStats.forEach((p, i) => {
      console.log(`  Grupo ${group.number}: ${p.playerId} → posición ${i + 1}`);
    });
  }

  console.log(`Posiciones recalculadas para ${groups.length} grupos`);
}

  // ===============================
  // Cálculo unificado de movimientos CON SOPORTE SKIPPED
  // ===============================
  private static async calculateUnifiedLadderMovements(groups: any[]) {
    const movements: any[] = [];
    const skippedGroups = groups.filter((g: any) => g.status === GroupStatus.SKIPPED);
    const totalGroups = groups.length;

    console.log(`Grupos SKIPPED detectados: ${skippedGroups.length}/${totalGroups}`);

    // REGLA 1: Si todos los grupos están SKIPPED, nadie se mueve
    if (skippedGroups.length === totalGroups) {
      console.log('Todos los grupos SKIPPED - Sin movimientos');
      groups.forEach((group: any) => {
        group.players.forEach((player: any) => {
          movements.push({
            playerId: player.playerId,
            currentGroup: group.level,
            currentPosition: player.position,
            targetGroupChange: 0,
            movement: 'frozen',
            locked: true,
            points: player.points,
            description: 'Todos los grupos no jugaron - Sin movimientos'
          });
        });
      });
      return movements;
    }

    // REGLA 2: Si >50% grupos SKIPPED, cancelar penalización
    if (skippedGroups.length > totalGroups / 2) {
      console.log(`Mayoría de grupos SKIPPED (${skippedGroups.length}/${totalGroups}) - Sin penalizaciones`);
      
      groups.forEach((group: any) => {
        const isSkipped = group.status === GroupStatus.SKIPPED;
        
        group.players.forEach((player: any) => {
          if (isSkipped) {
            movements.push({
              playerId: player.playerId,
              currentGroup: group.level,
              currentPosition: player.position,
              targetGroupChange: 0,
              movement: 'frozen',
              locked: true,
              points: player.points,
              description: 'Mayoría de grupos no jugaron - Sin penalización'
            });
          } else {
            const movementInfo = calculateUnifiedLadderMovement(
              player.position,
              group.level,
              totalGroups
            );
            
            let targetGroupChange = 0;
            switch (movementInfo.type) {
              case 'up': targetGroupChange = -movementInfo.groups; break;
              case 'down': targetGroupChange = movementInfo.groups; break;
            }

            movements.push({
              playerId: player.playerId,
              currentGroup: group.level,
              currentPosition: player.position,
              targetGroupChange,
              movement: movementInfo.type,
              locked: false,
              points: player.points,
              description: movementInfo.description
            });
          }
        });
      });

      return movements;
    }

    // REGLA 3: Movimientos normales + penalización para SKIPPED individuales
    groups.forEach((group: any) => {
      const isSkipped = group.status === GroupStatus.SKIPPED;
      const isBottomGroup = group.level === totalGroups;

      group.players.forEach((player: any) => {
        if (isSkipped) {
          if (isBottomGroup) {
            movements.push({
              playerId: player.playerId,
              currentGroup: group.level,
              currentPosition: player.position,
              targetGroupChange: 0,
              movement: 'frozen',
              locked: true,
              points: player.points,
              description: 'Grupo inferior no disputado - Se mantiene'
            });
          } else {
            movements.push({
              playerId: player.playerId,
              currentGroup: group.level,
              currentPosition: player.position,
              targetGroupChange: 1,
              movement: 'down',
              locked: true,
              points: player.points,
              description: 'Penalización por no disputar - Baja 1 grupo'
            });
          }
        } else {
          const movementInfo = calculateUnifiedLadderMovement(
            player.position,
            group.level,
            totalGroups
          );
          
          let targetGroupChange = 0;
          switch (movementInfo.type) {
            case 'up': targetGroupChange = -movementInfo.groups; break;
            case 'down': targetGroupChange = movementInfo.groups; break;
          }

          movements.push({
            playerId: player.playerId,
            currentGroup: group.level,
            currentPosition: player.position,
            targetGroupChange,
            movement: movementInfo.type,
            locked: false,
            points: player.points,
            description: movementInfo.description
          });
        }
      });
    });

    // REGLA 4: Resolver overflow con saturación
    const resolved = this.resolveSaturation(movements, totalGroups);
    
    console.log(`Movimientos: ${resolved.filter(m => m.movement === 'up').length} suben, ${resolved.filter(m => m.movement === 'down').length} bajan, ${resolved.filter(m => m.movement === 'frozen' || m.movement === 'same').length} se mantienen`);
    
    return resolved;
  }

  /**
   * Resuelve overflow/underflow con saturación determinista
   */
  private static resolveSaturation(movements: any[], totalGroups: number): any[] {
    const MAX_GROUP_SIZE = 4;
    const distributionByLevel = new Map<number, any[]>();

    for (const m of movements) {
      const targetLevel = Math.max(1, Math.min(totalGroups, m.currentGroup + m.targetGroupChange));
      
      if (!distributionByLevel.has(targetLevel)) {
        distributionByLevel.set(targetLevel, []);
      }
      distributionByLevel.get(targetLevel)!.push({
        ...m,
        targetLevel
      });
    }

    const finalMovements: any[] = [];

    for (let level = 1; level <= totalGroups; level++) {
      let playersInLevel = distributionByLevel.get(level) || [];

      if (playersInLevel.length > MAX_GROUP_SIZE) {
        playersInLevel.sort((a, b) => b.points - a.points);
        
        const staying = playersInLevel.slice(0, MAX_GROUP_SIZE);
        const overflow = playersInLevel.slice(MAX_GROUP_SIZE);

        finalMovements.push(...staying.map(p => ({
          ...p,
          targetGroupChange: p.targetLevel - p.currentGroup
        })));

        if (level < totalGroups) {
          const nextLevel = distributionByLevel.get(level + 1) || [];
          overflow.forEach(p => {
            p.targetLevel = level + 1;
            p.targetGroupChange = p.targetLevel - p.currentGroup;
            p.description += ' (reubicado por capacidad)';
          });
          distributionByLevel.set(level + 1, [...nextLevel, ...overflow]);
        } else {
          finalMovements.push(...overflow.map(p => ({
            ...p,
            targetGroupChange: p.targetLevel - p.currentGroup
          })));
        }

      } else if (playersInLevel.length < MAX_GROUP_SIZE && playersInLevel.length > 0) {
        const needed = MAX_GROUP_SIZE - playersInLevel.length;
        const nextLevel = distributionByLevel.get(level + 1) || [];

        if (nextLevel.length > MAX_GROUP_SIZE) {
          nextLevel.sort((a, b) => b.points - a.points);
          const promoted = nextLevel.splice(0, needed);
          
          promoted.forEach(p => {
            p.targetLevel = level;
            p.targetGroupChange = p.targetLevel - p.currentGroup;
            p.description += ' (promovido por espacio)';
          });

          playersInLevel.push(...promoted);
          distributionByLevel.set(level + 1, nextLevel);
        }

        finalMovements.push(...playersInLevel.map(p => ({
          ...p,
          targetGroupChange: p.targetLevel - p.currentGroup
        })));

      } else {
        finalMovements.push(...playersInLevel.map(p => ({
          ...p,
          targetGroupChange: p.targetLevel - p.currentGroup
        })));
      }
    }

    return finalMovements;
  }

  // ===============================
  // Generación de siguiente ronda
  // ===============================
  private static async generateNextRoundWithGroupManager(
    tournamentId: string,
    roundNumber: number,
    movements: any[]
  ): Promise<string> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        rounds: {
          where: { number: roundNumber - 1 },
          orderBy: { number: 'desc' },
          take: 1,
        },
      },
    });
    if (!tournament) throw new Error(ENGINE_ERROR_MESSAGES[TournamentEngineError.TOURNAMENT_NOT_FOUND]);

    const previousRound = tournament.rounds[0];
    if (!previousRound) throw new Error(ENGINE_ERROR_MESSAGES[TournamentEngineError.INVALID_ROUND_DATA]);

    const startDate = new Date(previousRound.endDate);
    const endDate = addDays(startDate, tournament.roundDurationDays);

    const newRound = await prisma.round.upsert({
      where: {
        tournamentId_number: {
          tournamentId,
          number: roundNumber
        }
      },
      update: {
        startDate,
        endDate,
        isClosed: false,
        updatedAt: new Date(),
      },
      create: {
        tournamentId,
        number: roundNumber,
        startDate,
        endDate,
        isClosed: false,
      },
    });

    const wasExisting = newRound.createdAt.getTime() !== newRound.updatedAt.getTime();
    if (wasExisting) {
      console.log(`Reutilizando ronda ${roundNumber} existente, limpiando datos...`);
      await this._cleanRoundData(newRound.id);
    } else {
      console.log(`Nueva ronda ${roundNumber} creada`);
    }

    const newGroupsDistribution = this.redistributePlayersWithMovements(movements);

    const groupsData = newGroupsDistribution.map((playersInGroup, index) => ({
      level: index + 1,
      players: playersInGroup.map((player: any, position: number) => ({
        playerId: player.playerId,
        position: position + 1,
      })),
    }));

    const result = await GroupManager.updateRoundGroups(newRound.id, groupsData, {
      deleteExisting: false,
      generateMatches: true,
      validateIntegrity: true,
    });

    if (!result.success) {
      throw new Error("Error creando grupos de la nueva ronda");
    }

    console.log(
      `Ronda ${roundNumber} configurada con ${result.groupsCreated} grupos y ${result.playersAssigned} jugadores`
    );
    return newRound.id;
  }

  private static async _cleanRoundData(roundId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.match.deleteMany({
        where: { group: { roundId } }
      });

      await tx.groupPlayer.deleteMany({
        where: { group: { roundId } }
      });

      await tx.group.deleteMany({
        where: { roundId }
      });
    });
    console.log(`Datos de ronda ${roundId} limpiados`);
  }

  private static redistributePlayersWithMovements(movements: any[]): any[][] {
    const playersByDestGroup = new Map<number, any[]>();

    movements.forEach((movement) => {
      const targetGroup = movement.currentGroup + movement.targetGroupChange;
      if (!playersByDestGroup.has(targetGroup)) {
        playersByDestGroup.set(targetGroup, []);
      }
      playersByDestGroup.get(targetGroup)!.push({
        playerId: movement.playerId,
        previousPoints: movement.points,
        movement: movement.movement,
      });
    });

    const sortedGroupLevels = Array.from(playersByDestGroup.keys()).sort((a, b) => a - b);
    const redistribution: any[][] = [];
    let allPlayersOrdered: any[] = [];

    sortedGroupLevels.forEach((level) => {
      const playersInLevel = playersByDestGroup.get(level) || [];
      playersInLevel.sort((a, b) => b.previousPoints - a.previousPoints);
      allPlayersOrdered.push(...playersInLevel);
    });

    const GROUP_SIZE = 4;
    for (let i = 0; i < allPlayersOrdered.length; i += GROUP_SIZE) {
      const groupPlayers = allPlayersOrdered.slice(i, i + GROUP_SIZE);
      if (groupPlayers.length === GROUP_SIZE) {
        redistribution.push(groupPlayers);
      } else {
        if (redistribution.length > 0) {
          redistribution[redistribution.length - 1].push(...groupPlayers);
        } else {
          redistribution.push(groupPlayers);
        }
      }
    }

    console.log(`Redistribución: ${redistribution.length} grupos generados`);
    return redistribution;
  }

  private static async applySubstituteCredit(tournamentId: string, credit: SubstituteCredit) {
    try {
      await prisma.ranking.upsert({
        where: {
          tournamentId_playerId_roundNumber: {
            tournamentId,
            playerId: credit.playerId,
            roundNumber: 0,
          },
        },
        update: {
          totalPoints: { increment: credit.points },
        },
        create: {
          tournamentId,
          playerId: credit.playerId,
          roundNumber: 0,
          totalPoints: credit.points,
          roundsPlayed: 0,
          averagePoints: 0,
          position: 999,
          ironmanPosition: 999,
          movement: 'substitute_credit',
        },
      });
    } catch (error) {
      console.warn(`No se pudo aplicar crédito de suplente para jugador ${credit.playerId}:`, error);
    }
  }

  private static async updateRankings(tournamentId: string, roundNumber: number) {
  console.log(`Actualizando rankings para torneo ${tournamentId}, ronda ${roundNumber}`);

  const playersStats = await prisma.$queryRaw<any[]>`
  SELECT *
  FROM (
    SELECT 
      p.id as "playerId",
      p.name as "playerName",
      COALESCE(SUM(gp.points), 0) as "totalPoints",
      COUNT(CASE WHEN gp."usedComodin" = false THEN 1 END) as "roundsPlayed",
      CASE 
        WHEN COUNT(CASE WHEN gp."usedComodin" = false THEN 1 END) > 0 
        THEN COALESCE(SUM(gp.points) / COUNT(CASE WHEN gp."usedComodin" = false THEN 1 END), 0)
        ELSE 0 
      END as "averagePoints",
      COALESCE(SUM(
        CASE 
          WHEN m."team1Player1Id" = p.id OR m."team1Player2Id" = p.id 
          THEN CASE WHEN m."team1Games" > m."team2Games" THEN 1 ELSE 0 END
          WHEN m."team2Player1Id" = p.id OR m."team2Player2Id" = p.id 
          THEN CASE WHEN m."team2Games" > m."team1Games" THEN 1 ELSE 0 END
          ELSE 0
        END
      ), 0) as "setsWon",
      COALESCE(SUM(
        CASE 
          WHEN m."team1Player1Id" = p.id OR m."team1Player2Id" = p.id THEN m."team1Games"
          WHEN m."team2Player1Id" = p.id OR m."team2Player2Id" = p.id THEN m."team2Games"
          ELSE 0
        END
      ), 0) as "gamesWon",
      COALESCE(SUM(
        CASE 
          WHEN m."team1Player1Id" = p.id OR m."team1Player2Id" = p.id THEN m."team2Games"
          WHEN m."team2Player1Id" = p.id OR m."team2Player2Id" = p.id THEN m."team1Games"
          ELSE 0
        END
      ), 0) as "gamesLost",
      (
        COALESCE(SUM(
          CASE 
            WHEN m."team1Player1Id" = p.id OR m."team1Player2Id" = p.id THEN m."team1Games"
            WHEN m."team2Player1Id" = p.id OR m."team2Player2Id" = p.id THEN m."team2Games"
            ELSE 0
          END
        ), 0) 
        -
        COALESCE(SUM(
          CASE 
            WHEN m."team1Player1Id" = p.id OR m."team1Player2Id" = p.id THEN m."team2Games"
            WHEN m."team2Player1Id" = p.id OR m."team2Player2Id" = p.id THEN m."team1Games"
            ELSE 0
          END
        ), 0)
      ) as "gamesDiff"
    FROM "players" p
    LEFT JOIN "group_players" gp ON p.id = gp."playerId"
    LEFT JOIN "groups" g ON gp."groupId" = g.id
    LEFT JOIN "rounds" r ON g."roundId" = r.id
    LEFT JOIN "matches" m ON g.id = m."groupId" AND m."isConfirmed" = true
    WHERE r."tournamentId" = ${tournamentId} AND r."isClosed" = true
    GROUP BY p.id, p.name
  ) stats
  ORDER BY "averagePoints" DESC, "setsWon" DESC, "gamesDiff" DESC, "gamesWon" DESC
`;

    for (let i = 0; i < playersStats.length; i++) {
      const player = playersStats[i];

      const roundsPlayed = Number(player.roundsPlayed);
      const totalPoints = Number(player.totalPoints);
      const averagePoints = Number(player.averagePoints);

      await prisma.ranking.upsert({
        where: {
          tournamentId_playerId_roundNumber: {
            tournamentId,
            playerId: player.playerId,
            roundNumber,
          },
        },
        update: {
          totalPoints,
          roundsPlayed,
          averagePoints,
          position: i + 1,
          ironmanPosition: i + 1,
          movement: 'same',
        },
        create: {
          tournamentId,
          playerId: player.playerId,
          roundNumber,
          totalPoints,
          roundsPlayed,
          averagePoints,
          position: i + 1,
          ironmanPosition: i + 1,
          movement: 'new',
        },
      });
    }

    console.log(`Rankings actualizados: ${playersStats.length} jugadores procesados`);
  }
}