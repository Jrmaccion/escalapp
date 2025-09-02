// lib/rounds.ts - VERSIÓN CON TIPOS CORREGIDOS
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
    const groupPlayerInserts = [];
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

/* -------------------- OTRAS FUNCIONES EXISTENTES -------------------- */
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
      playerId: string;
      player?: { id: string };
    }>;
    matches: Array<{ id: string }>;
  }>;
  tournament: any;
};

export async function generateNextRoundFromMovements(
  roundId: string,
  groupSize: number = GROUP_SIZE
): Promise<string> {
  const current = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      groups: { 
        include: { 
          players: true, 
          matches: true 
        }, 
        orderBy: { number: "asc" } 
      },
      tournament: true,
    },
  }) as RoundWithGroups | null;

  if (!current) throw new Error("Ronda no encontrada");

  const start = new Date(current.endDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);

  const created = await prisma.round.create({
    data: {
      tournamentId: current.tournamentId,
      number: current.number + 1,
      startDate: start,
      endDate: end,
      isClosed: false,
      groups: {
        create: current.groups.map((g) => ({
          number: g.number,
          level: g.level ?? 0,
          players: {
            create: (g.players ?? []).map((p) => ({
              position: p.position ?? 1,
              playerId: p.playerId ?? p.player?.id,
            })),
          },
        })),
      },
    },
    select: { id: true },
  });

  return created.id;
}