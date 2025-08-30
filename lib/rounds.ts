// lib/rounds.ts
import { prisma } from "@/lib/prisma";
import { getTournamentRanking, recalcRankingForRound } from "./ranking";

/**
 * Devuelve SOLO los jugadores inscritos en el torneo cuyo 'joinedRound' <= roundNumber.
 */
export async function getEligiblePlayersForRound(tournamentId: string, roundNumber: number) {
  const tPlayers = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, joinedRound: { lte: roundNumber } },
    include: { player: { include: { user: true } } },
    orderBy: { joinedRound: "asc" },
  });

  return tPlayers.map((tp) => ({
    playerId: tp.playerId,
    name: tp.player.name,
    email: tp.player.user?.email ?? "",
  }));
}

/**
 * Construye grupos por ranking (o alfabético si no hay) y asigna los jugadores en bloques de 4.
 * Strategy "ranking" u "random".
 */
export async function buildGroupsForRound(roundId: string, strategy: "ranking" | "random" = "ranking", playersPerGroup = 4) {
  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) throw new Error("Ronda no encontrada");

  const tournamentId = round.tournamentId;
  const currentNumber = round.number;

  // 1) Jugadores elegibles
  const eligible = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, joinedRound: { lte: currentNumber } },
    include: { player: true },
  });

  if (eligible.length < playersPerGroup) {
    throw new Error("No hay suficientes jugadores para crear grupos");
  }

  // 2) Orden según ranking previo (ronda anterior) o nombre
  let ordered: { playerId: string; name: string }[] = [];

  if (strategy === "ranking" && currentNumber > 1) {
    const prevRank = await getTournamentRanking(tournamentId); // última cerrada
    if (prevRank.length > 0) {
      const rankOrder = new Map(prevRank.map((r) => [r.playerId, r.position]));
      ordered = eligible
        .map((tp) => ({ playerId: tp.playerId, name: tp.player.name, pos: rankOrder.get(tp.playerId) ?? 9999 }))
        .sort((a, b) => a.pos - b.pos)
        .map(({ playerId, name }) => ({ playerId, name }));
    }
  }

  if (ordered.length === 0) {
    // Sin ranking previo, usamos orden alfabético
    ordered = eligible
      .map((tp) => ({ playerId: tp.playerId, name: tp.player.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // 3) Borrar grupos actuales (si regeneramos) y crear nuevos en bloques de playersPerGroup
  await prisma.$transaction(async (tx) => {
    await tx.group.deleteMany({ where: { roundId } });

    const totalGroups = Math.floor(ordered.length / playersPerGroup);
    for (let g = 0; g < totalGroups; g++) {
      const block = ordered.slice(g * playersPerGroup, (g + 1) * playersPerGroup);
      const group = await tx.group.create({
        data: {
          roundId,
          number: g + 1,
          level: g + 1, // puedes ajustar el criterio de 'level'
        },
      });

      // Asignar positions 1..N según el orden en el bloque
      for (let i = 0; i < block.length; i++) {
        await tx.groupPlayer.create({
          data: {
            groupId: group.id,
            playerId: block[i].playerId,
            position: i + 1,
          },
        });
      }
    }
  });
}

/**
 * Cierra una ronda y recalcula ranking para esa ronda. 
 * Aquí NO generamos la siguiente; eso lo hace otro endpoint.
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
 * A partir de una ronda cerrada, genera la siguiente con movimientos:
 * 1º sube, 2º y 3º mantienen, 4º baja. (Grupos de 4)
 */
export async function generateNextRoundFromMovements(fromRoundId: string) {
  const fromRound = await prisma.round.findUnique({
    where: { id: fromRoundId },
    include: { groups: { include: { players: true } } },
  });
  if (!fromRound) throw new Error("Ronda origen no encontrada");
  if (!fromRound.isClosed) throw new Error("La ronda origen debe estar cerrada");

  const tournament = await prisma.tournament.findUnique({
    where: { id: fromRound.tournamentId },
  });
  if (!tournament) throw new Error("Torneo no encontrado");

  const nextNumber = fromRound.number + 1;
  if (nextNumber > tournament.totalRounds) {
    throw new Error("No se pueden generar más rondas (límite del torneo)");
  }

  // Crear la ronda siguiente con fechas correlativas (misma duración)
  const start = new Date(fromRound.endDate);
  const end = new Date(start);
  end.setDate(end.getDate() + tournament.roundDurationDays);

  const nextRound = await prisma.round.create({
    data: {
      tournamentId: tournament.id,
      number: nextNumber,
      startDate: start,
      endDate: end,
      isClosed: false,
    },
  });

  // Calcular movimientos
  // Asumimos grupos de 4; players está ordenado por position 1..4
  // Primeros suben (grupo-1), últimos bajan (grupo+1), 2-3 mantienen grupo
  const movements = new Map<string, number>(); // playerId -> nextGroupNumber

  // Determinar nº de grupos actuales
  const groupCount = fromRound.groups.length;

  for (const g of fromRound.groups) {
    // ordenar por puntos y/o posición... en esta versión base,
    // usamos 'position' como orden final (ya deberías haber actualizado position según resultados al cerrar).
    const playersOrdered = [...g.players].sort((a, b) => a.position - b.position);
    if (playersOrdered.length < 4) continue;

    const first = playersOrdered[0].playerId;
    const second = playersOrdered[1].playerId;
    const third  = playersOrdered[2].playerId;
    const fourth = playersOrdered[3].playerId;

    const current = g.number;
    const up    = Math.max(1, current - 1);
    const same  = current;
    const down  = Math.min(groupCount, current + 1);

    movements.set(first, up);
    movements.set(second, same);
    movements.set(third,  same);
    movements.set(fourth, down);
  }

  // Crear grupos en la siguiente ronda y asignar jugadores en posiciones 1..4 respetando orden básico
  await prisma.$transaction(async (tx) => {
    // Asegurar existencia de todos los grupos
    for (let i = 1; i <= groupCount; i++) {
      await tx.group.create({
        data: { roundId: nextRound.id, number: i, level: i },
      });
    }

    // Insertar jugadores
    // Regla simple: en cada grupo, ordenar por (1º que sube) delante, luego 2º, 3º, y 4º que baja
    const buckets: Record<number, string[]> = {};
    for (const [playerId, targetGroup] of movements.entries()) {
      if (!buckets[targetGroup]) buckets[targetGroup] = [];
      buckets[targetGroup].push(playerId);
    }

    for (const groupNumber of Object.keys(buckets).map(Number)) {
      const g = await tx.group.findFirst({
        where: { roundId: nextRound.id, number: groupNumber },
      });
      if (!g) continue;
      const players = buckets[groupNumber];
      // clamp a 4; si entran >4 por entradas/salidas, aquí puedes decidir qué hacer. 
      // De momento cortamos a 4.
      const four = players.slice(0, 4);
      for (let i = 0; i < four.length; i++) {
        await tx.groupPlayer.create({
          data: { groupId: g.id, playerId: four[i], position: i + 1 },
        });
      }
    }
  });

  return nextRound.id;
}
