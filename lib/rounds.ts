// lib/rounds.ts - VERSIÓN COMPLETA SIN ERRORES TYPESCRIPT
import { prisma } from "@/lib/prisma";

export const GROUP_SIZE = 4 as const;

export type EligiblePlayer = {
  playerId: string;
  name: string;
  joinedRound?: number | null;
};

// Tipos específicos para el resultado de buildGroupsForRound
type GroupData = {
  number: number;
  level: number | null;
  players: Array<{
    playerId: string;
    position: number;
  }>;
};

type BuildGroupsResult = {
  success: boolean;
  groupsCount: number;
  playersAssigned: number;
  skippedPlayerIds: string[];
  message?: string;
};

export async function getEligiblePlayersForRound(
  tournamentId: string,
  roundNumber: number
): Promise<EligiblePlayer[]> {
  const tps = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, joinedRound: { lte: roundNumber } },
    include: { player: { select: { id: true, name: true } } },
    orderBy: { joinedRound: "asc" },
  });

  return tps
    .map((tp) => ({
      playerId: tp.player.id,
      name: tp.player.name,
      joinedRound: tp.joinedRound ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* -------------------- FUNCIÓN CORREGIDA PARA CREAR GRUPOS -------------------- */
export async function buildGroupsForRound(
  roundId: string,
  strategy: "random" | "ranking" = "random"
): Promise<BuildGroupsResult> {
  // 1) Obtener la ronda y sus datos
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      tournament: { select: { id: true, title: true } }
    }
  });

  if (!round) {
    throw new Error("Ronda no encontrada");
  }

  // 2) Obtener jugadores elegibles para esta ronda
  const eligiblePlayers = await getEligiblePlayersForRound(
    round.tournament.id,
    round.number
  );

  if (eligiblePlayers.length === 0) {
    return {
      success: false,
      groupsCount: 0,
      playersAssigned: 0,
      skippedPlayerIds: [],
      message: "No hay jugadores elegibles para esta ronda"
    };
  }

  // 3) Calcular cuántos grupos se pueden crear
  const maxGroups = Math.floor(eligiblePlayers.length / GROUP_SIZE);
  const playersToAssign = maxGroups * GROUP_SIZE;
  const playersToSkip = eligiblePlayers.length - playersToAssign;

  if (maxGroups === 0) {
    return {
      success: false,
      groupsCount: 0,
      playersAssigned: 0,
      skippedPlayerIds: eligiblePlayers.map(p => p.playerId),
      message: `No se pueden crear grupos: solo hay ${eligiblePlayers.length} jugadores y se necesitan mínimo ${GROUP_SIZE}`
    };
  }

  // 4) Seleccionar jugadores (los primeros N múltiplos de 4)
  const selectedPlayers = eligiblePlayers.slice(0, playersToAssign);
  const skippedPlayers = eligiblePlayers.slice(playersToAssign);

  // 5) Distribuir en grupos - TIPO EXPLÍCITO
  const groupsData: GroupData[] = [];
  for (let i = 0; i < maxGroups; i++) {
    const startIndex = i * GROUP_SIZE;
    const groupPlayers = selectedPlayers.slice(startIndex, startIndex + GROUP_SIZE);
    
    groupsData.push({
      number: i + 1,
      level: round.number === 1 ? i + 1 : null, // En R1 nivel = número, después se calcula
      players: groupPlayers.map((player, index) => ({
        playerId: player.playerId,
        position: index + 1
      }))
    });
  }

  // 6) Crear grupos en la base de datos
  await prisma.$transaction(async (tx) => {
    // Crear los grupos
    await tx.group.createMany({
      data: groupsData.map(g => ({
        roundId: roundId,
        number: g.number,
        level: g.level ?? 0
      }))
    });

    // Obtener los IDs de los grupos creados
    const createdGroups = await tx.group.findMany({
      where: { roundId },
      orderBy: { number: 'asc' },
      select: { id: true, number: true }
    });

    // Crear las asignaciones de jugadores
    const groupPlayerInserts: Array<{
      groupId: string;
      playerId: string;
      position: number;
      points: number;
      streak: number;
      usedComodin: boolean;
    }> = [];
    for (let i = 0; i < groupsData.length; i++) {
      const groupData = groupsData[i];
      const group = createdGroups.find(g => g.number === groupData.number);
      
      if (group) {
        for (const player of groupData.players) {
          groupPlayerInserts.push({
            groupId: group.id,
            playerId: player.playerId,
            position: player.position,
            points: 0,
            streak: 0,
            usedComodin: false
          });
        }
      }
    }

    if (groupPlayerInserts.length > 0) {
      await tx.groupPlayer.createMany({
        data: groupPlayerInserts
      });
    }
  });

  return {
    success: true,
    groupsCount: maxGroups,
    playersAssigned: playersToAssign,
    skippedPlayerIds: skippedPlayers.map(p => p.playerId),
    message: playersToSkip > 0 
      ? `${maxGroups} grupos creados. ${playersToSkip} jugadores quedaron fuera por no completar grupos de ${GROUP_SIZE}.`
      : `${maxGroups} grupos creados con todos los jugadores elegibles.`
  };
}

/* -------------------- HELPER PARA RONDA 1 ESPECÍFICAMENTE -------------------- */
export function buildGroupsForFirstRound(
  players: { playerId: string; name: string }[],
  groupSize: number = GROUP_SIZE
): GroupData[] {
  // Ordenar alfabéticamente para distribución determinista en R1
  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));
  
  const chunks: typeof players[] = [];
  for (let i = 0; i < sortedPlayers.length; i += groupSize) {
    chunks.push(sortedPlayers.slice(i, i + groupSize));
  }
  
  return chunks.map((chunk, idx) => ({
    number: idx + 1,
    level: idx + 1, // En R1, nivel = número del grupo
    players: chunk.map((p, i) => ({ 
      playerId: p.playerId, 
      position: i + 1 
    })),
  }));
}

/* -------------------- FUNCIÓN CERRAR RONDA -------------------- */
export async function closeRound(roundId: string) {
  const round = await prisma.round.update({
    where: { id: roundId },
    data: { isClosed: true },
    select: {
      id: true,
      tournamentId: true,
      number: true,
      startDate: true,
      endDate: true,
      isClosed: true,
    },
  });
  return round;
}

// Tipo para el resultado de la query de ronda con grupos
type RoundWithGroups = {
  id: string;
  number: number;
  endDate: Date;
  tournamentId: string;
  groups: Array<{
    id: string;
    number: number;
    level: number;
    players: Array<{
      position: number;
      points: number;
      playerId: string;
      usedComodin: boolean;
      substitutePlayerId: string | null;
      player?: { id: string; name: string };
    }>;
    matches: Array<{ id: string }>;
  }>;
  tournament: any;
};

/**
 * FUNCIÓN CORREGIDA: Aplica movimientos de escalera correctos
 * 1° lugar: sube 2 grupos, 2° lugar: sube 1 grupo
 * 3° lugar: baja 1 grupo, 4° lugar: baja 2 grupos
 */
export async function generateNextRoundFromMovements(
  roundId: string,
  groupSize: number = GROUP_SIZE
): Promise<string> {
  const current = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      groups: { 
        include: { 
          players: { 
            include: { player: { select: { id: true, name: true } } },
            orderBy: { points: 'desc' } // Ordenar por puntos descendente
          }, 
          matches: true 
        }, 
        orderBy: { level: "asc" } // Ordenar grupos por nivel
      },
      tournament: true,
    },
  }) as RoundWithGroups | null;

  if (!current) throw new Error("Ronda no encontrada");

  const start = new Date(current.endDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);

  // Calcular movimientos para cada jugador
  const allPlayerMovements: Array<{
    playerId: string;
    currentGroupLevel: number;
    currentPosition: number;
    targetGroupLevel: number;
    points: number;
    usedComodin: boolean;
    substitutePlayerId: string | null;
  }> = [];

  current.groups.forEach((group, groupIndex) => {
    group.players.forEach((player, positionIndex) => {
      const currentPosition = positionIndex + 1;
      const currentLevel = group.level;
      let targetLevel = currentLevel;

      // Aplicar movimientos según posición
      switch (currentPosition) {
        case 1: // 1° sube 2 grupos (si es posible)
          if (currentLevel > 2) {
            targetLevel = currentLevel - 2;
          } else if (currentLevel > 1) {
            targetLevel = currentLevel - 1;
          }
          break;
        case 2: // 2° sube 1 grupo (si es posible)
          if (currentLevel > 1) {
            targetLevel = currentLevel - 1;
          }
          break;
        case 3: // 3° baja 1 grupo (si es posible)
          if (currentLevel < current.groups.length) {
            targetLevel = currentLevel + 1;
          }
          break;
        case 4: // 4° baja 2 grupos (si es posible)
          if (currentLevel <= current.groups.length - 2) {
            targetLevel = currentLevel + 2;
          } else if (currentLevel < current.groups.length) {
            targetLevel = currentLevel + 1;
          }
          break;
      }

      allPlayerMovements.push({
        playerId: player.playerId,
        currentGroupLevel: currentLevel,
        currentPosition,
        targetGroupLevel: targetLevel,
        points: player.points,
        usedComodin: player.usedComodin,
        substitutePlayerId: player.substitutePlayerId
      });
    });
  });

  // Agrupar jugadores por grupo destino
  const newGroupDistribution: Map<number, typeof allPlayerMovements> = new Map();
  
  allPlayerMovements.forEach(movement => {
    if (!newGroupDistribution.has(movement.targetGroupLevel)) {
      newGroupDistribution.set(movement.targetGroupLevel, []);
    }
    newGroupDistribution.get(movement.targetGroupLevel)!.push(movement);
  });

  // Ordenar jugadores dentro de cada grupo por puntos (descendente)
  newGroupDistribution.forEach(players => {
    players.sort((a, b) => b.points - a.points);
  });

  // Crear nueva ronda
  const created = await prisma.round.create({
    data: {
      tournamentId: current.tournamentId,
      number: current.number + 1,
      startDate: start,
      endDate: end,
      isClosed: false,
    },
  });

  // Crear grupos en la nueva ronda
  const sortedGroupLevels = Array.from(newGroupDistribution.keys()).sort((a, b) => a - b);
  
  for (let i = 0; i < sortedGroupLevels.length; i++) {
    const groupLevel = sortedGroupLevels[i];
    const playersInGroup = newGroupDistribution.get(groupLevel) || [];
    
    if (playersInGroup.length === 0) continue;

    const group = await prisma.group.create({
      data: {
        roundId: created.id,
        number: i + 1,
        level: i + 1, // Renumerar niveles secuencialmente
      }
    });

    // Crear asignaciones de jugadores
    for (let j = 0; j < playersInGroup.length; j++) {
      const playerMovement = playersInGroup[j];
      await prisma.groupPlayer.create({
        data: {
          groupId: group.id,
          playerId: playerMovement.playerId,
          position: j + 1,
          points: 0, // Reiniciar puntos para nueva ronda
          streak: calculateStreak(playerMovement.currentPosition), // Calcular racha
          usedComodin: false, // Reiniciar comodín
          substitutePlayerId: null, // Reiniciar suplente
        }
      });
    }

    // Generar matches automáticamente para el grupo si tiene exactamente 4 jugadores
    if (playersInGroup.length === GROUP_SIZE) {
      await generateMatchesForGroup(group.id);
    }
  }

  return created.id;
}

/**
 * Calcula la racha basada en la posición en el grupo anterior
 */
function calculateStreak(previousPosition: number): number {
  switch (previousPosition) {
    case 1: return 3; // Ganador del grupo
    case 2: return 2; // Segundo lugar
    case 3: return 1; // Tercer lugar
    case 4: return 0; // Cuarto lugar
    default: return 1;
  }
}

/**
 * Genera los 3 matches para un grupo de 4 jugadores
 */
async function generateMatchesForGroup(groupId: string) {
  const players = await prisma.groupPlayer.findMany({
    where: { groupId },
    orderBy: { position: 'asc' },
    select: { playerId: true, position: true }
  });

  if (players.length !== 4) {
    console.warn(`Grupo ${groupId} no tiene exactamente 4 jugadores. Matches no generados.`);
    return;
  }

  const matchConfigurations = [
    {
      setNumber: 1,
      team1: [players[0], players[3]], // #1 + #4
      team2: [players[1], players[2]]  // #2 + #3
    },
    {
      setNumber: 2,
      team1: [players[0], players[2]], // #1 + #3
      team2: [players[1], players[3]]  // #2 + #4
    },
    {
      setNumber: 3,
      team1: [players[0], players[1]], // #1 + #2
      team2: [players[2], players[3]]  // #3 + #4
    }
  ];

  for (const config of matchConfigurations) {
    await prisma.match.create({
      data: {
        groupId,
        setNumber: config.setNumber,
        team1Player1Id: config.team1[0].playerId,
        team1Player2Id: config.team1[1].playerId,
        team2Player1Id: config.team2[0].playerId,
        team2Player2Id: config.team2[1].playerId,
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

  console.log(`Generados 3 matches para grupo ${groupId}`);
}

/* -------------------------------------------------------------------------- */
/*                NUEVO: Créditos de suplente (solo Ironman)                  */
/* -------------------------------------------------------------------------- */

/**
 * Genera créditos de suplente para Ironman:
 * - Suma factor (%) * puntos del titular del grupo en esta ronda.
 * - No cuenta como jugada (played=false), no afecta media ni racha.
 * - Cap opcional por ronda (p. ej., 8 puntos) para evitar outliers.
 */
export async function computeSubstituteCreditsForRound(
  roundId: string
): Promise<
  Array<{
    playerId: string;
    roundId: string;
    points: number;
    played: boolean;
    substituteFor: string;
  }>
> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      tournament: { select: { substituteCreditFactor: true } },
      groups: { 
        include: { 
          players: { 
            include: { 
              player: { select: { name: true } } 
            } 
          } 
        } 
      },
    },
  });
  
  if (!round) return [];

  const factor = round.tournament?.substituteCreditFactor ?? 0.5;
  const capPerRound = 8; // ajustable

  const credits: Array<{ 
    playerId: string; 
    roundId: string; 
    points: number; 
    played: boolean;
    substituteFor: string;
  }> = [];

  for (const g of round.groups) {
    for (const gp of g.players) {
      // Verificar si hay un suplente asignado
      const subId = gp.substitutePlayerId;
      if (!subId) continue;

      const basePoints = gp.points ?? 0;
      const credit = Math.min(basePoints * factor, capPerRound);

      if (credit > 0) {
        credits.push({
          playerId: subId,
          roundId,
          points: credit,
          played: false, // clave: no cuenta jugada
          substituteFor: gp.player.name
        });
      }
    }
  }

  return credits;
}