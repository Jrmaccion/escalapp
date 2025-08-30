// app/api/player/history/route.ts - CREAR NUEVO:
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.playerId) {
      return NextResponse.json({ 
        hasHistory: false, 
        message: "No autorizado" 
      }, { status: 401 });
    }

    const playerId = session.user.playerId;

    // Obtener torneo activo
    const activeTournament = await prisma.tournament.findFirst({
      where: { 
        isActive: true,
        players: { some: { playerId } }
      }
    });

    if (!activeTournament) {
      return NextResponse.json({
        hasHistory: false,
        message: "No estás en ningún torneo activo"
      });
    }

    // Obtener todas las participaciones del jugador en rondas cerradas
    const roundHistory = await prisma.groupPlayer.findMany({
      where: {
        playerId,
        group: {
          round: {
            tournamentId: activeTournament.id,
            isClosed: true
          }
        }
      },
      include: {
        group: {
          include: {
            round: {
              select: {
                number: true,
                startDate: true,
                endDate: true
              }
            }
          }
        }
      },
      orderBy: {
        group: {
          round: {
            number: 'asc'
          }
        }
      }
    });

    // Obtener partidos del jugador por ronda
    const matchesByRound = new Map();
    for (const roundData of roundHistory) {
      const matches = await prisma.match.findMany({
        where: {
          groupId: roundData.groupId,
          isConfirmed: true,
          OR: [
            { team1Player1Id: playerId },
            { team1Player2Id: playerId },
            { team2Player1Id: playerId },
            { team2Player2Id: playerId }
          ]
        }
      });

      // Obtener nombres de oponentes
      const matchesWithNames = await Promise.all(
        matches.map(async (match) => {
          const playerIds = [match.team1Player1Id, match.team1Player2Id, match.team2Player1Id, match.team2Player2Id]
            .filter(id => id !== playerId);
          
          const opponents = await prisma.player.findMany({
            where: { id: { in: playerIds } },
            select: { name: true }
          });

          const isTeam1 = match.team1Player1Id === playerId || match.team1Player2Id === playerId;
          const result = `${match.team1Games}-${match.team2Games}${match.tiebreakScore ? ` (TB ${match.tiebreakScore})` : ''}`;
          
          // Calcular puntos obtenidos (simplificado)
          let points = 0;
          if (match.team1Games !== null && match.team2Games !== null) {
            if (isTeam1) {
              points = (match.team1Games || 0) + (match.team1Games > match.team2Games ? 1 : 0);
            } else {
              points = (match.team2Games || 0) + (match.team2Games > match.team1Games ? 1 : 0);
            }
          }

          return {
            vs: opponents.map(p => p.name).join(' + ') || 'Oponentes',
            result,
            points
          };
        })
      );

      matchesByRound.set(roundData.group.round.number, matchesWithNames);
    }

    // Formatear historial
    const formattedHistory = roundHistory.map((roundData) => ({
      round: roundData.group.round.number,
      group: roundData.group.number,
      position: roundData.position,
      points: roundData.points,
      movement: 'same' as const, // Simplificado - podrías calcular movimientos reales
      date: roundData.group.round.endDate.toISOString().split('T')[0],
      matches: matchesByRound.get(roundData.group.round.number) || []
    }));

    // Calcular estadísticas totales
    const totalPoints = roundHistory.reduce((sum, r) => sum + r.points, 0);
    const totalRounds = roundHistory.length;
    const averagePoints = totalRounds > 0 ? totalPoints / totalRounds : 0;
    const bestRound = roundHistory.reduce((best, current) => 
      current.points > (best?.points || 0) ? current : best, roundHistory[0]
    );

    return NextResponse.json({
      hasHistory: true,
      tournament: {
        id: activeTournament.id,
        title: activeTournament.title
      },
      rounds: formattedHistory,
      totalStats: {
        totalRounds,
        totalPoints,
        averagePoints: Math.round(averagePoints * 100) / 100,
        bestRound: bestRound ? {
          round: bestRound.group.round.number,
          points: bestRound.points
        } : null,
        currentStreak: roundHistory[roundHistory.length - 1]?.streak || 0,
        bestStreak: Math.max(...roundHistory.map(r => r.streak), 0)
      }
    });

  } catch (error) {
    console.error("Error in player history API:", error);
    return NextResponse.json({ 
      hasHistory: false, 
      message: "Error interno del servidor" 
    }, { status: 500 });
  }
}