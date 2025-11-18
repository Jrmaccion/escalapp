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

    const roundId = params.id;

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: true,
        groups: {
          include: {
            players: {
              include: {
                player: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: {
                position: "asc",
              },
            },
            matches: {
              orderBy: {
                setNumber: "asc",
              },
            },
          },
          orderBy: {
            number: "asc",
          },
        },
      },
    });

    if (!round) {
      throwApiError(ApiErrorCode.NOT_FOUND, "Ronda no encontrada");
    }

    // Get all unique player IDs from matches
    const playerIds = new Set<string>();
    round.groups.forEach((group: any) => {
      group.matches.forEach((match: any) => {
        playerIds.add(match.team1Player1Id);
        playerIds.add(match.team1Player2Id);
        playerIds.add(match.team2Player1Id);
        playerIds.add(match.team2Player2Id);
      });
    });

    // Fetch all players
    const players = await prisma.player.findMany({
      where: {
        id: {
          in: Array.from(playerIds),
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const playerMap = new Map(players.map(p => [p.id, p]));

    // Enhance matches with player data
    const enhancedRound = {
      ...round,
      groups: round.groups.map((group: any) => ({
        ...group,
        matches: group.matches.map((match: any) => ({
          ...match,
          team1Player1: playerMap.get(match.team1Player1Id),
          team1Player2: playerMap.get(match.team1Player2Id),
          team2Player1: playerMap.get(match.team2Player1Id),
          team2Player2: playerMap.get(match.team2Player2Id),
        })),
      })),
    };

    return createSuccessResponse(enhancedRound);
  });
}
