// lib/rounds.ts
import { prisma } from "@/lib/prisma";
import { getTournamentRanking } from "./ranking";
import { addDays } from "date-fns";

/**
 * Config
 */
export const GROUP_SIZE = 4;
const STRICT_FOURS = true;

/**
 * Jugadores elegibles para una ronda (joinedRound <= roundNumber)
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
 * strategy: "ranking" usa el último ranking (si existe y no es R1); "random" => orden alfabético determinista.
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

  const eligible = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, joinedRound: { lte: currentNumber } },
    include: { player: true },
  });

  const size = Math.max(3, Math.min(8, Math.trunc(groupSize))) || GROUP_SIZE;
  if (eligible.length < Math.min(4, size)) {
    throw new Error(`No hay suficientes jugadores para crear grupos de ${size}. Encontrados: ${eligible.length}`);
  }

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
    ordered = eligible
      .map((tp) => ({ playerId: tp.playerId, name: tp.player.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const fullBlocks = Math.floor(ordered.length / size);
  const used = fullBlocks * size;
  const inBlocks = ordered.slice(0, used);
  const leftovers = ordered.slice(used);

  await prisma.$transaction(async (tx) => {
    await tx.group.deleteMany({ where: { roundId } });

    for (let g = 0; g < fullBlocks; g++) {
      const block = inBlocks.slice(g * size, (g + 1) * size);
      const group = await tx.group.create({
        data: { roundId, number: g + 1, level: g + 1 },
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

    if (!STRICT_FOURS && leftovers.length > 0) {
      // (opcional) crear grupo atípico de 3/5
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
 * Cierra una ronda (isClosed = true)
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
 * Devuelve el `id` de la ronda creada/actualizada.
 * Lanza "No se pueden generar más rondas" si nextNumber > totalRounds.
 */
export async function generateNextRoundFromMovements(
  roundId: string,
  groupSize: number = GROUP_SIZE
): Promise<string | null> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      tournament: true,
      groups: {
        include: { players: true }, // groupPlayer con points/position
        orderBy: { number: "asc" },
      },
    },
  });
  if (!round) throw new Error("Ronda no encontrada");

  const tournament = round.tournament;
  const nextNumber = round.number + 1;

  if (nextNumber > tournament.totalRounds) {
    throw new Error("No se pueden generar más rondas");
  }

  // Crear o reutilizar nextRound (limpiando grupos si existían)
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
    await prisma.round.update({
      where: { id: nextRound.id },
      data: { startDate: nextStart, endDate: nextEnd },
    });
    await prisma.group.deleteMany({ where: { roundId: nextRound.id } });
  }

  const G = round.groups.length;
  const clamp = (idx: number) => Math.max(0, Math.min(G - 1, idx));
  const size = Math.max(3, Math.min(8, Math.trunc(groupSize))) || GROUP_SIZE;

  type Move = { playerId: string; from: number; to: number; priority: number };
  const moves: Move[] = [];

  // Orden interno del grupo por puntos desc y posición asc
  round.groups.forEach((g, gi) => {
    const ordered = [...g.players].sort((a, b) => {
      if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0);
      return (a.position ?? 0) - (b.position ?? 0);
    });
    ordered.forEach((gp, idx) => {
      const pos = idx + 1;
      let delta = 0;
      let priority = 0;
      if (pos === 1) { delta = -2; priority = 10; }     // ↑↑
      else if (pos === 2) { delta = -1; priority = 8; } // ↑
      else if (pos === 3) { delta = +1; priority = 2; } // ↓
      else { delta = +2; priority = 4; }                // ↓↓
      const dest = clamp(gi + delta);
      moves.push({ playerId: gp.playerId, from: gi, to: dest, priority });
    });
  });

  // Promociones primero (↑↑, ↑), luego descensos (↓↓, ↓)
  moves.sort((a, b) => b.priority - a.priority);

  // Buckets de destino con capacidad = size
  const buckets: { playerIds: string[] }[] = Array.from({ length: G }, () => ({ playerIds: [] }));
  const capacity = Array.from({ length: G }, () => size);

  for (const mv of moves) {
    const target = mv.to;
    if (buckets[target].playerIds.length < capacity[target]) {
      buckets[target].playerIds.push(mv.playerId);
      continue;
    }
    // si lleno, buscar cercano con hueco
    let placed = false;
    for (let off = 1; off < G && !placed; off++) {
      const left = target - off;
      const right = target + off;
      if (left >= 0 && buckets[left].playerIds.length < capacity[left]) {
        buckets[left].playerIds.push(mv.playerId);
        placed = true; break;
      }
      if (right < G && buckets[right].playerIds.length < capacity[right]) {
        buckets[right].playerIds.push(mv.playerId);
        placed = true; break;
      }
    }
    if (!placed) {
      if (buckets[mv.from].playerIds.length < capacity[mv.from]) {
        buckets[mv.from].playerIds.push(mv.playerId);
      } else {
        const idx = buckets.reduce((best, _b, i) => {
          const diffBest = buckets[best].playerIds.length - capacity[best];
          const diffI = buckets[i].playerIds.length - capacity[i];
          return diffI < diffBest ? i : best;
        }, 0);
        buckets[idx].playerIds.push(mv.playerId);
      }
    }
  }

  // Altas (joinedRound == nextNumber) => último grupo
  const newJoiners = await prisma.tournamentPlayer.findMany({
    where: { tournamentId: tournament.id, joinedRound: nextNumber },
    select: { playerId: true },
  });
  if (newJoiners.length > 0) {
    const last = G - 1;
    for (const j of newJoiners) {
      buckets[last].playerIds.push(j.playerId);
    }
  }

  // Crear grupos y posiciones en nextRound
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

  return nextRound.id;
}
