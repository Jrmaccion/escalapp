// lib/tournament-engine.ts - VERSION CORREGIDA COMPLETA (fix P2002 + credits iteration)
import { prisma } from './prisma';
import { addDays } from 'date-fns';
import { computeSubstituteCreditsForRound } from './rounds';
import { processContinuityStreaksForRound } from './streak-calculator';
import { GroupManager } from './group-manager'; // ✅ GESTOR CENTRALIZADO

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
// Tipos internos
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

// Créditos de suplente (tipo mínimo necesario aquí)
type SubstituteCredit = {
  playerId: string;
  points: number;
};

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

  // Si permites 3/5, adapta esta validación
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
  const incompleteMatches = await prisma.match.count({
    where: { group: { roundId }, isConfirmed: false },
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
  // ✅ MÉTODO PRINCIPAL CORREGIDO
  static async closeRoundAndGenerateNext(roundId: string) {
    let snapshot: RoundSnapshot | null = null;

    try {
      // 1) Integridad inicial
      const integrity = await validateRoundIntegrity(roundId);
      console.log(`🔍 Cerrando ronda ${integrity.roundNumber} del torneo ${integrity.tournamentId}`);

      // 2) Snapshot para rollback
      snapshot = await createRoundSnapshot(roundId);

      // 3) Todos los partidos deben estar confirmados
      await validateAllMatchesCompleted(roundId);

      // 4) Procesar rachas de continuidad ANTES del cierre
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
        console.log(`✅ Rachas de continuidad procesadas para ronda ${integrity.roundNumber}`);
      }

      // 5) Cierre de ronda + datos actualizados para movimientos (transacción atómica)
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
                  orderBy: { points: 'desc' },
                },
              },
              orderBy: { level: 'asc' },
            },
          },
        });

        return roundWithGroups;
      });

      if (!roundData) throw new Error("Error obteniendo datos de la ronda");

      // 6) Calcular movimientos (fuera de transacción)
      const movements = await this.calculateLadderMovements(roundData.groups);
      console.log(`📊 Movimientos calculados: ${movements.length} jugadores`);

      // 7) Créditos de suplente de la ronda cerrada
      //    🔧 NORMALIZACIÓN: el resultado puede ser un array o un objeto { credits: [...] }
      const scRaw: any = await computeSubstituteCreditsForRound(roundId);
      const substituteCredits: SubstituteCredit[] = Array.isArray(scRaw)
        ? (scRaw as SubstituteCredit[])
        : (Array.isArray(scRaw?.credits) ? (scRaw.credits as SubstituteCredit[]) : []);
      console.log(`💳 Créditos de suplente: ${substituteCredits.length}`);

      // 8) Generar siguiente ronda con GroupManager (si no es la última)
      let nextRoundGenerated = false;
      if (roundData.number < roundData.tournament.totalRounds) {
        const nextRoundId = await this.generateNextRoundWithGroupManager(
          roundData.tournament.id,
          roundData.number + 1,
          movements
        );
        console.log(`🆕 Nueva ronda generada: ${nextRoundId}`);
        nextRoundGenerated = true;
      }

      // 9) Aplicar créditos de suplente
      for (const credit of substituteCredits) {
        await this.applySubstituteCredit(roundData.tournament.id, credit);
      }

      // 10) Actualizar rankings
      await this.updateRankings(roundData.tournament.id, roundData.number);

      console.log(`✅ Ronda ${roundData.number} cerrada exitosamente`);
      return {
        success: true,
        movements,
        substituteCredits,
        roundNumber: roundData.number,
        nextRoundGenerated,
      };
    } catch (error: any) {
      console.error(`❌ Error cerrando ronda ${roundId}:`, error);
      if (snapshot) {
        try {
          await restoreFromSnapshot(snapshot);
          console.log(`✅ Rollback completado exitosamente`);
        } catch (rollbackError) {
          console.error(`🚨 CRITICAL: Rollback failed`, { error, rollbackError, snapshot });
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
  // Nueva generación de ronda con GroupManager - FIX P2002
  // ===============================
  private static async generateNextRoundWithGroupManager(
    tournamentId: string,
    roundNumber: number,
    movements: any[]
  ): Promise<string> {
    // 1) Obtener datos del torneo y ronda anterior
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

    // 2) 🔧 FIX P2002: Usar upsert para evitar conflicto de ronda duplicada
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

    // 3) Si la ronda ya existía, limpiar datos previos
    const wasExisting = newRound.createdAt.getTime() !== newRound.updatedAt.getTime();
    if (wasExisting) {
      console.log(`🔄 Reutilizando ronda ${roundNumber} existente, limpiando datos...`);
      await this._cleanRoundData(newRound.id);
    } else {
      console.log(`🆕 Nueva ronda ${roundNumber} creada`);
    }

    // 4) Calcular distribución de grupos según movimientos
    const newGroupsDistribution = this.redistributePlayersWithMovements(movements);

    // 5) Adaptar al formato de GroupManager
    const groupsData = newGroupsDistribution.map((playersInGroup, index) => ({
      level: index + 1,
      players: playersInGroup.map((player: any, position: number) => ({
        playerId: player.playerId,
        position: position + 1,
      })),
    }));

    // 6) Crear grupos y partidos de forma segura
    const result = await GroupManager.updateRoundGroups(newRound.id, groupsData, {
      deleteExisting: false, // Ya limpiamos arriba si era necesario
      generateMatches: true, // 3 partidos por grupo (rotación fija)
      validateIntegrity: true,
    });

    if (!result.success) {
      throw new Error("Error creando grupos de la nueva ronda");
    }

    console.log(
      `✅ Ronda ${roundNumber} configurada con ${result.groupsCreated} grupos y ${result.playersAssigned} jugadores`
    );
    return newRound.id;
  }

  // ===============================
  // Helper para limpiar datos de ronda existente
  // ===============================
  private static async _cleanRoundData(roundId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Eliminar matches
      await tx.match.deleteMany({
        where: { group: { roundId } }
      });

      // Eliminar group players
      await tx.groupPlayer.deleteMany({
        where: { group: { roundId } }
      });

      // Eliminar grupos
      await tx.group.deleteMany({
        where: { roundId }
      });
    });
    console.log(`🧹 Datos de ronda ${roundId} limpiados`);
  }

  // ===============================
  // Movimientos de escalera - LÓGICA CORRECTA
  // ===============================
  private static redistributePlayersWithMovements(movements: any[]): any[][] {
    // Crear mapa de jugadores por su grupo destino
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

    // Ordenar grupos por nivel (1, 2, 3...)
    const sortedGroupLevels = Array.from(playersByDestGroup.keys()).sort((a, b) => a - b);
    
    // Distribuir jugadores respetando grupos de 4
    const redistribution: any[][] = [];
    let allPlayersOrdered: any[] = [];

    // Recopilar todos los jugadores ordenados por grupo destino y puntos
    sortedGroupLevels.forEach((level) => {
      const playersInLevel = playersByDestGroup.get(level) || [];
      playersInLevel.sort((a, b) => b.previousPoints - a.previousPoints);
      allPlayersOrdered.push(...playersInLevel);
    });

    // Crear grupos de exactamente 4 jugadores
    const GROUP_SIZE = 4;
    for (let i = 0; i < allPlayersOrdered.length; i += GROUP_SIZE) {
      const groupPlayers = allPlayersOrdered.slice(i, i + GROUP_SIZE);
      if (groupPlayers.length === GROUP_SIZE) {
        redistribution.push(groupPlayers);
      } else {
        // Si hay jugadores sobrantes, añadirlos al último grupo completo
        if (redistribution.length > 0) {
          redistribution[redistribution.length - 1].push(...groupPlayers);
        } else {
          redistribution.push(groupPlayers);
        }
      }
    }

    console.log(`🔄 Redistribución: ${redistribution.length} grupos generados`);
    redistribution.forEach((group, idx) => {
      console.log(`  Grupo ${idx + 1}: ${group.length} jugadores`);
    });

    return redistribution;
  }

  private static async calculateLadderMovements(groups: any[]) {
    const movements: any[] = [];

    groups.forEach((group, groupIndex) => {
      group.players.forEach((player: any, positionIndex: number) => {
        let movement = 'same';
        let targetGroupChange = 0;

        // Lógica de escalera estándar
        switch (positionIndex) {
          case 0: // 1° lugar
            if (groupIndex > 0) { // No puede subir desde grupo 1
              targetGroupChange = groupIndex >= 2 ? -2 : -1; // Sube 2 grupos, o 1 si está en grupo 2
              movement = 'up';
            }
            break;
          
          case 1: // 2° lugar  
            if (groupIndex > 0) { // No puede subir desde grupo 1
              targetGroupChange = -1; // Sube 1 grupo
              movement = 'up';
            }
            break;
          
          case 2: // 3° lugar
            if (groupIndex < groups.length - 1) { // No puede bajar desde último grupo
              targetGroupChange = 1; // Baja 1 grupo
              movement = 'down';
            }
            break;
          
          case 3: // 4° lugar
            if (groupIndex < groups.length - 1) { // No puede bajar desde último grupo
              targetGroupChange = groupIndex <= groups.length - 3 ? 2 : 1; // Baja 2 grupos, o 1 si está en penúltimo
              movement = 'down';
            }
            break;
        }

        movements.push({
          playerId: player.playerId,
          currentGroup: groupIndex + 1, // Base-1 para logs
          currentPosition: positionIndex + 1,
          targetGroupChange,
          movement,
          points: player.points,
        });
      });
    });

    console.log(`📊 Movimientos: ${movements.filter(m => m.movement === 'up').length} suben, ${movements.filter(m => m.movement === 'down').length} bajan, ${movements.filter(m => m.movement === 'same').length} se mantienen`);
    
    return movements;
  }

  // ===============================
  // Créditos de suplente y rankings
  // ===============================
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
    console.log(`📊 Actualizando rankings para torneo ${tournamentId}, ronda ${roundNumber}`);

    // Ajusta los nombres de tablas/@@map si en tu schema difieren
    const playersStats = await prisma.$queryRaw<any[]>`
      SELECT 
        p.id as "playerId",
        p.name as "playerName",
        COALESCE(SUM(gp.points), 0) as "totalPoints",
        COUNT(CASE WHEN gp."usedComodin" = false THEN 1 END) as "roundsPlayed",
        CASE 
          WHEN COUNT(CASE WHEN gp."usedComodin" = false THEN 1 END) > 0 
          THEN COALESCE(SUM(gp.points) / COUNT(CASE WHEN gp."usedComodin" = false THEN 1 END), 0)
          ELSE 0 
        END as "averagePoints"
      FROM "players" p
      LEFT JOIN "group_players" gp ON p.id = gp."playerId"
      LEFT JOIN "groups" g ON gp."groupId" = g.id
      LEFT JOIN "rounds" r ON g."roundId" = r.id
      WHERE r."tournamentId" = ${tournamentId} AND r."isClosed" = true
      GROUP BY p.id, p.name
      ORDER BY "averagePoints" DESC
    `;

    for (let i = 0; i < playersStats.length; i++) {
      const player = playersStats[i];

      // 🔧 Fix BigInt: Convertir BigInt a Number para Prisma
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

    console.log(`✅ Rankings actualizados: ${playersStats.length} jugadores procesados`);
  }
}