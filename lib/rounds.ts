// lib/rounds.ts
import { prisma } from "@/lib/prisma";
import { getTournamentRanking, recalcRankingForRound } from "./ranking";
import { addDays } from "date-fns";

/**
 * Parámetros globales del motor de rondas.
 * - Tamaño fijo de grupo en 4 (recomendado por reglas de la app).
 * - STRICT_FOURS: si hay sobrantes (<4), no se crean grupos incompletos.
 */
export const GROUP_SIZE = 4;
const STRICT_FOURS = true;

/**
 * Jugadores elegibles para una ronda (joinedRound <= roundNumber).
 * Devuelve identificación básica + email para ayudar a la UI.
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
 * Construye grupos de una ronda en bloques exactos de 4 (o los que marque GROUP_SIZE),
 * evitando grupos incompletos si STRICT_FOURS = true.
 * Estrategia:
 *  - "ranking": usa el último ranking disponible (ronda cerrada) para ordenar.
 *  - "random": ignora ranking y ordena alfabéticamente (o embaraja si quieres).
 */
export async function buildGroupsForRound(
  roundId: string,
  strategy: "ranking" | "random" = "ranking"
) {
  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) throw new Error("Ronda no encontrada");

  const tournamentId = round.tournamentId;
  const currentNumber = round.number;

  // 1) Elegibles
  const eligible = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, joinedRound: { lte: currentNumber } },
    include: { player: true },
  });

  if (eligible.length < GROUP_SIZE) {
    throw new Error(
      `No hay suficientes jugadores para crear grupos de ${GROUP_SIZE}`
    );
  }

  // 2) Ordenar según ranking previo o nombre
  let ordered: { playerId: string; name: string }[] = [];

  if (strategy === "ranking" && currentNumber > 1) {
    const prevRank = await getTournamentRanking(tournamentId); // última cerrada
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
    // Sin ranking: alfabético (si prefieres aleatorio, aquí puedes barajar)
    ordered = eligible
      .map((tp) => ({ playerId: tp.playerId, name: tp.player.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // 3) Partir en bloques exactos de GROUP_SIZE
  const fullBlocks = Math.floor(ordered.length / GROUP_SIZE);
  const used = fullBlocks * GROUP_SIZE;
  const inBlocks = ordered.slice(0, used);
  const leftovers = ordered.slice(used); // < GROUP_SIZE

  await prisma.$transaction(async (tx) => {
    // Limpiar grupos existentes de esta ronda (regeneración segura)
    await tx.group.deleteMany({ where: { roundId } });

    // Crear 1 grupo por bloque y asignar posiciones 1..GROUP_SIZE
    for (let g = 0; g < fullBlocks; g++) {
      const block = inBlocks.slice(g * GROUP_SIZE, (g + 1) * GROUP_SIZE);
      const group = await tx.group.create({
        data: {
          roundId,
          number: g + 1, // 1..N
          level: g + 1, // mismo valor que number; la vista escalera usa level
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
  });

  // Útil para UI/logs: cuántos quedaron fuera
  return { assigned: inBlocks.length, skippedPlayerIds: leftovers.map((p) => p.playerId) };
}

/**
 * Cierra una ronda (isClosed=true) y recalcula el ranking para esa ronda.
 * La generación de la siguiente ronda se hace con generateNextRoundFromMovements().
 */
export async function closeRound(roundId: string) {
  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) throw new Error("Ronda no encontrada");

  await prisma.round.update({
    where: { id: roundId },
    data: { isClosed: true },
  });

  await recalcRankingForRound(round.tournamentId, round.number);
}

/**
 * Genera la siguiente ronda a partir de la cerrada:
 * - 1º sube (si ya está en el grupo 1, se queda).
 * - 4º baja (si ya está en el último, se queda).
 * - 2º y 3º mantienen.
 * - Nuevos jugadores con joinedRound == nextNumber entran en el último grupo.
 * - Se crean grupos en bloques exactos de GROUP_SIZE.
 * - Si algún grupo > GROUP_SIZE durante movimientos, rebosa hacia abajo.
 * - Si la ronda siguiente no existe, se crea derivando fechas.
 */
export async function generateNextRoundFromMovements(fromRoundId: string) {
  const fromRound = await prisma.round.findUnique({
    where: { id: fromRoundId },
    include: {
      tournament: true,
      groups: {
        include: {
          players: {
            include: { player: true },
            orderBy: { points: "desc" }, // clasificación interna del grupo
          },
        },
        orderBy: { number: "asc" }, // 1 es el grupo más alto
      },
    },
  });
  if (!fromRound) throw new Error("Ronda origen no encontrada");
  if (!fromRound.isClosed) throw new Error("La ronda origen debe estar cerrada");

  const tournament = fromRound.tournament;
  const nextNumber = fromRound.number + 1;

  if (nextNumber > tournament.totalRounds) {
    throw new Error("No se pueden generar más rondas (límite del torneo)");
  }

  // Buscar/crear la siguiente ronda
  let nextRound = await prisma.round.findFirst({
    where: { tournamentId: tournament.id, number: nextNumber },
  });

  if (!nextRound) {
    const start =
      fromRound.endDate ?? addDays(fromRound.startDate, tournament.roundDurationDays);
    const end = addDays(start, tournament.roundDurationDays);
    nextRound = await prisma.round.create({
      data: {
        tournamentId: tournament.id,
        number: nextNumber,
        startDate: start,
        endDate: end,
        isClosed: false,
      },
    });
  }

  // Limpiar cualquier grupo ya existente en la siguiente (si hubo intentos previos)
  await prisma.group.deleteMany({ where: { roundId: nextRound.id } });

  const previousGroupCount = fromRound.groups.length;
  const playersPerGroup = GROUP_SIZE;

  // Mapa de movimientos: playerId -> grupo destino
  const movements = new Map<string, number>();

  for (const g of fromRound.groups) {
    const current = g.number;
    const sorted = g.players; // ya viene descendente por puntos
    const first = sorted[0]?.playerId;
    const second = sorted[1]?.playerId;
    const third = sorted[2]?.playerId;
    const fourth = sorted[3]?.playerId;

    if (first) movements.set(first, Math.max(1, current - 1)); // sube
    if (second) movements.set(second, current); // mantiene
    if (third) movements.set(third, current); // mantiene
    if (fourth) movements.set(fourth, Math.min(previousGroupCount, current + 1)); // baja
  }

  // Nuevos que se incorporan en esta ronda
  const newJoiners = await prisma.tournamentPlayer.findMany({
    where: { tournamentId: tournament.id, joinedRound: nextNumber },
    select: { playerId: true },
    orderBy: { playerId: "asc" },
  });

  // Buckets por grupo (1..N). Empezamos con el nº de grupos previo.
  const buckets: Record<number, string[]> = {};
  const baseGroupCount = previousGroupCount;
  for (let i = 1; i <= baseGroupCount; i++) buckets[i] = [];

  // Colocar los que se mueven
  for (const [playerId, targetGroup] of movements.entries()) {
    const t = Math.min(Math.max(targetGroup, 1), baseGroupCount);
    buckets[t].push(playerId);
  }

  // Añadir nuevos al último grupo
  if (newJoiners.length) {
    if (!buckets[baseGroupCount]) buckets[baseGroupCount] = [];
    for (const nj of newJoiners) buckets[baseGroupCount].push(nj.playerId);
  }

  // Rebose: si algún grupo > GROUP_SIZE, derramamos hacia abajo creando grupos extra si hace falta
  let groupIndex = 1;
  while (true) {
    const current = buckets[groupIndex];
    if (!current) break;

    if (current.length > playersPerGroup) {
      const spill = current.splice(playersPerGroup);
      // Asegurar bucket del siguiente grupo (crearlo si no existe)
      if (!buckets[groupIndex + 1]) buckets[groupIndex + 1] = [];
      buckets[groupIndex + 1].push(...spill);
    }
    groupIndex += 1;
  }

  // Ahora creamos los grupos de la siguiente ronda con los buckets finales,
  // pero SOLO en bloques exactos de GROUP_SIZE (STRICT_FOURS).
  const sortedGroups = Object.keys(buckets)
    .map(Number)
    .sort((a, b) => a - b);

  // Aplanar manteniendo orden por grupo, pero aplicando STRICT_FOURS al final:
  // Tomamos tantos jugadores como quepan en bloques exactos.
  const flatPlayers: string[] = [];
  for (const gnum of sortedGroups) {
    flatPlayers.push(...buckets[gnum]);
  }

  const fullBlocks = Math.floor(flatPlayers.length / playersPerGroup);
  const used = fullBlocks * playersPerGroup;
  const usable = flatPlayers.slice(0, used);

  // Crear grupos y asignar posiciones
  await prisma.$transaction(async (tx) => {
    for (let g = 0; g < fullBlocks; g++) {
      const startIdx = g * playersPerGroup;
      const slice = usable.slice(startIdx, startIdx + playersPerGroup);

      const group = await tx.group.create({
        data: {
          roundId: nextRound!.id,
          number: g + 1,
          level: g + 1, // peldaño visual
        },
      });

      for (let i = 0; i < slice.length; i++) {
        await tx.groupPlayer.create({
          data: {
            groupId: group.id,
            playerId: slice[i],
            position: i + 1,
            points: 0,
            streak: 0,
          },
        });
      }
    }
  });

  return nextRound.id;
}
