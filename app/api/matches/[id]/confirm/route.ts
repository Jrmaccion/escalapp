// app/api/matches/[id]/confirm/route.ts - CORREGIDO: SOLO PUNTOS BÁSICOS
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener el match
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        group: {
          include: {
            round: {
              include: {
                tournament: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match no encontrado" }, { status: 404 });
    }

    if (match.isConfirmed) {
      return NextResponse.json({ error: "Match ya confirmado" }, { status: 400 });
    }

    // Verificar que hay resultado registrado
    if (match.team1Games == null || match.team2Games == null) {
      return NextResponse.json(
        { error: "Match sin resultado registrado (faltan juegos)" },
        { status: 400 }
      );
    }

    // Copiar a primitivas no nulas
    const t1: number = match.team1Games;
    const t2: number = match.team2Games;

    // Realizar operaciones en transacción
    const updatedMatch = await prisma.$transaction(async (tx) => {
      // 1) Confirmar el match
      await tx.match.update({
        where: { id: params.id },
        data: {
          isConfirmed: true,
          confirmedById: session.user.id,
          tiebreakScore: match.tiebreakScore ?? undefined,
          status: "COMPLETED",
        },
      });

      // 2) Calcular y asignar SOLO puntos básicos por set
      // ✅ CORREGIDO: Las rachas de continuidad se calcularán al cerrar la ronda
      const team1Won = t1 > t2;

      const allPlayerIds = [
        match.team1Player1Id,
        match.team1Player2Id,
        match.team2Player1Id,
        match.team2Player2Id,
      ];

      for (const playerId of allPlayerIds) {
        const isInWinningTeam = team1Won
          ? [match.team1Player1Id, match.team1Player2Id].includes(playerId)
          : [match.team2Player1Id, match.team2Player2Id].includes(playerId);

        const gamesWon: number = isInWinningTeam
          ? (team1Won ? t1 : t2)
          : (team1Won ? t2 : t1);

        // Puntos básicos: 1 punto por juego ganado + 1 extra si gana el set
        const basePoints = gamesWon + (isInWinningTeam ? 1 : 0);

        await tx.groupPlayer.update({
          where: {
            groupId_playerId: {
              groupId: match.groupId,
              playerId,
            },
          },
          data: {
            points: { increment: basePoints },
          },
        });
      }

      // Devolver el match confirmado
      return tx.match.findUnique({ where: { id: params.id } });
    });

    // Obtener datos actualizados del grupo
    const updatedGroup = await prisma.group.findUnique({
      where: { id: match.groupId },
      include: {
        players: {
          include: {
            player: { select: { id: true, name: true } },
          },
          orderBy: { points: "desc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      match: updatedMatch,
      groupPlayers: updatedGroup?.players ?? [],
      message: "Match confirmado. Las rachas de continuidad se calcularán al cerrar la ronda.",
    });
  } catch (error) {
    console.error("Error confirming match:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

// ✅ CORREGIDO: Remover endpoints POST para recalcular rachas
// (Ya no es necesario porque las rachas se calculan al cerrar ronda)