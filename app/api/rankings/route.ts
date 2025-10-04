// app/api/rankings/route.ts - UNIFICADO CON DESEMPATES
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// Query unificada para rankings con desempates
async function getUnifiedRankings(tournamentId: string) {
  const tournamentPlayers = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    include: {
      player: {
        include: {
          user: true,
          groupPlayers: {
            where: {
              group: {
                round: {
                  tournamentId,
                  isClosed: true
                }
              }
            },
            include: {
              group: {
                include: {
                  round: true,
                  matches: {
                    where: { isConfirmed: true }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  const playersStats = tournamentPlayers.map(tp => {
    const player = tp.player;
    let totalPoints = 0;
    let roundsPlayed = 0;
    let setsWon = 0;
    let gamesWon = 0;
    let gamesLost = 0;
    let comodinesUsed = 0;
    let maxStreak = 0;

    player.groupPlayers.forEach(gp => {
      if (!gp.usedComodin) {
        roundsPlayed++;
        totalPoints += gp.points;
      } else {
        comodinesUsed++;
      }

      if (gp.streak > maxStreak) {
        maxStreak = gp.streak;
      }

      gp.group.matches.forEach(match => {
        const isInMatch = [
          match.team1Player1Id,
          match.team1Player2Id,
          match.team2Player1Id,
          match.team2Player2Id
        ].includes(player.id);

        if (isInMatch) {
          const isTeam1 = [match.team1Player1Id, match.team1Player2Id].includes(player.id);
          
          if (isTeam1) {
            gamesWon += match.team1Games || 0;
            gamesLost += match.team2Games || 0;
            if ((match.team1Games || 0) > (match.team2Games || 0)) {
              setsWon++;
            }
          } else {
            gamesWon += match.team2Games || 0;
            gamesLost += match.team1Games || 0;
            if ((match.team2Games || 0) > (match.team1Games || 0)) {
              setsWon++;
            }
          }
        }
      });
    });

    const averagePoints = roundsPlayed > 0 ? totalPoints / roundsPlayed : 0;

    return {
      playerId: player.id,
      playerName: player.name,
      userName: player.user.name,
      totalPoints,
      roundsPlayed,
      averagePoints,
      setsWon,
      gamesDifference: gamesWon - gamesLost,
      gamesWon,
      h2hWins: setsWon,
      comodinesUsed,
      maxStreak,
      currentGroupPosition: null as string | null
    };
  });

  // Obtener posición actual
  const currentRound = await prisma.round.findFirst({
    where: { tournamentId, isClosed: false },
    include: {
      groups: {
        include: {
          players: true
        }
      }
    }
  });

  if (currentRound) {
    playersStats.forEach(stat => {
      currentRound.groups.forEach(group => {
        const gp = group.players.find(p => p.playerId === stat.playerId);
        if (gp) {
          stat.currentGroupPosition = `${group.number}-${gp.position}`;
        }
      });
    });
  }

  return playersStats;
}

// Función de ordenamiento unificada para diferentes tipos de ranking
function sortPlayersForRanking(players: any[], rankingType: 'official' | 'ironman') {
  return [...players].sort((a, b) => {
    if (rankingType === 'official') {
      // Ranking oficial: promedio como criterio principal
      if (a.averagePoints !== b.averagePoints) return b.averagePoints - a.averagePoints;
    } else {
      // Ranking ironman: puntos totales como criterio principal
      if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
    }
    
    // Criterios de desempate comunes
    if (a.setsWon !== b.setsWon) return b.setsWon - a.setsWon;
    if (a.gamesDifference !== b.gamesDifference) return b.gamesDifference - a.gamesDifference;
    if (a.h2hWins !== b.h2hWins) return b.h2hWins - a.h2hWins;
    if (a.gamesWon !== b.gamesWon) return b.gamesWon - a.gamesWon;
    
    return 0;
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');
    const type = searchParams.get('type') as 'official' | 'ironman' | 'both' || 'both';
    const roundNumber = searchParams.get('round');

    if (!tournamentId) {
      return NextResponse.json({ error: "tournamentId requerido" }, { status: 400 });
    }

    // Verificar acceso si hay sesión
    const session = await getServerSession(authOptions);
    let isAdmin = false;
    let isParticipant = false;

    if (session?.user?.id) {
      isAdmin = session.user.isAdmin || false;
      
      // Verificar si es participante
      const player = await prisma.player.findUnique({
        where: { userId: session.user.id },
        select: { id: true }
      });

      if (player) {
        const participation = await prisma.tournamentPlayer.findFirst({
          where: {
            tournamentId,
            playerId: player.id
          }
        });
        isParticipant = !!participation;
      }
    }

    // Obtener datos del torneo
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        title: true,
        isPublic: true,
        totalRounds: true,
        rounds: {
          select: { number: true, isClosed: true },
          orderBy: { number: 'desc' },
          take: 1
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    // Verificar acceso
    if (!tournament.isPublic && !isAdmin && !isParticipant) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener estadísticas unificadas
    // Obtener estadísticas unificadas
    const playersStats = await getUnifiedRankings(tournamentId);

    // Convertir BigInt a Number
    const normalizedStats = playersStats.map(player => ({
      playerId: player.playerId,
      playerName: player.playerName,
      userName: player.userName,
      totalPoints: Number(player.totalPoints),
      roundsPlayed: Number(player.roundsPlayed),
      averagePoints: Number(player.averagePoints),
      setsWon: Number(player.setsWon),
      gamesDifference: Number(player.gamesDifference),
      gamesWon: Number(player.gamesWon),
      h2hWins: Number(player.h2hWins),
      comodinesUsed: Number(player.comodinesUsed),
      maxStreak: Number(player.maxStreak),
      currentGroupPosition: player.currentGroupPosition
    }));

    // Crear rankings
    const rankings: any = {};

    if (type === 'official' || type === 'both') {
      const officialRanking = sortPlayersForRanking(normalizedStats, 'official');
      rankings.official = officialRanking.map((player, index) => ({
        position: index + 1,
        ...player,
        isEligible: player.roundsPlayed >= Math.ceil(tournament.totalRounds * 0.5), // 50% mínimo
        movement: index === 0 ? 'champion' : index < 3 ? 'podium' : 'stable'
      }));
    }

    if (type === 'ironman' || type === 'both') {
      const ironmanRanking = sortPlayersForRanking(normalizedStats, 'ironman');
      rankings.ironman = ironmanRanking.map((player, index) => ({
        position: index + 1,
        ...player,
        movement: 'ironman'
      }));
    }

    // Estadísticas generales
    const stats = {
      totalPlayers: normalizedStats.length,
      eligiblePlayers: normalizedStats.filter(p => 
        p.roundsPlayed >= Math.ceil(tournament.totalRounds * 0.5)
      ).length,
      completedRounds: tournament.rounds[0]?.isClosed ? tournament.rounds[0].number : 0,
      totalRounds: tournament.totalRounds,
      averageParticipation: normalizedStats.length > 0 
        ? Math.round(normalizedStats.reduce((sum, p) => sum + p.roundsPlayed, 0) / normalizedStats.length * 10) / 10
        : 0
    };

    return NextResponse.json({
      success: true,
      tournament: {
        id: tournament.id,
        title: tournament.title,
        isPublic: tournament.isPublic
      },
      rankings,
      stats,
      tiebreakCriteria: {
        official: [
          "Promedio de puntos por ronda",
          "Sets ganados",
          "Diferencia de juegos", 
          "Head-to-head wins",
          "Juegos ganados totales"
        ],
        ironman: [
          "Puntos totales acumulados",
          "Sets ganados",
          "Diferencia de juegos",
          "Head-to-head wins", 
          "Juegos ganados totales"
        ]
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        useUnifiedTiebreakers: true,
        isAdmin,
        isParticipant
      }
    });

  } catch (error: any) {
    console.error('[Rankings API] Error:', error);
    return NextResponse.json(
      { error: "Error interno del servidor", details: error.message },
      { status: 500 }
    );
  }
}