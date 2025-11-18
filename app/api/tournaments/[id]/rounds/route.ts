import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  withErrorHandling,
  requireAuth,
  createSuccessResponse,
  throwApiError,
  ApiErrorCode,
} from "@/lib/api-errors";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withErrorHandling(async () => {
    const session = await getServerSession(authOptions);
    requireAuth(session);

    const tournamentId = params.id;
    console.log("[Rounds API] Tournament ID received:", tournamentId);
    console.log("[Rounds API] Tournament ID type:", typeof tournamentId);

    const rounds = await prisma.round.findMany({
      where: { tournamentId },
      orderBy: { number: "asc" },
      include: {
        tournament: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    console.log("[Rounds API] Rounds found:", rounds.length);
    if (rounds.length > 0) {
      console.log("[Rounds API] First round:", {
        id: rounds[0].id,
        number: rounds[0].number,
        isClosed: rounds[0].isClosed,
        tournamentId: rounds[0].tournamentId,
      });
    }

    return createSuccessResponse(rounds);
  });
}
