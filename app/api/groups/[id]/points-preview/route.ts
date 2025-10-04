// app/api/groups/[id]/points-preview/route.ts - ✅ CORREGIDO CON LÓGICA UNIFICADA
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  movement: 'up' | 'down' | 'same';
  movementDescription: string;
};

/**
 * Calcula estadísticas de un jugador en los matches del grupo
 */
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

/**
 * ✅ Función unificada de comparación con todos los criterios de desempate
 * DEBE COINCIDIR CON tournament-engine.ts
 */
function comparePlayersWithUnifiedTiebreakers(a: PlayerStats, b: PlayerStats): number {
  if (a.points !== b.points) return b.points - a.points;
  if (a.setsWon !== b.setsWon) return b.setsWon - a.setsWon;
  if (a.gamesDifference !== b.gamesDifference) return b.gamesDifference - a.gamesDifference;
  if (a.h2hWins !== b.h2hWins) return b.h2hWins - a.h2hWins;
  if (a.gamesWon !== b.gamesWon) return b.gamesWon - a.gamesWon;
  return 0;
}

/**
 * ✅ CORREGIDO: Calcula movimientos según la lógica correcta
 * 1º lugar: sube 2 grupos (excepto grupo élite que se mantiene)
 * 2º lugar: sube 1 grupo (excepto grupo élite que se mantiene)
 * 3º lugar: baja 1 grupo (excepto grupo inferior que se mantiene)
 * 4º lugar: baja 2 grupos (excepto grupo inferior que se mantiene)
 */
function calculateMovementInfo(position: number, groupLevel: number, totalGroups: number) {
  const isTopGroup = groupLevel === 1;
  const isBottomGroup = groupLevel === totalGroups;
  const isSecondGroup = groupLevel === 2;
  const isPenultimateGroup = groupLevel === totalGroups - 1;

  switch (position) {
    case 1: // ✅ Primer lugar - SUBE 2 GRUPOS
      if (isTopGroup) {
        return { type: 'same' as const, groups: 0, description: 'Se mantiene en grupo élite' };
      } else if (isSecondGroup) {
        return { type: 'up' as const, groups: 1, description: 'Sube al grupo élite' };
      } else {
        return { type: 'up' as const, groups: 2, description: 'Sube 2 grupos' };
      }

    case 2: // ✅ Segundo lugar - SUBE 1 GRUPO
      if (isTopGroup) {
        return { type: 'same' as const, groups: 0, description: 'Se mantiene en grupo élite' };
      } else {
        return { type: 'up' as const, groups: 1, description: 'Sube 1 grupo' };
      }

    case 3: // ✅ Tercer lugar - BAJA 1 GRUPO
      if (isBottomGroup) {
        return { type: 'same' as const, groups: 0, description: 'Se mantiene en grupo inferior' };
      } else {
        return { type: 'down' as const, groups: 1, description: 'Baja 1 grupo' };
      }

    case 4: // ✅ Cuarto lugar - BAJA 2 GRUPOS
      if (isBottomGroup) {
        return { type: 'same' as const, groups: 0, description: 'Se mantiene en grupo inferior' };
      } else if (isPenultimateGroup) {
        return { type: 'down' as const, groups: 1, description: 'Baja al grupo inferior' };
      } else {
        return { type: 'down' as const, groups: 2, description: 'Baja 2 grupos' };
      }

    default:
      return { type: 'same' as const, groups: 0, description: 'Se mantiene' };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const groupId = params.id;
    console.log(`📊 [Points Preview] Calculando para grupo ${groupId}`);

    // Obtener información completa del grupo
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        round: {
          include: {
            tournament: {
              select: { id: true, title: true }
            },
            groups: {
              select: { id: true, level: true, number: true },
              orderBy: { level: 'asc' }
            }
          }
        },
        players: {
          include: {
            player: {
              select: { id: true, name: true }
            }
          },
          orderBy: { position: 'asc' }
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
          }
        }
      }
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    // Información de la escalera
    const totalGroups = group.round.groups.length;
    const currentGroupLevel = group.level || group.number;
    const isTopGroup = currentGroupLevel === 1;
    const isBottomGroup = currentGroupLevel === totalGroups;

    console.log(`📊 Grupo ${group.number} (Nivel ${currentGroupLevel}/${totalGroups})`);

    // Calcular estadísticas para cada jugador
    const playerStats: PlayerStats[] = group.players.map(gp => {
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
        movement: 'same' as const,
        movementDescription: ''
      };
    });

    // Ordenar con criterios de desempate unificados
    const sortedStats = [...playerStats].sort(comparePlayersWithUnifiedTiebreakers);

    // Asignar posiciones predichas y movimientos
    const movements: Record<string, { type: string; groups: number; description: string }> = {};

    sortedStats.forEach((player, index) => {
      const predictedPosition = index + 1;
      const movementInfo = calculateMovementInfo(predictedPosition, currentGroupLevel, totalGroups);

      // Actualizar jugador original
      const originalPlayer = playerStats.find(p => p.playerId === player.playerId);
      if (originalPlayer) {
        originalPlayer.predictedPosition = predictedPosition;
        originalPlayer.movement = movementInfo.type;
        originalPlayer.movementDescription = movementInfo.description;

        movements[player.playerId] = {
          type: movementInfo.type,
          groups: movementInfo.groups,
          description: movementInfo.description
        };

        console.log(
          `  ${player.name}: ${originalPlayer.currentPosition}° → ${predictedPosition}° | ` +
          `${movementInfo.description} (${movementInfo.type})`
        );
      }
    });

    // Estadísticas de matches
    const completedMatches = group.matches.filter(m => m.isConfirmed).length;
    const totalMatches = group.matches.length;
    const completionRate = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;

    // Respuesta completa compatible con PointsPreviewCard
    const response = {
      success: true,
      data: {
        groupId: group.id,
        groupNumber: group.number,
        groupLevel: currentGroupLevel,
        tournamentId: group.round.tournament.id,
        tournamentTitle: group.round.tournament.title,
        roundNumber: group.round.number,
        totalSets: totalMatches,
        completedSets: completedMatches,
        pendingSets: totalMatches - completedMatches,
        completionRate,
        isComplete: completionRate === 100,
        ladderInfo: {
          isTopGroup,
          isBottomGroup,
          totalGroups
        },
        players: playerStats.map(player => ({
          playerId: player.playerId,
          playerName: player.name,
          currentPoints: player.points,
          provisionalPoints: player.points,
          deltaPoints: 0,
          setsWon: player.setsWon,
          setsPlayed: totalMatches,
          gamesWon: player.gamesWon,
          gamesLost: player.gamesLost,
          gamesDifference: player.gamesDifference,
          h2hWins: player.h2hWins,
          currentPosition: player.currentPosition,
          provisionalPosition: player.predictedPosition,
          deltaPosition: player.currentPosition - player.predictedPosition,
          streak: 0,
          usedComodin: false,
          movement: movements[player.playerId]
        })),
        movements,
        lastUpdated: new Date().toISOString(),
        metadata: {
          tiebreakCriteria: [
            "1. Puntos totales",
            "2. Sets ganados",
            "3. Diferencia de juegos",
            "4. Head-to-head wins",
            "5. Juegos ganados totales"
          ],
          movementRules: [
            "1° lugar: Sube 2 grupos (excepto grupo élite)",
            "2° lugar: Sube 1 grupo (excepto grupo élite)",
            "3° lugar: Baja 1 grupo (excepto grupo inferior)",
            "4° lugar: Baja 2 grupos (excepto grupo inferior)"
          ]
        }
      }
    };

    console.log(`✅ Preview calculado exitosamente (${completionRate}% completado)`);

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('❌ [Points Preview API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}