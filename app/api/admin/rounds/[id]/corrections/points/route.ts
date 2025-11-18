import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  withErrorHandling,
  requireAuth,
  createSuccessResponse,
  throwApiError,
  ApiErrorCode,
} from "@/lib/api-errors";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withErrorHandling(async () => {
    const session = await getServerSession(authOptions);
    requireAuth(session);

    if (!session.user.isAdmin) {
      throwApiError(ApiErrorCode.FORBIDDEN, "Acceso solo para administradores");
    }

    const roundId = params.id;

    const body = await req.json();
    const { groupPlayerId, points } = body;

    if (!groupPlayerId || points === undefined || points === null) {
      throwApiError(
        ApiErrorCode.BAD_REQUEST,
        "Se requiere groupPlayerId y points"
      );
    }

    if (points < 0) {
      throwApiError(ApiErrorCode.BAD_REQUEST, "Los puntos no pueden ser negativos");
    }

    // Get group player to verify it belongs to this round
    const groupPlayer = await prisma.groupPlayer.findUnique({
      where: { id: groupPlayerId },
      include: {
        group: {
          include: {
            round: true,
          },
        },
        player: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!groupPlayer) {
      throwApiError(ApiErrorCode.NOT_FOUND, "Jugador en grupo no encontrado");
    }

    if (groupPlayer.group.roundId !== roundId) {
      throwApiError(
        ApiErrorCode.BAD_REQUEST,
        "El jugador no pertenece a esta ronda"
      );
    }

    logger.apiRequest("PATCH", `/api/admin/rounds/${roundId}/corrections/points`, {
      groupPlayerId,
      playerId: groupPlayer.playerId,
      playerName: groupPlayer.player.name,
      oldPoints: groupPlayer.points,
      newPoints: points,
      adminId: session.user.id,
    });

    // Update points
    const updatedGroupPlayer = await prisma.groupPlayer.update({
      where: { id: groupPlayerId },
      data: {
        points: points,
      },
    });

    logger.debug("Player points manually corrected", {
      groupPlayerId,
      playerId: groupPlayer.playerId,
      playerName: groupPlayer.player.name,
      oldPoints: groupPlayer.points,
      newPoints: points,
    });

    return createSuccessResponse({
      groupPlayer: updatedGroupPlayer,
    });
  });
}
