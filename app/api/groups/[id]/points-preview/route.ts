// app/api/groups/[id]/points-preview/route.ts - CORREGIDO CON MOVEMENT INFO COMPLETO Y TIPADO
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PlayerStats = {
  playerId: string;
  name: string;
  points: number;
  setsWon: number;
  gamesWon: number;
  gamesLost: number;
  gamesDifference: number;
  h2hWins: number;
  currentPosition: number;
  predictedPosition: number;
  movement: {
    type: "up" | "down" | "maintain";
    text: string;
    groups: number;
    color: string;
    bgColor: string;
  };
};

// Calcular estadísticas individuales
function calculatePlayerStatsInGroup(playerId: string, matches: any[]): {
  setsWon: number;
  gamesWon: number;
  gamesLost: number;
  h2hWins: number;
} {
  let setsWon = 0;
  let gamesWon = 0;
  let gamesLost = 0;
  let h2hWins = 0;

  for (const match of matches) {
    if (!match.isConfirmed) continue;

    const isInTeam1 = [match.team1Player1Id, match.team1Player2Id].includes(playerId);
    const isInTeam2 = [match.team2Player1Id, match.team2Player2Id].includes(playerId);

    if (isInTeam1) {
      gamesWon += match.team1Games || 0;
      gamesLost += match.team2Games || 0;
      if ((match.team1Games || 0) > (match.team2Games || 0)) {
        setsWon++;
        h2hWins++;
      }
    } else if (isInTeam2) {
      gamesWon += match.team2Games || 0;
      gamesLost += match.team1Games || 0;
      if ((match.team2Games || 0) > (match.team1Games || 0)) {
        setsWon++;
        h2hWins++;
      }
    }
  }

  return { setsWon, gamesWon, gamesLost, h2hWins };
}

// Comparador unificado de desempates
function comparePlayersWithUnifiedTiebreakers(a: PlayerStats, b: PlayerStats): number {
  if (a.points !== b.points) return b.points - a.points;
  if (a.setsWon !== b.setsWon) return b.setsWon - a.setsWon;
  if (a.gamesDifference !== b.gamesDifference) return b.gamesDifference - a.gamesDifference;
  if (a.h2hWins !== b.h2hWins) return b.h2hWins - a.h2hWins;
  if (a.gamesWon !== b.gamesWon) return b.gamesWon - a.gamesWon;
  return 0;
}

// Movimiento estilo frontend con tipos estrictos
function getMovementInfo(position: number, groupNumber: number, totalGroups: number = 10) {
  const isTopGroup = groupNumber === 1;
  const isBottomGroup = groupNumber === totalGroups;
  const isSecondGroup = groupNumber === 2;
  const isPenultimateGroup = groupNumber === totalGroups - 1;

  if (position === 1) {
    if (isTopGroup) {
      return {
        text: "Se mantiene en el grupo superior",
        color: "text-yellow-600",
        bgColor: "bg-yellow-50 border-yellow-200",
        groups: 0,
        type: "maintain" as const,
      };
    } else if (isSecondGroup) {
      return {
        text: "Sube al grupo superior",
        color: "text-green-600",
        bgColor: "bg-green-50 border-green-200",
        groups: 1,
        type: "up" as const,
      };
    } else {
      return {
        text: "Sube 2 grupos",
        color: "text-green-600",
        bgColor: "bg-green-50 border-green-200",
        groups: 2,
        type: "up" as const,
      };
    }
  } else if (position === 2) {
    if (isTopGroup) {
      return {
        text: "Se mantiene en el grupo superior",
        color: "text-yellow-600",
        bgColor: "bg-yellow-50 border-yellow-200",
        groups: 0,
        type: "maintain" as const,
      };
    } else {
      return {
        text: "Sube 1 grupo",
        color: "text-green-600",
        bgColor: "bg-green-50 border-green-200",
        groups: 1,
        type: "up" as const,
      };
    }
  } else if (position === 3) {
    if (isBottomGroup) {
      return {
        text: "Se mantiene en el grupo inferior",
        color: "text-blue-600",
        bgColor: "bg-blue-50 border-blue-200",
        groups: 0,
        type: "maintain" as const,
      };
    } else {
      return {
        text: "Baja 1 grupo",
        color: "text-orange-600",
        bgColor: "bg-orange-50 border-orange-200",
        groups: 1,
        type: "down" as const,
      };
    }
  } else if (position === 4) {
    if (isBottomGroup) {
      return {
        text: "Se mantiene en el grupo inferior",
        color: "text-blue-600",
        bgColor: "bg-blue-50 border-blue-200",
        groups: 0,
        type: "maintain" as const,
      };
    } else if (isPenultimateGroup) {
      return {
        text: "Baja al grupo inferior",
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200",
        groups: 1,
        type: "down" as const,
      };
    } else {
      return {
        text: "Baja 2 grupos",
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200",
        groups: 2,
        type: "down" as const,
      };
    }
  } else {
    return {
      text: "Se mantiene",
      color: "text-gray-600",
      bgColor: "bg-gray-50 border-gray-200",
      groups: 0,
      type: "maintain" as const,
    };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const groupId = params.id;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        round: {
          include: {
            tournament: { select: { id: true, title: true } },
            groups: { select: { id: true, level: true, number: true } },
          },
        },
        players: {
          include: { player: { select: { id: true, name: true } } },
          orderBy: { position: "asc" },
        },
        matches: {
          select: {
            id: true,
            isConfirmed: true,
            team1Games: true,
            team2Games: true,
            team1Player1Id: true,
            team1Player2Id: true,
            team2Player1Id: true,
            team2Player2Id: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ success: false, error: "Grupo no encontrado" }, { status: 404 });
    }

    const totalGroups = group.round.groups.length;
    const currentGroupLevel = group.level || group.number;

    const playerStats: PlayerStats[] = group.players.map((gp) => {
      const stats = calculatePlayerStatsInGroup(gp.playerId, group.matches);
      const gamesDifference = stats.gamesWon - stats.gamesLost;

      return {
        playerId: gp.playerId,
        name: gp.player.name,
        points: gp.points || 0,
        setsWon: stats.setsWon,
        gamesWon: stats.gamesWon,
        gamesLost: stats.gamesLost,
        gamesDifference,
        h2hWins: stats.h2hWins,
        currentPosition: gp.position,
        predictedPosition: 0,
        movement: {
          type: "maintain",
          text: "Se mantiene",
          groups: 0,
          color: "text-gray-600",
          bgColor: "bg-gray-50 border-gray-200",
        },
      };
    });

    const sortedStats = [...playerStats].sort(comparePlayersWithUnifiedTiebreakers);

    sortedStats.forEach((player, index) => {
      const predictedPosition = index + 1;
      const movementInfo = getMovementInfo(predictedPosition, currentGroupLevel, totalGroups);

      const originalPlayer = playerStats.find((p) => p.playerId === player.playerId);
      if (originalPlayer) {
        originalPlayer.predictedPosition = predictedPosition;
        originalPlayer.movement = movementInfo;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        groupId: group.id,
        groupNumber: group.number,
        groupLevel: currentGroupLevel,
        tournamentId: group.round.tournament.id,
        tournamentTitle: group.round.tournament.title,
        roundNumber: group.round.number,
        totalMatches: group.matches.length,
        completedMatches: group.matches.filter((m) => m.isConfirmed).length,
        players: playerStats.map((p) => ({
          playerId: p.playerId,
          name: p.name,
          currentPosition: p.currentPosition,
          predictedPosition: p.predictedPosition,
          points: p.points,
          setsWon: p.setsWon,
          gamesWon: p.gamesWon,
          gamesLost: p.gamesLost,
          gamesDifference: p.gamesDifference,
          h2hWins: p.h2hWins,
          movement: p.movement,
          positionChange: p.predictedPosition - p.currentPosition,
        })),
      },
      metadata: {
        tiebreakInfo: {
          criteria: [
            "1. Puntos totales",
            "2. Sets ganados",
            "3. Diferencia de juegos",
            "4. Head-to-head wins",
            "5. Juegos ganados totales",
          ],
          note: "Se aplican en orden hasta desempatar",
        },
        calculatedAt: new Date().toISOString(),
        version: "1.0",
      },
    });
  } catch (error: any) {
    console.error("[points-preview API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
