import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/tournaments/:id/players/:playerId
 *
 * Reglas:
 * - Solo admin.
 * - Si el jugador tiene partidos en rondas del torneo que NO están cerradas -> 409.
 * - Si no hay conflictos, elimina sus asignaciones a grupos (groupPlayer) y su inscripción (tournamentPlayer).
 *
 * Nota de modelo:
 *   Match -> group -> roundId  (no existe roundId directo en Match)
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; playerId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournamentId = params.id;
    const playerId = params.playerId;

    // 1) Validar inscripción existente
    const tp = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      select: { playerId: true },
    });
    if (!tp) {
      return NextResponse.json({ error: "Inscripción no encontrada" }, { status: 404 });
    }

    // 2) Rondas abiertas del torneo
    const rounds = await prisma.round.findMany({
      where: { tournamentId },
      select: { id: true, isClosed: true },
    });
    const openRoundIds = rounds.filter((r) => !r.isClosed).map((r) => r.id);

    // 3) ¿Tiene partidos en rondas abiertas?
    if (openRoundIds.length > 0) {
      const setsCount = await prisma.match.count({
        where: {
          // Importante: Match -> group -> roundId
          group: {
            roundId: { in: openRoundIds },
          },
          OR: [
            { team1Player1Id: playerId },
            { team1Player2Id: playerId },
            { team2Player1Id: playerId },
            { team2Player2Id: playerId },
          ],
        },
      });

      if (setsCount > 0) {
        return NextResponse.json(
          {
            error:
              "No se puede eliminar: el jugador tiene partidos en rondas no cerradas. " +
              "Cierra la ronda o elimina/ajusta esos partidos primero.",
          },
          { status: 409 }
        );
      }
    }

    // 4) Borrar asignaciones a grupos del torneo + inscripción
    const groups = await prisma.group.findMany({
      where: { round: { tournamentId } },
      select: { id: true },
    });
    const groupIds = groups.map((g: { id: string }) => g.id);

    await prisma.$transaction(async (tx) => {
      if (groupIds.length > 0) {
        await tx.groupPlayer.deleteMany({
          where: { groupId: { in: groupIds }, playerId },
        });
      }
      await tx.tournamentPlayer.delete({
        where: { tournamentId_playerId: { tournamentId, playerId } },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /tournaments/:id/players/:playerId error", err);
    return NextResponse.json(
      { error: "Error interno eliminando jugador del torneo" },
      { status: 500 }
    );
  }
}
