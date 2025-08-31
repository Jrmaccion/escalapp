// lib/rounds.ts
import { prisma } from "@/lib/prisma";
import { getTournamentRanking } from "./ranking";

/**
 * Parámetros globales del motor de rondas.
 * - Tamaño de grupo por defecto = 4 (recomendado por reglas de la app).
 * - STRICT_FOURS: si hay sobrantes (<groupSize), no se crean grupos incompletos.
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
    // Sin ranking: alfabético (determinista). Si prefieres aleatorio, baraja aquí.
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
      // Si quisieras permitir 3 o 5, aquí podrías crear el último grupo "atípico".
    }
  });

  return {
    assigned: inBlocks.length,
    skippedPlayerIds: leftovers.map((p) => p.playerId),
    groupCount: fullBlocks,
    groupSize: size,
  };
}
