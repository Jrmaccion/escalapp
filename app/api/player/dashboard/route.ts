// app/api/player/dashboard/route.ts - Tu archivo actual con mejoras mínimas:

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.playerId) {
      return NextResponse.json({ error: "No autorizado o no es un jugador" }, { status: 401 });
    }

    const playerId = session.user.playerId;

    // Buscar el torneo activo donde participa el jugador
    const activeTournament = await prisma.tournament.findFirst({
      where: {
        isActive: true,
        players: {
          some: {
            playerId: playerId
          }
        }
      },
      include: {
        rounds: {
          orderBy: { number: 'desc' }
        }
      }
    });

    if (!activeTournament) {
      return NextResponse.json({
        activeTournament: null,
        currentGroup: null,
        myMatches: [],
        ranking: null,
        stats: {
          matchesPlayed: 0,
          matchesPending: 0,
          winRate: 0,
          currentStreak: 0
        }
      });
    }

    // Encontrar la ronda actual (última ronda no cerrada)
    const currentRound = activeTournament.rounds.find(r => !r.isClosed) || 
                        activeTournament.rounds[0];

    // Buscar el grupo actual del jugador en la ronda actual
    const currentGroup = await prisma.group.findFirst({
      where: {
        roundId: currentRound.id,
        players: {
          some: {
            playerId: playerId
          }
        }
      },
      include: {
        players: {
          include: {
            player: true
          },
          orderBy: { points: 'desc' } // CAMBIO: ordenar por puntos en lugar de posición
        }
      }
    });

    // Buscar la información del jugador en el grupo actual
    const playerInGroup = currentGroup?.players.find(p => p.playerId === playerId);

    // Buscar los matches del jugador en la ronda actual
    const myMatches = await prisma.match.findMany({
      where: {
        groupId: currentGroup?.id,
        OR: [
          { team1Player1Id: playerId },
          { team1Player2Id: playerId },
          { team2Player1Id: playerId },
          { team2Player2Id: playerId }
        ]
      },
      include: {
        group: true
      },
      orderBy: { setNumber: 'asc' } // AÑADIDO: ordenar matches
    });

    // Obtener nombres de jugadores para los matches
    const allPlayerIds = [
      ...myMatches.flatMap(m => [m.team1Player1Id, m.team1Player2Id, m.team2Player1Id, m.team2Player2Id])
    ];
    
    const players = await prisma.player.findMany({
      where: { id: { in: allPlayerIds } }
    });

    const playerMap = players.reduce((acc, player) => {
      acc[player.id] = player.name;
      return acc;
    }, {} as Record<string, string>);

    // Formatear matches con nombres de jugadores
    const formattedMatches = myMatches.map(match => ({
      id: match.id,
      setNumber: match.setNumber,
      team1Player1Name: playerMap[match.team1Player1Id] || 'Jugador desconocido',
      team1Player2Name: playerMap[match.team1Player2Id] || 'Jugador desconocido',
      team2Player1Name: playerMap[match.team2Player1Id] || 'Jugador desconocido',
      team2Player2Name: playerMap[match.team2Player2Id] || 'Jugador desconocido',
      team1Games: match.team1Games,
      team2Games: match.team2Games,
      tiebreakScore: match.tiebreakScore,
      isConfirmed: match.isConfirmed,
      reportedById: match.reportedById,
      groupNumber: match.group.number
    }));

    // Obtener ranking del jugador
    const latestRanking = await prisma.ranking.findFirst({
      where: {
        tournamentId: activeTournament.id,
        playerId: playerId
      },
      orderBy: { roundNumber: 'desc' }
    });

    // Calcular estadísticas
    const confirmedMatches = myMatches.filter(m => m.isConfirmed);
    const pendingMatches = myMatches.filter(m => !m.isConfirmed);
    
    let wins = 0;
    for (const match of confirmedMatches) {
      const isTeam1 = match.team1Player1Id === playerId || match.team1Player2Id === playerId;
      const team1Won = (match.team1Games || 0) > (match.team2Games || 0);
      if ((isTeam1 && team1Won) || (!isTeam1 && !team1Won)) {
        wins++;
      }
    }

    const winRate = confirmedMatches.length > 0 ? (wins / confirmedMatches.length) * 100 : 0;

    // Preparar respuesta
    const response = {
      activeTournament: {
        id: activeTournament.id,
        title: activeTournament.title,
        currentRound: currentRound.number,
        totalRounds: activeTournament.totalRounds,
        roundEndDate: currentRound.endDate.toISOString()
      },
      currentGroup: currentGroup ? {
        id: currentGroup.id,
        number: currentGroup.number,
        level: currentGroup.level,
        position: playerInGroup?.position || 0,
        points: playerInGroup?.points || 0,
        streak: playerInGroup?.streak || 0,
        players: currentGroup.players.map(p => ({
          id: p.playerId,
          name: p.player.name,
          position: p.position,
          points: p.points
        }))
      } : null,
      myMatches: formattedMatches,
      ranking: latestRanking ? {
        position: latestRanking.position,
        averagePoints: latestRanking.averagePoints,
        totalPoints: latestRanking.totalPoints,
        roundsPlayed: latestRanking.roundsPlayed,
        ironmanPosition: latestRanking.ironmanPosition
      } : null,
      stats: {
        matchesPlayed: confirmedMatches.length,
        matchesPending: pendingMatches.length,
        winRate: Math.round(winRate),
        currentStreak: playerInGroup?.streak || 0
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching player dashboard:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}