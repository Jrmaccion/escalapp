// lib/rounds.ts
// REFACTORIZADO para centralizar la escritura en DB usando GroupManager
// ✅ Versión compatible: NO usa isActive / createdAt / joinedRound en las consultas Prisma

import { prisma } from "@/lib/prisma";
import { GroupManager } from "@/lib/group-manager";

// ==============================
// Tipos públicos de este módulo
// ==============================
export type BuildGroupsResult = {
  success: boolean;
  groupsCount: number;
  playersAssigned: number;
  skippedPlayerIds: string[];
  message: string;
};

export type EligiblePlayer = {
  playerId: string;
  name?: string | null;
};

export type BuildFirstRoundGroupInput = {
  playerId: string;
  name?: string | null;
};

// ==============================
const DEFAULT_GROUP_SIZE = 4;

// ==============================

/**
 * Construye grupos para una ronda concreta delegando la escritura a GroupManager.
 * strategy: "random" (baraja) | "ranking" (usa el orden provisto por elegibles)
 */
export async function buildGroupsForRound(
  roundId: string,
  strategy: "random" | "ranking" = "random",
  groupSize: number = DEFAULT_GROUP_SIZE
): Promise<BuildGroupsResult> {
  // 1) Cargar ronda + torneo
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { tournament: true },
  });

  if (!round) {
    return {
      success: false,
      groupsCount: 0,
      playersAssigned: 0,
      skippedPlayerIds: [],
      message: "Ronda no encontrada",
    };
  }
  if (round.isClosed) {
    return {
      success: false,
      groupsCount: 0,
      playersAssigned: 0,
      skippedPlayerIds: [],
      message: "La ronda está cerrada y no se puede modificar",
    };
  }

  // 2) Jugadores elegibles para esta ronda (mínimo: inscritos en el torneo)
  const eligible = await getEligiblePlayersForRound(round.tournamentId, round.number);
  if (eligible.length === 0) {
    return {
      success: false,
      groupsCount: 0,
      playersAssigned: 0,
      skippedPlayerIds: [],
      message: "No hay jugadores elegibles para esta ronda",
    };
  }

  // 3) Orden según estrategia
  let selectedPlayers = [...eligible];
  if (strategy === "random") selectedPlayers = shuffleStable(selectedPlayers);
  // "ranking": respeta el orden en el que vengan (si quieres ranking real, ordénalos previamente en BD y trae ese orden)

  // 4) Construcción de grupos en memoria
  const GROUP_SIZE = Math.max(2, groupSize || DEFAULT_GROUP_SIZE);
  const totalPlayers = selectedPlayers.length;
  const maxGroups = Math.floor(totalPlayers / GROUP_SIZE);

  const playersToSkip = totalPlayers - maxGroups * GROUP_SIZE;
  const skippedPlayers = playersToSkip > 0 ? selectedPlayers.slice(-playersToSkip) : [];
  if (playersToSkip > 0) {
    selectedPlayers = selectedPlayers.slice(0, totalPlayers - playersToSkip);
  }

  const groupsData: {
    level?: number | null;
    number?: number;
    players: Array<{ playerId: string; position?: number }>;
  }[] = [];

  for (let i = 0; i < maxGroups; i++) {
    const startIndex = i * GROUP_SIZE;
    const groupSlice = selectedPlayers.slice(startIndex, startIndex + GROUP_SIZE);

    groupsData.push({
      // En R1 nivel = i+1; en siguientes rondas lo dejamos a null (los movimientos determinarán niveles)
      level: round.number === 1 ? i + 1 : null,
      number: i + 1,
      players: groupSlice.map((p, idx) => ({
        playerId: p.playerId,
        position: idx + 1,
      })),
    });
  }

  if (groupsData.length === 0) {
    return {
      success: false,
      groupsCount: 0,
      playersAssigned: 0,
      skippedPlayerIds: skippedPlayers.map((p) => p.playerId),
      message:
        "No se han podido formar grupos con el tamaño solicitado. Reduce el tamaño del grupo o añade más jugadores.",
    };
  }

  // 5) Escritura delegada al gestor centralizado
  try {
    const result = await GroupManager.updateRoundGroups(roundId, groupsData, {
      deleteExisting: true,    // regeneramos por completo esta ronda
      generateMatches: false,  // los sets se generan por separado
      validateIntegrity: true,
    });

    return {
      success: true,
      groupsCount: result.groupsCreated,
      playersAssigned: result.playersAssigned,
      skippedPlayerIds: skippedPlayers.map((p) => p.playerId),
      message:
        skippedPlayers.length > 0
          ? `${result.groupsCreated} grupos creados. ${skippedPlayers.length} jugadores quedaron fuera.`
          : `${result.groupsCreated} grupos creados con todos los jugadores.`,
    };
  } catch (error: any) {
    return {
      success: false,
      groupsCount: 0,
      playersAssigned: 0,
      skippedPlayerIds: [],
      message: error?.message || "Error generando grupos",
    };
  }
}

/**
 * Helper para construir la estructura inicial de grupos de la Ronda 1
 * a partir de una lista de elegibles (random o ranking).
 * Devuelve el payload compatible con GroupManager.updateRoundGroups
 */
export function buildGroupsForFirstRound(
  eligiblePlayers: BuildFirstRoundGroupInput[],
  groupSize: number = DEFAULT_GROUP_SIZE,
  strategy: "random" | "ranking" = "random"
): Array<{ level?: number | null; number?: number; players: Array<{ playerId: string; position?: number }> }> {
  let pool = [...eligiblePlayers];
  if (strategy === "random") pool = shuffleStable(pool);

  const groups: Array<{ level?: number | null; number?: number; players: Array<{ playerId: string; position?: number }> }> = [];
  const GROUP_SIZE = Math.max(2, groupSize || DEFAULT_GROUP_SIZE);
  const maxGroups = Math.floor(pool.length / GROUP_SIZE);

  for (let i = 0; i < maxGroups; i++) {
    const start = i * GROUP_SIZE;
    const slice = pool.slice(start, start + GROUP_SIZE);
    groups.push({
      level: i + 1,
      number: i + 1,
      players: slice.map((p, idx) => ({ playerId: p.playerId, position: idx + 1 })),
    });
  }

  return groups;
}

// ==============================
// Elegibilidad de jugadores
// ==============================

/**
 * Devuelve los jugadores elegibles para una ronda concreta de un torneo.
 * Criterio mínimo y 100% compatible con tu schema:
 *  - Inscritos en el torneo (TournamentPlayer)
 *  - Incluye el Player para devolver name
 *  - ❌ No filtra por isActive / joinedRound (no existen en tu entrada)
 *  - ❌ No ordena por createdAt (no existe en tu entrada)
 */
export async function getEligiblePlayersForRound(
  tournamentId: string,
  _roundNumber: number
): Promise<EligiblePlayer[]> {
  const tps = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    include: { player: true },
  });

  return tps.map((tp: any) => ({
    playerId: tp.playerId,
    name: tp.player?.name ?? null,
  }));
}

// ==============================
// Utilidades internas
// ==============================

/** Barajado estable (Fisher–Yates) */
function shuffleStable<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Al final de lib/rounds.ts
export type SubstituteCreditsResult = {
  playersProcessed: number;
  totalCreditsAwarded: number;
  details?: Array<{ playerId: string; credits: number }>;
};

export async function computeSubstituteCreditsForRound(roundId: string): Promise<SubstituteCreditsResult> {
  console.warn(`[Substitutes] computeSubstituteCreditsForRound: stub (0 créditos) en rounds.ts para round ${roundId}`);
  return { playersProcessed: 0, totalCreditsAwarded: 0 };
}

// Exportaciones adicionales requeridas
export const GROUP_SIZE = DEFAULT_GROUP_SIZE;

export async function generateNextRoundFromMovements(roundId: string): Promise<{ success: boolean; message: string }> {
  // Implementación básica por ahora
  console.warn('generateNextRoundFromMovements: pendiente implementación completa');
  return {
    success: false,
    message: 'Función en desarrollo. Use el flujo normal de creación de rondas.'
  };
}