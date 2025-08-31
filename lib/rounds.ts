// lib/rounds.ts
import { prisma } from "@/lib/prisma";
import { getTournamentRanking } from "./ranking";
import { addDays } from "date-fns";

/**
 * Parámetros globales del motor de rondas.
 */
export const GROUP_SIZE = 4;
const STRICT_FOURS = true;

/**
 * Jugadores elegibles para una ronda (joinedRound <= roundNumber).
 * Devuelve identificación básica + email (si está).
 */
export async function getEligiblePlayersForRound(
  tournamentId: string,
  roundNumber: number
) {
  const tPlayers = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, joinedRound: { lte: roundNumber } },
    include: { player: { include: { user: true } } },
    orderBy: [{ joinedRound: "asc" }, { player: { name: "asc" } }],
  });

  return tPlayers.map((tp) => ({
    playerId: tp.playerId,
    name: tp.player.name,
    email: tp.player.user?.email ?? "",
    joinedRound: tp.joinedRound,
  }));
}

/**
 * Construye grupos de una ronda en bloques de `groupSize` (por defecto 4).
 * Estrategia:
 *  - "ranking": usa el último ranking disponible para ordenar (si ronda > 1)
 *  - "random": ignora ranking y ordena alfabéticamente (determinista)
 *
 * Devuelve: asignados, ids omitidos, nº de grupos y tamaño de grupo usado.
 */
export async function buildGroupsForRound(
  roundId: string,
  strategy: "ranking" | "random" = "ranking",
  groupSize: number = GROUP_SIZE
): Promise<{ assigned: number; skippedPlayerIds: string[]; groupCount: number; groupSize: number }> {
  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) throw new Error("Ronda no encontrada");

  const tournamentId = round.tournamentId;
  const currentNumber = round.number;

  // 1) Elegibles
  const eligible = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, joinedRound: { lte: currentNumber } },
    include: { player: true },
  });

  if (eligible.length < Math.min(4, groupSize)) {
    throw new Error(
      `No hay suficientes jugadores para crear grupos de ${groupSize}. Encontrados: ${eligible.length}`
    );
  }

  // 2) Ordenar según ranking previo o nombre
  let ordered: { playerId: string; name: string }[] = [];

  if (strategy === "ranking" && currentNumber > 1) {
    const prevRank = await getTournamentRanking(tournamentId);
    if (prevRank.length > 0) {
      const rankOrder = new Map(prevRank.map((r) => [r.playerId, r.position]));
      ordered = eligible
        .map((tp) => ({
          playerId: tp.playerId,
          name: tp.player.name,
          pos: rankOrder.get(tp.playerId) ?? 9999,
        }))
        .sort((a, b) => a.pos - b.pos)
        .map(({ playerId, name }) => ({ playerId, name }));
    }
  }

  if (ordered.length === 0) {
    // Sin ranking: alfabético (determinista)
    ordered = eligible
      .map((tp) => ({ playerId: tp.playerId, name: tp.player.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // 3) Partir en bloques exactos de `groupSize`
  const size = Math.max(3, Math.min(8, Math.trunc(groupSize))) || GROUP_SIZE;
  const fullBlocks = Math.floor(ordered.length / size);
  const used = fullBlocks * size;
  const inBlocks = ordered.slice(0, used);
  const leftovers = ordered.slice(used); // < size

  await prisma.$transaction(async (tx) => {
    // Limpiar grupos existentes de esta ronda (regeneración segura)
    await tx.group.deleteMany({ where: { roundId } });

    // Crear 1 grupo por bloque y asignar posiciones 1..size
    for (let g = 0; g < fullBlocks; g++) {
      const block = inBlocks.slice(g * size, (g + 1) * size);
      const group = await tx.group.create({
        data: {
          roundId,
          number: g + 1, // 1..N
          level: g + 1,  // mismo valor que number; la vista escalera usa level
        },
      });

      for (let i = 0; i < block.length; i++) {
        await tx.groupPlayer.create({
          data: {
            groupId: group.id,
            playerId: block[i].playerId,
            position: i + 1,
            points: 0,
            streak: 0,
          },
        });
      }
    }

    // STRICT_FOURS: no creamos grupos incompletos. Los 'leftovers' quedan sin asignar.
    if (!STRICT_FOURS && leftovers.length > 0) {
      // (opcional) crear un grupo atípico
    }
  });

  return {
    assigned: inBlocks.length,
    skippedPlayerIds: leftovers.map((p) => p.playerId),
    groupCount: fullBlocks,
    groupSize: size,
  };
}

/**
 * Marca una ronda como cerrada (isClosed = true).
 * No recalcula rankings ni genera la siguiente ronda: lo dejamos explícito.
 */
export async function closeRound(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { tournament: true },
  });
  if (!round) throw new Error("Ronda no encontrada");

  if (round.isClosed) return round;

  const updated = await prisma.round.update({
    where: { id: roundId },
    data: { isClosed: true },
  });

  return updated;
}

/**
 * Genera la siguiente ronda aplicando reglas de movimientos (↑↑, ↑, ↓, ↓↓).
 * - Satura en extremos (sin wrap-around).
 * - Prioridad: promociones (↑↑ luego ↑), después descensos (↓↓ luego ↓).
 * - Altas en la nueva ronda (joinedRound == nextRoundNumber) entran en el último grupo.
 * Devuelve la ronda creada con sus grupos.
 */
export async function generateNextRoundFromMovements(
  roundId: string,
  groupSize: number = GROUP_SIZE
) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      tournament: true,
      groups: {
        include: {
          players: true, // groupPlayer: incluye points/position
        },
        orderBy: { number: "asc" },
      },
    },
  });
  if (!round) throw new Error("Ronda no encontrada");

  const tournament = round.tournament;
  const nextNumber = round.number + 1;

  // Si ya existe la siguiente ronda, la reutilizamos (borrando y recreando grupos).
  let nextRound = await prisma.round.findFirst({
    where: { tournamentId: tournament.id, number: nextNumber },
  });

  const nextStart = addDays(round.endDate, 1);
  const nextEnd = addDays(nextStart, Math.max(1, tournament.roundDurationDays) - 1);

  if (!nextRound) {
    nextRound = await prisma.round.create({
      data: {
        tournamentId: tournament.id,
        number: nextNumber,
        startDate: nextStart,
        endDate: nextEnd,
        isClosed: false,
      },
    });
  } else {
    // Aseguramos fechas consistentes si ya existía
    await prisma.round.update({
      where: { id: nextRound.id },
      data: { startDate: nextStart, endDate: nextEnd },
    });
    // Limpieza de grupos nextRound
    await prisma.group.deleteMany({ where: { roundId: nextRound.id } });
  }

  const G = round.groups.length;
  const clamp = (idx: number) => Math.max(0, Math.min(G - 1, idx));
  const size = Math.max(3, Math.min(8, Math.trunc(groupSize))) || GROUP_SIZE;

  type Move = { playerId: string; from: number; to: number; priority: number };
  const moves: Move[] = [];

  // Construimos movimientos en base a puntos del groupPlayer (desc) y posición (asc)
  round.groups.forEach((g, gi) => {
    const ordered = [...g.players].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.position - b.position;
    });
    // asignar 1..N
    ordered.forEach((gp, idx) => {
      const pos = idx + 1;
      let delta = 0;
      let priority = 0;
      if (pos === 1) {
        delta = -2; // sube 2
        priority = 10; // ↑↑
      } else if (pos === 2) {
        delta = -1; // sube 1
        priority = 8; // ↑
      } else if (pos === 3) {
        delta = +1; // baja 1
        priority = 2; // ↓
      } else {
        delta = +2; // baja 2
        priority = 4; // ↓↓ (ligeramente antes que ↓ para rellenar huecos correctamente)
      }
      const dest = clamp(gi + delta);
      moves.push({ playerId: gp.playerId, from: gi, to: dest, priority });
    });
  });

  // Orden de aplicación: ↑↑ (10), ↑ (8), ↓↓ (4), ↓ (2)
  moves.sort((a, b) => b.priority - a.priority);

  // Creamos contenedores de destino
  const buckets: { playerIds: string[] }[] = Array.from({ length: G }, () => ({ playerIds: [] }));
  const capacity = Array.from({ length: G }, () => size);

  // Colocamos movimientos respetando capacidad
  for (const mv of moves) {
    const target = mv.to;
    if (buckets[target].playerIds.length < capacity[target]) {
      buckets[target].playerIds.push(mv.playerId);
    } else {
      // Si está lleno, intentamos “clamp” hacia el más cercano con hueco
      let placed = false;
      for (let off = 1; off < G && !placed; off++) {
        const left = target - off;
        const right = target + off;
        if (left >= 0 && buckets[left].playerIds.length < capacity[left]) {
          buckets[left].playerIds.push(mv.playerId);
          placed = true;
          break;
        }
        if (right < G && buckets[right].playerIds.length < capacity[right]) {
          buckets[right].playerIds.push(mv.playerId);
          placed = true;
          break;
        }
      }
      if (!placed) {
        // como última opción, lo dejamos en su grupo de origen si hay hueco
        if (buckets[mv.from].playerIds.length < capacity[mv.from]) {
          buckets[mv.from].playerIds.push(mv.playerId);
        } else {
          // y si tampoco, al último grupo con menor overflow
          const idx = buckets.reduce((best, _b, i) => {
            const diffBest = buckets[best].playerIds.length - capacity[best];
            const diffI = buckets[i].playerIds.length - capacity[i];
            return diffI < diffBest ? i : best;
          }, 0);
          buckets[idx].playerIds.push(mv.playerId);
        }
      }
    }
  }

  // Altas: jugadores cuyo joinedRound == nextNumber entran al último grupo
  const newJoiners = await prisma.tournamentPlayer.findMany({
    where: { tournamentId: tournament.id, joinedRound: nextNumber },
    select: { playerId: true },
  });
  if (newJoiners.length > 0) {
    const last = G - 1;
    for (const j of newJoiners) {
      if (buckets[last].playerIds.length < capacity[last]) {
        buckets[last].playerIds.push(j.playerId);
      } else {
        // si se excede, simplemente añadimos; quedará grupo “atípico”
        buckets[last].playerIds.push(j.playerId);
      }
    }
  }

  // Crear grupos en nextRound
  for (let g = 0; g < G; g++) {
    const created = await prisma.group.create({
      data: { roundId: nextRound.id, number: g + 1, level: g + 1 },
    });

    const players = buckets[g].playerIds;
    for (let i = 0; i < players.length; i++) {
      await prisma.groupPlayer.create({
        data: {
          groupId: created.id,
          playerId: players[i],
          position: i + 1,
          points: 0,
          streak: 0,
        },
      });
    }
  }

  return await prisma.round.findUnique({
    where: { id: nextRound.id },
    include: {
      groups: {
        include: { players: true },
        orderBy: { number: "asc" },
      },
      tournament: true,
    },
  });
}
