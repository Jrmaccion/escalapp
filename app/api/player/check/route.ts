// app/api/player/check/route.ts
/**
 * Player Profile Check API
 *
 * Checks if the authenticated user has an associated player profile.
 * Used by the navigation and routing logic to determine which screens to show.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      logger.debug("No session found for player check");
      return NextResponse.json({
        hasProfile: false,
        playerId: null,
        isAdmin: false
      });
    }

    logger.apiRequest("GET", "/api/player/check", { userId: session.user.id });

    // Check if user has player profile
    const player = await prisma.player.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true
      }
    });

    const hasProfile = !!player;
    const isAdmin = !!session.user?.isAdmin;

    logger.debug("Player profile check", {
      userId: session.user.id,
      hasProfile,
      isAdmin,
      playerId: player?.id
    });

    return NextResponse.json({
      hasProfile,
      playerId: player?.id || null,
      playerName: player?.name || null,
      isAdmin,
      userRole: hasProfile && isAdmin ? "admin-player" :
                hasProfile ? "player" :
                isAdmin ? "admin-only" : "unknown"
    });

  } catch (error: any) {
    logger.error("Error checking player profile", {
      error: error.message,
      stack: error.stack
    });

    return NextResponse.json(
      {
        hasProfile: false,
        playerId: null,
        error: "Failed to check player profile"
      },
      { status: 500 }
    );
  }
}
