// app/api/matches/[id]/confirm/route.ts
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

    // Solo admin puede confirmar (según tu versión actual)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 1) Obtener el match con el mínimo necesario para lógica de sustitutos
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        group: {
          include: {
            round: {
              include: {
                tournament: {
                  select: {
                    id: true,
                    title: true,
                    // Necesario para el crédito de sustituto (si no existe, lo tratamos como 0.5 por defecto)
                    substituteCreditFactor: true,
                  },
                },
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

    // 2) Validación de resultado
    if (match.team1Games == null || match.team2Games == null) {
      return NextResponse.json(
        { error: "Match sin resultado registrado (faltan juegos)" },
        { status: 400 }
      );
    }

    // Copias no nulas
    const t1: number = match.team1Games;
    const t2: number = match.team2Games;

    // 3) Transacción: confirmar + puntos básicos + lógica de sustitutos
    const updatedMatch = await prisma.$transaction(async (tx) => {
      // 3.1) Confirmar el match
      await tx.match.update({
        where: { id: params.id },
        data: {
          isConfirmed: true,
          confirmedById: session.user.id,
          tiebreakScore: match.tiebreakScore ?? undefined,
          status: "COMPLETED",
        },
      });

      // 3.2) Calcular SOLO puntos básicos por set
      // ⚠️ Las rachas se calcularán al cerrar la ronda (fuera de aquí)
      const team1Won = t1 > t2;

      const allPlayerIds: string[] = [
        match.team1Player1Id,
        match.team1Player2Id,
        match.team2Player1Id,
        match.team2Player2Id,
      ].filter(Boolean) as string[];

      for (const playerId of allPlayerIds) {
        const isInWinningTeam = team1Won
          ? [match.team1Player1Id, match.team1Player2Id].includes(playerId)
          : [match.team2Player1Id, match.team2Player2Id].includes(playerId);

        const gamesWon: number = isInWinningTeam ? (team1Won ? t1 : t2) : (team1Won ? t2 : t1);

        // 1 punto por juego ganado + 1 extra si gana el set
        const basePoints = gamesWon + (isInWinningTeam ? 1 : 0);

        // ✅ NUEVO: verificar sustituto configurado en GroupPlayer
        const groupPlayer = await tx.groupPlayer.findUnique({
          where: {
            groupId_playerId: {
              groupId: match.groupId,
              playerId,
            },
          },
          select: {
            id: true,
            playerId: true,
            substitutePlayerId: true,
          },
        });

        if (!groupPlayer) {
          console.warn(`GroupPlayer no encontrado para ${playerId} en grupo ${match.groupId}`);
          continue;
        }

        if (groupPlayer.substitutePlayerId) {
          // CASO: jugador con sustituto asignado por admin
          const tournament = match.group.round.tournament;
          const creditFactor =
            (tournament as any)?.substituteCreditFactor != null
              ? Number((tournament as any).substituteCreditFactor)
              : 0.5; // por defecto 50%

          const substituteCredit = basePoints * creditFactor;

          // 1) El jugador original no suma puntos (no jugó físicamente)
          //    (incrementar 0 es no-op, pero dejamos explícito por claridad)
          await tx.groupPlayer.update({
            where: { id: groupPlayer.id },
            data: { points: { increment: 0 } },
          });

          // 2) El sustituto recibe crédito en Ironman (acumulado en tournamentPlayer)
          await tx.tournamentPlayer.update({
            where: {
              tournamentId_playerId: {
                tournamentId: tournament.id,
                playerId: groupPlayer.substitutePlayerId,
              },
            },
            data: {
              substituteAppearances: { increment: substituteCredit },
            },
          });

          console.log(
            `Sustituto ${groupPlayer.substitutePlayerId} recibe ${substituteCredit} puntos de crédito (factor ${creditFactor}).`
          );
        } else {
          // CASO normal: sumar puntos básicos al jugador del grupo
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
      }

      // Devolver la versión confirmada
      return tx.match.findUnique({ where: { id: params.id } });
    });

    // 4) Devolver ranking de grupo actualizado (ordenado por puntos)
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
      message:
        "Match confirmado. Puntos básicos aplicados. Las rachas de continuidad se calcularán al cerrar la ronda.",
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

// ✅ Sin endpoints POST auxiliares: las rachas se recalculan al cerrar la ronda.
