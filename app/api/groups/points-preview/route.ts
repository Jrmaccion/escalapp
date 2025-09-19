// app/api/groups/[id]/points-preview/route.ts - CORREGIDO CON DESEMPATES UNIFICADOS
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

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

// Función para calcular estadísticas de un jugador en los matches del grupo
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

  return {
    setsWon,
    gamesWon,
    gamesLost,
    h2hWins
  };
}

// Función unificada de comparación con todos los criterios de desempate
function comparePlayersWithUnifiedTiebreakers(a: PlayerStats, b: PlayerStats): number {
  // 1. Puntos totales (descendente)
  if (a.points !== b.points) return b.points - a.points;
  
  // 2. Sets ganados (descendente)  
  if (a.setsWon !== b.setsWon) return b.setsWon - a.setsWon;
  
  // 3. Diferencia de juegos (descendente)
  if (a.gamesDifference !== b.gamesDifference) return b.gamesDifference - a.gamesDifference;
  
  // 4. Head-to-head wins (descendente)
  if (a.h2hWins !== b.h2hWins) return b.h2hWins - a.h2hWins;
  
  // 5. Juegos ganados totales (descendente)
  if (a.gamesWon !== b.gamesWon) return b.gamesWon - a.gamesWon;
  
  return 0; // Empate total
}

// Función para determinar movimiento de escalera
function calculateMovementInfo(position: number, groupLevel: number, totalGroups: number) {
  const isTopGroup = groupLevel === 1;
  const isBottomGroup = groupLevel === totalGroups;
  const isSecondGroup = groupLevel === 2;
  const isPenultimateGroup = groupLevel === totalGroups - 1;

  switch (position) {
    case 1: // Primer lugar
      if (isTopGroup) {
        return { type: 'same', description: 'Se mantiene en grupo élite' };
      } else if (isSecondGroup) {
        return { type: 'up', description: 'Sube al grupo élite' };
      } else {
        return { type: 'up', description: 'Sube 2 grupos' };
      }
    
    case 2: // Segundo lugar
      if (isTopGroup) {
        return { type: 'same', description: 'Se mantiene en grupo élite' };
      } else {
        return { type: 'up', description: 'Sube 1 grupo' };
      }
    
    case 3: // Tercer lugar
      if (isBottomGroup) {
        return { type: 'same', description: 'Se mantiene en grupo inferior' };
      } else {
        return { type: 'down', description: 'Baja 1 grupo' };
      }
    
    case 4: // Cuarto lugar
      if (isBottomGroup) {
        return { type: 'same', description: 'Se mantiene en grupo inferior' };
      } else if (isPenultimateGroup) {
        return { type: 'down', description: 'Baja al grupo inferior' };
      } else {
        return { type: 'down', description: 'Baja 2 grupos' };
      }
    
    default:
      return { type: 'same', description: 'Se mantiene' };
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
              select: { id: true, level: true, number: true }
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

    // Calcular estadísticas para cada jugador
    const totalGroups = group.round.groups.length;
    const currentGroupLevel = group.level || group.number;

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
        predictedPosition: 0, // Se calculará después del ordenamiento
        movement: 'same' as const,
        movementDescription: ''
      };
    });

    // Ordenar con criterios de desempate unificados
    const sortedStats = [...playerStats].sort(comparePlayersWithUnifiedTiebreakers);

    // Asignar posiciones predichas y movimientos
    sortedStats.forEach((player, index) => {
      const predictedPosition = index + 1;
      const movementInfo = calculateMovementInfo(predictedPosition, currentGroupLevel, totalGroups);
      
      // Encontrar el jugador original para actualizar sus datos
      const originalPlayer = playerStats.find(p => p.playerId === player.playerId);
      if (originalPlayer) {
        originalPlayer.predictedPosition = predictedPosition;
        originalPlayer.movement = movementInfo.type as 'up' | 'down' | 'same';
        originalPlayer.movementDescription = movementInfo.description;
      }
    });

    // Preparar respuesta
    const response = {
      groupId: group.id,
      groupNumber: group.number,
      groupLevel: currentGroupLevel,
      tournamentId: group.round.tournament.id,
      tournamentTitle: group.round.tournament.title,
      roundNumber: group.round.number,
      totalMatches: group.matches.length,
      completedMatches: group.matches.filter(m => m.isConfirmed).length,
      players: playerStats.map(player => ({
        playerId: player.playerId,
        name: player.name,
        currentPosition: player.currentPosition,
        predictedPosition: player.predictedPosition,
        points: player.points,
        setsWon: player.setsWon,
        gamesWon: player.gamesWon,
        gamesLost: player.gamesLost,
        gamesDifference: player.gamesDifference,
        h2hWins: player.h2hWins,
        movement: player.movement,
        movementDescription: player.movementDescription,
        positionChange: player.predictedPosition - player.currentPosition,
      })),
      tiebreakInfo: {
        criteria: [
          "1. Puntos totales",
          "2. Sets ganados", 
          "3. Diferencia de juegos",
          "4. Head-to-head wins",
          "5. Juegos ganados totales"
        ],
        note: "En caso de empate se aplican los criterios en orden"
      },
      movementInfo: {
        description: "Sistema de escalera actualizado",
        rules: [
          "1° lugar: Sube 2 grupos (excepto grupo élite)",
          "2° lugar: Sube 1 grupo (excepto grupo élite)", 
          "3° lugar: Baja 1 grupo (excepto grupo inferior)",
          "4° lugar: Baja 2 grupos (excepto grupo inferior)"
        ]
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Points Preview API] Error:', error);
    return NextResponse.json(
      { 
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}