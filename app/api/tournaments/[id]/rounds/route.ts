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

    return createSuccessResponse(rounds);
  });
}
