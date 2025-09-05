// lib/tournament-engine.ts - VERSIÓN ROBUSTA CON ROLLBACKS Y VALIDACIONES
import { prisma } from './prisma'
import { addDays } from 'date-fns'
import { computeSubstituteCreditsForRound } from './rounds'

// ✅ Enum para errores específicos del engine
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
  [TournamentEngineError.INTEGRITY_CHECK_FAILED]: "Verificación de integridad fallida"
} as const;

// ✅ Tipo para validación de datos críticos
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

// ✅ Verificación de integridad antes de operaciones críticas
async function validateRoundIntegrity(roundId: string): Promise<RoundIntegrityData> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      tournament: { select: { id: true, title: true } },
      groups: {
        include: {
          players: { select: { id: true } },
          matches: { 
            select: { 
              id: true, 
              isConfirmed: true,
              team1Games: true,
              team2Games: true 
            } 
          }
        }
      }
    }
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
    (acc, g) => acc + g.matches.filter(m => m.isConfirmed).length, 0
  );

  // ✅ Validaciones de consistencia
  if (groupsCount === 0) {
    throw new Error(TournamentEngineError.GROUPS_INVALID);
  }

  // Verificar que todos los grupos tienen 4 jugadores
  const invalidGroups = round.groups.filter(g => g.players.length !== 4);
  if (invalidGroups.length > 0) {
    throw new Error(TournamentEngineError.GROUPS_INVALID);
  }

  // Verificar que todos los grupos tienen 3 matches
  const invalidMatches = round.groups.filter(g => g.matches.length !== 3);
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
    timestamp: new Date()
  };
}

// ✅ Verificación de que todos los matches están completos
async function validateAllMatchesCompleted(roundId: string): Promise<boolean> {
  const incompleteMatches = await prisma.match.count({
    where: {
      group: { roundId },
      isConfirmed: false
    }
  });

  if (incompleteMatches > 0) {
    throw new Error(TournamentEngineError.MATCHES_INCOMPLETE);
  }

  return true;
}

// ✅ Snapshot para rollback en caso de error
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

async function createRoundSnapshot(roundId: string): Promise<RoundSnapshot> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { id: true, isClosed: true }
  });

  const players = await prisma.groupPlayer.findMany({
    where: { group: { roundId } },
    select: {
      id: true,
      position: true, 
      points: true,
      streak: true
    }
  });

  if (!round) {
    throw new Error(TournamentEngineError.ROUND_NOT_FOUND);
  }

  return {
    roundId,
    isClosed: round.isClosed,
    playerPositions: players.map(p => ({
      groupPlayerId: p.id,
      position: p.position,
      points: p.points,
      streak: p.streak
    })),
    timestamp: new Date()
  };
}

// ✅ Restaurar estado anterior en caso de error
async function restoreFromSnapshot(snapshot: RoundSnapshot): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // Restaurar estado de la ronda
      await tx.round.update({
        where: { id: snapshot.roundId },
        data: { isClosed: snapshot.isClosed }
      });

      // Restaurar posiciones y puntos de jugadores
      for (const player of snapshot.playerPositions) {
        await tx.groupPlayer.update({
          where: { id: player.groupPlayerId },
          data: {
            position: player.position,
            points: player.points,
            streak: player.streak
          }
        });
      }
    });
  } catch (error) {
    console.error("CRITICAL: Failed to restore snapshot", { snapshot, error });
    throw new Error(TournamentEngineError.ROLLBACK_FAILED);
  }
}

export class TournamentEngine {
  
  // ✅ Versión robusta del método principal
  static async closeRoundAndGenerateNext(roundId: string) {
    let snapshot: RoundSnapshot | null = null;
    
    try {
      // 1. Validar integridad inicial
      const integrity = await validateRoundIntegrity(roundId);
      console.log(`🔍 Cerrando ronda ${integrity.roundNumber} del torneo ${integrity.tournamentId}`);

      // 2. Crear snapshot para rollback
      snapshot = await createRoundSnapshot(roundId);
      console.log(`📸 Snapshot creado: ${snapshot.timestamp.toISOString()}`);

      // 3. Validar que todos los matches están completos
      await validateAllMatchesCompleted(roundId);

      // 4. Operación crítica en transacción atómica
      const result = await prisma.$transaction(async (tx) => {
        // Revalidar que la ronda sigue abierta (protección contra concurrencia)
        const currentRound = await tx.round.findUnique({
          where: { id: roundId },
          select: { id: true, isClosed: true, number: true, tournamentId: true }
        });

        if (!currentRound) {
          throw new Error(TournamentEngineError.CONCURRENT_MODIFICATION);
        }

        if (currentRound.isClosed) {
          throw new Error(TournamentEngineError.CONCURRENT_MODIFICATION);
        }

        // Cerrar ronda
        await tx.round.update({
          where: { id: roundId },
          data: { isClosed: true }
        });

        // Obtener datos actualizados para movimientos
        const roundWithGroups = await tx.round.findUnique({
          where: { id: roundId },
          include: {
            tournament: true,
            groups: {
              include: {
                players: {
                  include: { player: true },
                  orderBy: { points: 'desc' }
                }
              },
              orderBy: { level: 'asc' }
            }
          }
        });

        if (!roundWithGroups) {
          throw new Error(TournamentEngineError.CONCURRENT_MODIFICATION);
        }

        return roundWithGroups;
      }, {
        timeout: 30000 // 30 segundos timeout
      });

      // 5. Calcular movimientos fuera de la transacción principal
      const movements = await this.calculateLadderMovements(result.groups);
      console.log(`📊 Movimientos calculados: ${movements.length} jugadores`);

      // 6. Generar créditos de suplente
      const substituteCredits = await computeSubstituteCreditsForRound(roundId);
      console.log(`💳 Créditos de suplente: ${substituteCredits.length}`);

      // 7. Aplicar créditos y generar siguiente ronda si corresponde
      for (const credit of substituteCredits) {
        await this.applySubstituteCredit(result.tournament.id, credit);
      }

      if (result.number < result.tournament.totalRounds) {
        const nextRoundId = await this.generateNextRound(
          result.tournament.id, 
          result.number + 1, 
          movements
        );
        console.log(`🆕 Nueva ronda generada: ${nextRoundId}`);
      }

      // 8. Actualizar rankings
      await this.updateRankings(result.tournament.id, result.number);

      // 9. Verificación final de integridad
      await this.verifyOperationIntegrity(roundId, result.tournament.id);

      console.log(`✅ Ronda ${result.number} cerrada exitosamente`);
      return { 
        success: true, 
        movements, 
        substituteCredits,
        roundNumber: result.number,
        nextRoundGenerated: result.number < result.tournament.totalRounds
      };

    } catch (error: any) {
      console.error(`❌ Error cerrando ronda ${roundId}:`, error);

      // ✅ Intentar rollback si tenemos snapshot
      if (snapshot) {
        console.log(`🔄 Iniciando rollback a snapshot ${snapshot.timestamp.toISOString()}`);
        try {
          await restoreFromSnapshot(snapshot);
          console.log(`✅ Rollback completado exitosamente`);
        } catch (rollbackError) {
          console.error(`🚨 CRITICAL: Rollback failed`, { 
            originalError: error.message,
            rollbackError,
            snapshot 
          });
          throw new Error(ENGINE_ERROR_MESSAGES[TournamentEngineError.ROLLBACK_FAILED]);
        }
      }

      // Relanzar error original con contexto
      if (Object.values(TournamentEngineError).includes(error.message)) {
        throw new Error(ENGINE_ERROR_MESSAGES[error.message as TournamentEngineError]);
      }

      throw error;
    }
  }

  // ✅ Verificación de integridad post-operación
  private static async verifyOperationIntegrity(roundId: string, tournamentId: string): Promise<void> {
    try {
      // Verificar que la ronda está cerrada
      const round = await prisma.round.findUnique({
        where: { id: roundId },
        select: { isClosed: true, number: true }
      });

      if (!round || !round.isClosed) {
        throw new Error(TournamentEngineError.INTEGRITY_CHECK_FAILED);
      }

      // Verificar que existe la siguiente ronda (si no es la última)
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          rounds: {
            where: { number: { gte: round.number } },
            orderBy: { number: 'asc' }
          }
        }
      });

      if (!tournament) {
        throw new Error(TournamentEngineError.INTEGRITY_CHECK_FAILED);
      }

      // Si no es la última ronda, debe existir la siguiente
      if (round.number < tournament.totalRounds) {
        const nextRound = tournament.rounds.find(r => r.number === round.number + 1);
        if (!nextRound) {
          throw new Error(TournamentEngineError.INTEGRITY_CHECK_FAILED);
        }
      }

      console.log(`✅ Verificación de integridad pasada para ronda ${round.number}`);
    } catch (error) {
      console.error(`❌ Verificación de integridad falló:`, error);
      throw error;
    }
  }

  // ... resto de métodos existentes con mejoras menores...

  private static async calculateLadderMovements(groups: any[]) {
    const movements: any[] = []

    groups.forEach((group, groupIndex) => {
      group.players.forEach((player: any, position: number) => {
        let movement = 'same'
        let targetGroupChange = 0
        
        if (position === 0 && groupIndex > 0) {
          targetGroupChange = groupIndex >= 2 ? -2 : -1
          movement = 'up'
        }
        else if (position === 1 && groupIndex > 0) {
          targetGroupChange = -1
          movement = 'up'
        }
        else if (position === 2 && groupIndex < groups.length - 1) {
          targetGroupChange = 1
          movement = 'down'
        }
        else if (position === 3 && groupIndex < groups.length - 1) {
          targetGroupChange = groupIndex <= groups.length - 3 ? 2 : 1
          movement = 'down'
        }

        movements.push({
          playerId: player.playerId,
          currentGroup: groupIndex,
          currentPosition: position + 1,
          targetGroupChange,
          movement,
          points: player.points
        })
      })
    })

    return movements
  }

  // ✅ Generación de siguiente ronda con validaciones
  private static async generateNextRound(tournamentId: string, roundNumber: number, movements: any[]) {
    return await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          rounds: {
            where: { number: roundNumber - 1 },
            include: {
              groups: {
                include: {
                  players: {
                    include: { player: true },
                    orderBy: { points: 'desc' }
                  }
                },
                orderBy: { level: 'asc' }
              }
            }
          }
        }
      });

      if (!tournament) {
        throw new Error(TournamentEngineError.TOURNAMENT_NOT_FOUND);
      }

      const previousRound = tournament.rounds[0];
      if (!previousRound) {
        throw new Error(TournamentEngineError.INVALID_ROUND_DATA);
      }

      const startDate = new Date(previousRound.endDate);
      const endDate = addDays(startDate, tournament.roundDurationDays);

      const newRound = await tx.round.create({
        data: {
          tournamentId,
          number: roundNumber,
          startDate,
          endDate,
          isClosed: false
        }
      });

      const newGroupsDistribution = this.redistributePlayersWithCorrectMovements(
        previousRound.groups, 
        movements
      );

      // Validar que la redistribución es correcta
      const totalPlayers = movements.length;
      const redistributedPlayers = newGroupsDistribution.reduce((acc, group) => acc + group.length, 0);
      
      if (totalPlayers !== redistributedPlayers) {
        throw new Error(TournamentEngineError.PLAYER_COUNT_MISMATCH);
      }

      for (let i = 0; i < newGroupsDistribution.length; i++) {
        const group = await tx.group.create({
          data: {
            roundId: newRound.id,
            number: i + 1,
            level: i + 1
          }
        });

        const playersInGroup = [];
        for (let j = 0; j < newGroupsDistribution[i].length; j++) {
          await tx.groupPlayer.create({
            data: {
              groupId: group.id,
              playerId: newGroupsDistribution[i][j].playerId,
              position: j + 1,
              points: 0,
              streak: this.calculateNewStreak(newGroupsDistribution[i][j], roundNumber),
              usedComodin: false,
              substitutePlayerId: null
            }
          });
          
          playersInGroup.push({
            id: newGroupsDistribution[i][j].playerId,
            position: j + 1
          });
        }

        // Generar matches solo para grupos completos
        if (playersInGroup.length === 4) {
          await this.generateGroupMatches(group.id, playersInGroup);
        }
      }

      return newRound.id;
    }, {
      timeout: 60000 // 1 minuto timeout para operaciones complejas
    });
  }

  // ... resto de métodos con mejoras menores de logging y validación ...
  
  private static redistributePlayersWithCorrectMovements(groups: any[], movements: any[]) {
    const numGroups = groups.length;
    const newDistribution: any[][] = Array(numGroups).fill(null).map(() => []);

    movements.forEach(movement => {
      let targetGroup = movement.currentGroup + movement.targetGroupChange;
      targetGroup = Math.max(0, Math.min(numGroups - 1, targetGroup));

      newDistribution[targetGroup].push({
        playerId: movement.playerId,
        previousPoints: movement.points,
        movement: movement.movement
      });
    });

    newDistribution.forEach(group => {
      group.sort((a, b) => b.previousPoints - a.previousPoints);
    });

    return newDistribution;
  }

  private static async generateGroupMatches(groupId: string, players: { id: string, position: number }[]) {
    if (players.length !== 4) {
      console.warn(`Grupo ${groupId} no tiene exactamente 4 jugadores. Matches no generados.`);
      return;
    }

    const sortedPlayers = players.sort((a, b) => a.position - b.position);

    const matchConfigurations = [
      {
        setNumber: 1,
        team1: [sortedPlayers[0], sortedPlayers[3]],
        team2: [sortedPlayers[1], sortedPlayers[2]]
      },
      {
        setNumber: 2,
        team1: [sortedPlayers[0], sortedPlayers[2]],
        team2: [sortedPlayers[1], sortedPlayers[3]]
      },
      {
        setNumber: 3,
        team1: [sortedPlayers[0], sortedPlayers[1]],
        team2: [sortedPlayers[2], sortedPlayers[3]]
      }
    ];

    for (const config of matchConfigurations) {
      await prisma.match.create({
        data: {
          groupId,
          setNumber: config.setNumber,
          team1Player1Id: config.team1[0].id,
          team1Player2Id: config.team1[1].id,
          team2Player1Id: config.team2[0].id,
          team2Player2Id: config.team2[1].id,
          team1Games: null,
          team2Games: null,
          tiebreakScore: null,
          isConfirmed: false,
          reportedById: null,
          confirmedById: null,
          status: 'PENDING'
        }
      });
    }

    console.log(`✅ Generados 3 matches para grupo ${groupId}`);
  }

  private static calculateNewStreak(player: any, roundNumber: number) {
    // TODO: Implementar lógica de racha real basada en continuidad
    return 1;
  }

  private static async applySubstituteCredit(tournamentId: string, credit: any) {
    try {
      await prisma.ranking.upsert({
        where: {
          tournamentId_playerId_roundNumber: {
            tournamentId,
            playerId: credit.playerId,
            roundNumber: 0
          }
        },
        update: {
          totalPoints: { increment: credit.points }
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
          movement: 'substitute_credit'
        }
      });
    } catch (error) {
      console.warn(`No se pudo aplicar crédito de suplente para jugador ${credit.playerId}:`, error);
    }
  }

  private static async updateRankings(tournamentId: string, roundNumber: number) {
    // Implementación existente con logging mejorado
    console.log(`📊 Actualizando rankings para torneo ${tournamentId}, ronda ${roundNumber}`);
    
    const playersStats = await prisma.$queryRaw<any[]>`
      SELECT 
        p.id as playerId,
        p.name as playerName,
        COALESCE(SUM(gp.points), 0) as totalPoints,
        COUNT(CASE WHEN gp.usedComodin = false THEN 1 END) as roundsPlayed,
        CASE 
          WHEN COUNT(CASE WHEN gp.usedComodin = false THEN 1 END) > 0 
          THEN COALESCE(SUM(gp.points) / COUNT(CASE WHEN gp.usedComodin = false THEN 1 END), 0)
          ELSE 0 
        END as averagePoints
      FROM players p
      LEFT JOIN group_players gp ON p.id = gp.playerId
      LEFT JOIN groups g ON gp.groupId = g.id
      LEFT JOIN rounds r ON g.roundId = r.id
      WHERE r.tournamentId = ${tournamentId} AND r.isClosed = true
      GROUP BY p.id, p.name
      ORDER BY averagePoints DESC
    `;

    for (let i = 0; i < playersStats.length; i++) {
      const player = playersStats[i];
      
      await prisma.ranking.upsert({
        where: {
          tournamentId_playerId_roundNumber: {
            tournamentId,
            playerId: player.playerId,
            roundNumber
          }
        },
        update: {
          totalPoints: player.totalPoints,
          roundsPlayed: player.roundsPlayed,
          averagePoints: player.averagePoints,
          position: i + 1,
          ironmanPosition: i + 1,
          movement: 'same'
        },
        create: {
          tournamentId,
          playerId: player.playerId,
          roundNumber,
          totalPoints: player.totalPoints,
          roundsPlayed: player.roundsPlayed,
          averagePoints: player.averagePoints,
          position: i + 1,
          ironmanPosition: i + 1,
          movement: 'new'
        }
      });
    }

    console.log(`✅ Rankings actualizados: ${playersStats.length} jugadores procesados`);
  }
}