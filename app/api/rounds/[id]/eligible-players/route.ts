import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/rounds/:id/eligible-players
 * Devuelve jugadores del torneo de la ronda cuyo joinedRound <= round.number
 * (y considera joinedRound == null como 1 SOLO para Ronda 1).
 * Excluye los ya asignados a cualquier grupo de esa ronda.
 *
 * Respuesta:
 * {
 *   ok: true,
 *   roundId: string,
 *   players: Array<{ playerId: string; name: string; joinedRound?: number }>
 * }
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const roundId = params.id;

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      tournament: { select: { id: true } },
      groups: {
        select: {
          id: true,
          players: { select: { playerId: true } }, // jugadores ya asignados en esta ronda
        },
      },
    },
  });

  if (!round) {
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  }

  const tournamentId = round.tournament.id;
  const roundNumber = round.number;

  // Construimos el set de playerIds YA asignados a esta ronda
  const assignedIds = new Set<string>();
  for (const g of round.groups) {
    for (const gp of g.players) {
      assignedIds.add(gp.playerId);
    }
  }

  // Obtenemos TournamentPlayer elegibles para ESTA ronda
  // - Si roundNumber === 1 -> aceptamos joinedRound null o 1
  // - Si roundNumber  >  1 -> joinedRound <= roundNumber
  const tpCandidates = await prisma.tournamentPlayer.findMany({
    where: {
      tournamentId,
      OR: [
        ...(roundNumber === 1 ? [{ joinedRound: null as any }, { joinedRound: 1 }] : []),
        { joinedRound: { lte: roundNumber } },
      ],
    },
    select: {
      playerId: true,
      joinedRound: true,
    },
  });

  // Filtrar los que ya están asignados a grupos de ESTA ronda
  const eligibleTP = tpCandidates.filter((t) => !assignedIds.has(t.playerId));

  // Sacamos los IDs únicos
  const eligibleIds = Array.from(new Set(eligibleTP.map((t) => t.playerId)));

  if (eligibleIds.length === 0) {
    return NextResponse.json({ ok: true, roundId, players: [] });
  }

  // Traemos los jugadores (sin depender de include ni de campos inexistentes)
  const players = await prisma.player.findMany({
    where: { id: { in: eligibleIds } },
    select: { id: true, name: true }, // NOTA: tu schema no tiene email; evitamos el error 2353
  });

  // Map rápido para recuperar joinedRound por playerId
  const joinedById = new Map<string, number | null>();
  for (const t of eligibleTP) joinedById.set(t.playerId, t.joinedRound);

  // Construimos respuesta (para R1, interpretamos null como 1)
  const payload = players
    .map((p) => {
      const jr = joinedById.get(p.id) ?? null;
      return {
        playerId: p.id,
        name: p.name,
        joinedRound: jr ?? (roundNumber === 1 ? 1 : undefined),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return NextResponse.json({ ok: true, roundId, players: payload });
}
