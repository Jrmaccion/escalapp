import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar que la ronda existe y obtener información
    const round = await prisma.round.findUnique({
      where: { id: params.id },
      include: {
        tournament: true,
        groups: {
          include: {
            players: {
              include: {
                player: true
              }
            },
            matches: true
          }
        }
      }
    });

    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    if (round.isClosed) {
      return NextResponse.json({ error: "La ronda ya está cerrada" }, { status: 400 });
    }

    // Verificar que todos los partidos estén confirmados
    const totalMatches = round.groups.reduce((acc, group) => acc + group.matches.length, 0);
    const confirmedMatches = round.groups.reduce((acc, group) => 
      acc + group.matches.filter(m => m.isConfirmed).length, 0
    );

    if (totalMatches > 0 && confirmedMatches < totalMatches) {
      return NextResponse.json({ 
        error: `Faltan ${totalMatches - confirmedMatches} partidos por confirmar` 
      }, { status: 400 });
    }

    // Calcular puntos y actualizar posiciones de jugadores
    await calculateRoundResults(round);

    // Marcar la ronda como cerrada
    const updatedRound = await prisma.round.update({
      where: { id: params.id },
      data: { isClosed: true }
    });

    return NextResponse.json({ 
      message: "Ronda cerrada exitosamente",
      round: updatedRound 
    });
  } catch (error) {
    console.error("Error closing round:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// Función auxiliar para calcular resultados de la ronda
async function calculateRoundResults(round: any) {
  try {
    for (const group of round.groups) {
      // Calcular puntos por grupo
      const playersWithStats: {
        id: string;
        playerId: string;
        points: number;
        gamesWon: number;
        gamesLost: number;
        setsWon: number;
      }[] = [];

      for (const groupPlayer of group.players) {
        let points = 0;
        let gamesWon = 0;
        let gamesLost = 0;
        let setsWon = 0;

        // Contar resultados en todos los partidos del grupo
        for (const match of group.matches) {
          if (!match.isConfirmed || match.team1Games === null || match.team2Games === null) continue;

          let playerPoints = 0;
          let playerWon = false;

          // Verificar si el jugador participó en este partido
          const isInTeam1 = match.team1Player1Id === groupPlayer.playerId || 
                           match.team1Player2Id === groupPlayer.playerId;
          const isInTeam2 = match.team2Player1Id === groupPlayer.playerId || 
                           match.team2Player2Id === groupPlayer.playerId;

          if (isInTeam1) {
            gamesWon += match.team1Games;
            gamesLost += match.team2Games;
            if (match.team1Games > match.team2Games) {
              playerWon = true;
              setsWon++;
            }
          } else if (isInTeam2) {
            gamesWon += match.team2Games;
            gamesLost += match.team1Games;
            if (match.team2Games > match.team1Games) {
              playerWon = true;
              setsWon++;
            }
          }

          // Sistema de puntos (ajusta según tus reglas)
          if (playerWon) {
            playerPoints += 3; // 3 puntos por set ganado
          } else {
            playerPoints += 1; // 1 punto por set perdido
          }

          points += playerPoints;
        }

        playersWithStats.push({
          id: groupPlayer.id,
          playerId: groupPlayer.playerId,
          points: points,
          gamesWon,
          gamesLost,
          setsWon
        });
      }

      // Ordenar jugadores por puntos (descendente) y luego por diferencia de juegos
      playersWithStats.sort((a, b) => {
        if (a.points !== b.points) {
          return b.points - a.points; // Mayor puntos primero
        }
        // En caso de empate, usar diferencia de juegos
        const diffA = a.gamesWon - a.gamesLost;
        const diffB = b.gamesWon - b.gamesLost;
        return diffB - diffA;
      });

      // Usar transacción para actualizar todas las posiciones de manera atómica
      await prisma.$transaction(async (prisma) => {
        // Primero, temporalmente asignar posiciones negativas para evitar conflictos
        for (let i = 0; i < playersWithStats.length; i++) {
          await prisma.groupPlayer.update({
            where: { id: playersWithStats[i].id },
            data: {
              points: playersWithStats[i].points,
              position: -(i + 1), // Posición temporal negativa
            }
          });
        }

        // Luego, asignar las posiciones finales positivas
        for (let i = 0; i < playersWithStats.length; i++) {
          await prisma.groupPlayer.update({
            where: { id: playersWithStats[i].id },
            data: {
              position: i + 1, // Posición final
            }
          });
        }
      });
    }
  } catch (error) {
    console.error("Error calculating round results:", error);
    throw error;
  }
}