// app/api/groups/[id]/points-preview/route.ts - CORREGIDO CON VALIDACIÓN ROBUSTA
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
  provisionalPosition: number;
  movement: {
    type: "up" | "down" | "maintain";
    text: string;
    groups: number;
    color: string;
    bgColor: string;
  };
};

// Función segura para calcular estadísticas
function calculatePlayerStatsInGroup(playerId: string, matches: any[]): {
  setsWon: number;
  gamesWon: number;
  gamesLost: number;
  h2hWins: number;
} {
  if (!playerId || !Array.isArray(matches)) {
    console.warn("calculatePlayerStatsInGroup: parámetros inválidos", { playerId, matchesLength: matches?.length });
    return { setsWon: 0, gamesWon: 0, gamesLost: 0, h2hWins: 0 };
  }

  let setsWon = 0;
  let gamesWon = 0;
  let gamesLost = 0;
  let h2hWins = 0;

  for (const match of matches) {
    if (!match || !match.isConfirmed) continue;

    try {
      const team1PlayerIds = [match.team1Player1Id, match.team1Player2Id].filter(Boolean);
      const team2PlayerIds = [match.team2Player1Id, match.team2Player2Id].filter(Boolean);
      
      const isInTeam1 = team1PlayerIds.includes(playerId);
      const isInTeam2 = team2PlayerIds.includes(playerId);

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
    } catch (error) {
      console.error("Error procesando match:", error, match);
    }
  }

  return { setsWon, gamesWon, gamesLost, h2hWins };
}

function comparePlayersWithUnifiedTiebreakers(a: PlayerStats, b: PlayerStats): number {
  if (a.points !== b.points) return b.points - a.points;
  if (a.setsWon !== b.setsWon) return b.setsWon - a.setsWon;
  if (a.gamesDifference !== b.gamesDifference) return b.gamesDifference - a.gamesDifference;
  if (a.h2hWins !== b.h2hWins) return b.h2hWins - a.h2hWins;
  if (a.gamesWon !== b.gamesWon) return b.gamesWon - a.gamesWon;
  return 0;
}

function getMovementInfo(position: number, groupNumber: number, totalGroups: number = 10) {
  const isTopGroup = groupNumber === 1;
  const isBottomGroup = groupNumber === totalGroups;
  const isSecondGroup = groupNumber === 2;
  const isPenultimateGroup = groupNumber === totalGroups - 1;

  if (position === 1) {
    if (isTopGroup) {
      return { text: "Se mantiene en el grupo superior", color: "text-yellow-600", bgColor: "bg-yellow-50 border-yellow-200", groups: 0, type: "maintain" as const };
    } else if (isSecondGroup) {
      return { text: "Sube al grupo superior", color: "text-green-600", bgColor: "bg-green-50 border-green-200", groups: 1, type: "up" as const };
    } else {
      return { text: "Sube 2 grupos", color: "text-green-600", bgColor: "bg-green-50 border-green-200", groups: 2, type: "up" as const };
    }
  } else if (position === 2) {
    if (isTopGroup) {
      return { text: "Se mantiene en el grupo superior", color: "text-yellow-600", bgColor: "bg-yellow-50 border-yellow-200", groups: 0, type: "maintain" as const };
    } else {
      return { text: "Sube 1 grupo", color: "text-green-600", bgColor: "bg-green-50 border-green-200", groups: 1, type: "up" as const };
    }
  } else if (position === 3) {
    if (isBottomGroup) {
      return { text: "Se mantiene en el grupo inferior", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200", groups: 0, type: "maintain" as const };
    } else {
      return { text: "Baja 1 grupo", color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200", groups: 1, type: "down" as const };
    }
  } else if (position === 4) {
    if (isBottomGroup) {
      return { text: "Se mantiene en el grupo inferior", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200", groups: 0, type: "maintain" as const };
    } else if (isPenultimateGroup) {
      return { text: "Baja al grupo inferior", color: "text-red-600", bgColor: "bg-red-50 border-red-200", groups: 1, type: "down" as const };
    } else {
      return { text: "Baja 2 grupos", color: "text-red-600", bgColor: "bg-red-50 border-red-200", groups: 2, type: "down" as const };
    }
  } else {
    return { text: "Se mantiene", color: "text-gray-600", bgColor: "bg-gray-50 border-gray-200", groups: 0, type: "maintain" as const };
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const groupId = params.id;
    if (!groupId) {
      return NextResponse.json({ success: false, error: "ID de grupo requerido" }, { status: 400 });
    }

    console.log(`[points-preview API] Procesando grupo: ${groupId}`);

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
          include: { 
            player: { 
              select: { id: true, name: true } 
            } 
          },
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

    // Validación de datos del grupo
    if (!Array.isArray(group.players)) {
      console.error("group.players no es un array:", group.players);
      return NextResponse.json({ success: false, error: "Datos del grupo corrompidos" }, { status: 500 });
    }

    if (!Array.isArray(group.matches)) {
      console.error("group.matches no es un array:", group.matches);
      return NextResponse.json({ success: false, error: "Datos de matches corrompidos" }, { status: 500 });
    }

    const totalGroups = group.round.groups?.length || 10;
    const currentGroupLevel = group.level || group.number;

    console.log(`[points-preview API] Procesando ${group.players.length} jugadores y ${group.matches.length} matches`);

    // Crear mapa de movimientos ANTES del procesamiento principal
    const movements: Record<string, PlayerStats['movement']> = {};

    const playerStats: PlayerStats[] = [];

    // Procesar cada jugador de forma segura
    for (const gp of group.players) {
      if (!gp || !gp.player || !gp.playerId) {
        console.warn("Jugador inválido encontrado:", gp);
        continue;
      }

      try {
        const stats = calculatePlayerStatsInGroup(gp.playerId, group.matches);
        const gamesDifference = (stats.gamesWon ?? 0) - (stats.gamesLost ?? 0);

        const playerStat: PlayerStats = {
          playerId: gp.playerId,
          name: gp.player.name || "Jugador desconocido",
          points: gp.points ?? 0,
          setsWon: stats.setsWon ?? 0,
          gamesWon: stats.gamesWon ?? 0,
          gamesLost: stats.gamesLost ?? 0,
          gamesDifference,
          h2hWins: stats.h2hWins ?? 0,
          currentPosition: gp.position ?? 0,
          provisionalPosition: 0, // Se calculará después
          movement: { type: "maintain", text: "Se mantiene", groups: 0, color: "text-gray-600", bgColor: "bg-gray-50 border-gray-200" },
        };

        playerStats.push(playerStat);
      } catch (error) {
        console.error("Error procesando jugador:", error, gp);
        // Continuar con los demás jugadores
      }
    }

    if (playerStats.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No se pudieron procesar jugadores válidos"
      }, { status: 500 });
    }

    // Ordenar jugadores
    const sortedStats = [...playerStats].sort(comparePlayersWithUnifiedTiebreakers);

    // Asignar posiciones y movimientos de forma segura
    sortedStats.forEach((player, index) => {
      try {
        const provisionalPosition = index + 1;
        const movementInfo = getMovementInfo(provisionalPosition, currentGroupLevel, totalGroups);

        // Encontrar el jugador original SEGURO
        const originalPlayer = playerStats.find((p) => p.playerId === player.playerId);
        if (originalPlayer) {
          originalPlayer.provisionalPosition = provisionalPosition;
          originalPlayer.movement = movementInfo;
          
          // Agregar al mapa de movimientos de forma segura
          movements[player.playerId] = movementInfo;
        } else {
          console.warn("No se encontró jugador original para:", player.playerId);
        }
      } catch (error) {
        console.error("Error asignando posición/movimiento:", error, player);
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
        completedMatches: group.matches.filter((m) => m?.isConfirmed).length,
        completedSets: group.matches.filter((m) => m?.isConfirmed).length,
        totalSets: group.matches.length,
        pendingSets: group.matches.length - group.matches.filter((m) => m?.isConfirmed).length,
        completionRate: group.matches.length > 0 ? Math.round((group.matches.filter((m) => m?.isConfirmed).length / group.matches.length) * 100) : 0,
        isComplete: group.matches.length > 0 && group.matches.every((m) => m?.isConfirmed),
        players: playerStats.map((p) => ({
          playerId: p.playerId,
          playerName: p.name,
          name: p.name, // Compatibilidad
          currentPosition: p.currentPosition,
          provisionalPosition: p.provisionalPosition,
          currentPoints: p.points,
          provisionalPoints: p.points, // Por simplicidad, usar los mismos puntos
          deltaPoints: 0,
          points: p.points, // Compatibilidad
          setsWon: p.setsWon,
          setsPlayed: 3, // Asumir 3 sets por grupo
          gamesWon: p.gamesWon,
          gamesLost: p.gamesLost,
          gamesDifference: p.gamesDifference,
          h2hWins: p.h2hWins,
          headToHeadRecord: {
            wins: p.h2hWins,
            losses: Math.max(0, 3 - p.setsWon) // Estimado
          },
          movement: p.movement,
          positionChange: p.provisionalPosition - p.currentPosition,
          deltaPosition: p.currentPosition - p.provisionalPosition,
          streak: 0, // Se puede mejorar
          usedComodin: false, // Se puede mejorar
        })),
        movements,
        ladderInfo: {
          isTopGroup: currentGroupLevel === 1,
          isBottomGroup: currentGroupLevel === totalGroups,
          totalGroups,
        },
        lastUpdated: new Date().toISOString(),
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
    };

    console.log(`[points-preview API] Respuesta generada exitosamente para ${playerStats.length} jugadores`);
    return NextResponse.json(response);

  } catch (error: any) {
    console.error("[points-preview API] Error completo:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Error interno del servidor", 
        details: process.env.NODE_ENV === "development" ? error.message : undefined 
      },
      { status: 500 }
    );
  }
}