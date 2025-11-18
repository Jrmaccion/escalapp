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
    const { groupPlayerId, position } = body;

    if (!groupPlayerId || !position) {
      throwApiError(
        ApiErrorCode.BAD_REQUEST,
        "Se requiere groupPlayerId y position"
      );
    }

    if (position < 1 || position > 4) {
      throwApiError(
        ApiErrorCode.BAD_REQUEST,
        "La posición debe estar entre 1 y 4"
      );
    }

    // Get group player to verify it belongs to this round
    const groupPlayer = await prisma.groupPlayer.findUnique({
      where: { id: groupPlayerId },
      include: {
        group: {
          include: {
            round: true,
            players: true,
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

    const oldPosition = groupPlayer.position;

    // If position is the same, no need to update
    if (oldPosition === position) {
      return createSuccessResponse({
        message: "La posición no ha cambiado",
        groupPlayer,
      });
    }

    logger.apiRequest("PATCH", `/api/admin/rounds/${roundId}/corrections/positions`, {
      groupPlayerId,
      playerId: groupPlayer.playerId,
      playerName: groupPlayer.player.name,
      oldPosition,
      newPosition: position,
      adminId: session.user.id,
    });

    // Find the player currently in the target position
    const playerInTargetPosition = groupPlayer.group.players.find(
      (p) => p.position === position && p.id !== groupPlayerId
    );

    // Swap positions using a transaction
    await prisma.$transaction(async (tx) => {
      if (playerInTargetPosition) {
        // Swap positions: temporarily set to a safe value (0)
        await tx.groupPlayer.update({
          where: { id: groupPlayerId },
          data: { position: 0 },
        });

        await tx.groupPlayer.update({
          where: { id: playerInTargetPosition.id },
          data: { position: oldPosition },
        });

        await tx.groupPlayer.update({
          where: { id: groupPlayerId },
          data: { position: position },
        });
      } else {
        // No swap needed, just update
        await tx.groupPlayer.update({
          where: { id: groupPlayerId },
          data: { position: position },
        });
      }
    });

    logger.debug("Player position corrected", {
      groupPlayerId,
      playerId: groupPlayer.playerId,
      playerName: groupPlayer.player.name,
      oldPosition,
      newPosition: position,
      swappedWithPlayerId: playerInTargetPosition?.playerId,
    });

    const updatedGroupPlayer = await prisma.groupPlayer.findUnique({
      where: { id: groupPlayerId },
      include: {
        player: true,
      },
    });

    return createSuccessResponse({
      groupPlayer: updatedGroupPlayer,
      swapped: !!playerInTargetPosition,
    });
  });
}
