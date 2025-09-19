// app/api/groups/[id]/points-preview/route.ts - CORREGIDO CON DESEMPATES UNIFICADOS
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
  movement: "up" | "down" | "same";
  movementDescription: string;
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

// Calcular movimientos en la escalera
function calculateMovementInfo(position: number, groupLevel: number, totalGroups: number) {
  const isTopGroup = groupLevel === 1;
  const isBottomGroup = groupLevel === totalGroups;
  const isSecondGroup = groupLevel === 2;
  const isPenultimateGroup = groupLevel === totalGroups - 1;

  switch (position) {
    case 1:
      if (isTopGroup) return { type: "same", description: "Se mantiene en grupo élite" };
      if (isSecondGroup) return { type: "up", description: "Sube al grupo élite" };
      return { type: "up", description: "Sube 2 grupos" };

    case 2:
      if (isTopGroup) return { type: "same", description: "Se mantiene en grupo élite" };
      return { type: "up", description: "Sube 1 grupo" };

    case 3:
      if (isBottomGroup) return { type: "same", description: "Se mantiene en grupo inferior" };
      return { type: "down", description: "Baja 1 grupo" };

    case 4:
      if (isBottomGroup) return { type: "same", description: "Se mantiene en grupo inferior" };
      if (isPenultimateGroup) return { type: "down", description: "Baja al grupo inferior" };
      return { type: "down", description: "Baja 2 grupos" };

    default:
      return { type: "same", description: "Se mantiene" };
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
        movement: "same",
        movementDescription: "",
      };
    });

    const sortedStats = [...playerStats].sort(comparePlayersWithUnifiedTiebreakers);

    sortedStats.forEach((player, index) => {
      const predictedPosition = index + 1;
      const movementInfo = calculateMovementInfo(predictedPosition, currentGroupLevel, totalGroups);

      const originalPlayer = playerStats.find((p) => p.playerId === player.playerId);
      if (originalPlayer) {
        originalPlayer.predictedPosition = predictedPosition;
        originalPlayer.movement = movementInfo.type as "up" | "down" | "same";
        originalPlayer.movementDescription = movementInfo.description;
      }
    });

    const response = {
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
          movementDescription: p.movementDescription,
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
        movementInfo: {
          description: "Sistema de escalera actualizado",
          rules: [
            "1° lugar: Sube 2 grupos (excepto grupo élite)",
            "2° lugar: Sube 1 grupo (excepto grupo élite)",
            "3° lugar: Baja 1 grupo (excepto grupo inferior)",
            "4° lugar: Baja 2 grupos (excepto grupo inferior)",
          ],
        },
        calculatedAt: new Date().toISOString(),
        version: "1.0",
      },
    };

    return NextResponse.json(response);
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
