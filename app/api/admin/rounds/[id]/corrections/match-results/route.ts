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
    const {
      matchId,
      team1Games,
      team2Games,
    } = body;

    if (!matchId) {
      throwApiError(ApiErrorCode.BAD_REQUEST, "ID de partido requerido");
    }

    // Validate scores
    if (team1Games < 0 || team2Games < 0) {
      throwApiError(ApiErrorCode.BAD_REQUEST, "Los marcadores no pueden ser negativos");
    }

    // Get match to verify it belongs to this round
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        group: {
          include: {
            round: true,
          },
        },
      },
    });

    if (!match) {
      throwApiError(ApiErrorCode.NOT_FOUND, "Partido no encontrado");
    }

    if (match.group.roundId !== roundId) {
      throwApiError(
        ApiErrorCode.BAD_REQUEST,
        "El partido no pertenece a esta ronda"
      );
    }

    logger.apiRequest("PATCH", `/api/admin/rounds/${roundId}/corrections/match-results`, {
      matchId,
      oldScores: {
        team1Games: match.team1Games,
        team2Games: match.team2Games,
      },
      newScores: {
        team1Games,
        team2Games,
      },
      adminId: session.user.id,
    });

    // Update match results
    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        team1Games,
        team2Games,
      },
    });

    logger.debug("Match results corrected", {
      matchId,
      groupId: match.groupId,
      setNumber: match.setNumber,
      oldScores: {
        team1Games: match.team1Games,
        team2Games: match.team2Games,
      },
      newScores: {
        team1Games,
        team2Games,
      },
    });

    return createSuccessResponse({
      match: updatedMatch,
      message: "Resultado actualizado. Nota: Los puntos de los jugadores deben recalcularse manualmente si es necesario.",
    });
  });
}
