// app/api/player/historial/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type HistoryData = {
  hasHistory: boolean;
  message?: string;
  tournament?: {
    id: string;
    title: string;
  };
  rounds: Array<{
    round: number;
    group: number;
    position: number;
    points: number;
    movement: 'up' | 'down' | 'same';
    movementText: string;
    date: string;
    matches: Array<{
      vs: string;
      result: string;
      points: number;
    }>;
  }>;
  totalStats: {
    totalRounds: number;
    totalPoints: number;
    averagePoints: number;
    bestRound: {
      round: number;
      points: number;
    } | null;
    currentStreak: number;
    bestStreak: number;
  };
};

// Helper para calcular movimiento según posición
function calculateMovement(position: number, isFirstRound: boolean = false): {
  movement: 'up' | 'down' | 'same';
  movementText: string;
} {
  if (isFirstRound) {
    return {
      movement: 'same',
      movementText: 'Primera ronda'
    };
  }

  switch (position) {
    case 1:
      return {
        movement: 'up',
        movementText: 'Subió 2 grupos (Campeón)'
      };
    case 2:
      return {
        movement: 'up', 
        movementText: 'Subió 1 grupo (Subcampeón)'
      };
    case 3:
      return {
        movement: 'down',
        movementText: 'Bajó 1 grupo'
      };
    case 4:
      return {
        movement: 'down',
        movementText: 'Bajó 2 grupos'
      };
    default:
      return {
        movement: 'same',
        movementText: 'Se mantuvo'
      };
  }
}

// Helper para resolver playerId desde sesión
async function resolvePlayerId(session: any): Promise<string | null> {
  let playerId: string | null = session?.user?.playerId ?? null;

  if (!playerId && session?.user) {
    const userId = session.user.id ?? null;
    const email = session.user.email ?? null;

    const byUser = userId
      ? await prisma.player.findUnique({
          where: { userId },
          select: { id: true },
        })
      : null;

    const byEmail = !byUser && email
      ? await prisma.player.findFirst({
          where: { user: { email } },
          select: { id: true },
        })
      : null;

    playerId = (byUser ?? byEmail)?.id ?? null;
  }

  return playerId;
}

// Helper para calcular resultado de un match
function decideWinnerAndGames(
  g1: number | null,
  g2: number | null,
  tiebreakScore: string | null
): { g1: number; g2: number; winner: 1 | 2 | null } {
  const toNum = (v: any) => (typeof v === "number" ? v : v == null ? 0 : Number(v));
  let a = toNum(g1);
  let b = toNum(g2);
  let winner: 1 | 2 | null = null;

  // Caso tie-break: si 4-4 y hay marcador TB, decidir por TB y computar 5-4
  if (a === 4 && b === 4 && tiebreakScore) {
    const m = /^(\d+)-(\d+)$/.exec(tiebreakScore.trim());
    if (m) {
      const tb1 = Number(m[1]);
      const tb2 = Number(m[2]);
      if (tb1 > tb2) {
        a = 5;
        winner = 1;
      } else if (tb2 > tb1) {
        b = 5;
        winner = 2;
      }
    }
  }

  // Caso normal
  if (winner === null) {
    if (a > b) winner = 1;
    else if (b > a) winner = 2;
  }

  return { g1: a, g2: b, winner };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({
        hasHistory: false,
        message: "Inicia sesión para ver tu historial",
        rounds: [],
        totalStats: {
          totalRounds: 0,
          totalPoints: 0,
          averagePoints: 0,
          bestRound: null,
          currentStreak: 0,
          bestStreak: 0
        }
      });
    }

    const playerId = await resolvePlayerId(session);

    if (!playerId) {
      return NextResponse.json({
        hasHistory: false,
        message: "No se encontró perfil de jugador",
        rounds: [],
        totalStats: {
          totalRounds: 0,
          totalPoints: 0,
          averagePoints: 0,
          bestRound: null,
          currentStreak: 0,
          bestStreak: 0
        }
      });
    }

    // Obtener torneo activo del jugador
    const tournamentPlayer = await prisma.tournamentPlayer.findFirst({
      where: { playerId },
      include: {
        tournament: {
          select: {
            id: true,
            title: true,
            isActive: true
          }
        }
      },
      orderBy: [
        { tournament: { isActive: 'desc' } },
        { tournament: { startDate: 'desc' } }
      ]
    });

    if (!tournamentPlayer) {
      return NextResponse.json({
        hasHistory: false,
        message: "No estás inscrito en ningún torneo",
        rounds: [],
        totalStats: {
          totalRounds: 0,
          totalPoints: 0,
          averagePoints: 0,
          bestRound: null,
          currentStreak: 0,
          bestStreak: 0
        }
      });
    }

    const tournament = tournamentPlayer.tournament;

    // Obtener historial de participación en rondas cerradas
    const roundsHistory = await prisma.groupPlayer.findMany({
      where: {
        playerId,
        group: {
          round: {
            tournamentId: tournament.id,
            isClosed: true
          }
        }
      },
      include: {
        group: {
          include: {
            round: {
              select: {
                id: true,
                number: true,
                endDate: true
              }
            },
            matches: {
              where: {
                isConfirmed: true,
                OR: [
                  { team1Player1Id: playerId },
                  { team1Player2Id: playerId },
                  { team2Player1Id: playerId },
                  { team2Player2Id: playerId }
                ]
              },
              select: {
                id: true,
                setNumber: true,
                team1Player1Id: true,
                team1Player2Id: true,
                team2Player1Id: true,
                team2Player2Id: true,
                team1Games: true,
                team2Games: true,
                tiebreakScore: true
              }
            },
            players: {
              include: {
                player: {
                  select: { id: true, name: true }
                }
              },
              orderBy: { points: 'desc' }
            }
          }
        }
      },
      orderBy: {
        group: {
          round: { number: 'asc' }
        }
      }
    });

    if (roundsHistory.length === 0) {
      return NextResponse.json({
        hasHistory: false,
        message: "Aún no has participado en rondas completadas",
        tournament: {
          id: tournament.id,
          title: tournament.title
        },
        rounds: [],
        totalStats: {
          totalRounds: 0,
          totalPoints: 0,
          averagePoints: 0,
          bestRound: null,
          currentStreak: 0,
          bestStreak: 0
        }
      });
    }

    // Procesar historial por rondas
    const processedRounds = roundsHistory.map((groupPlayer, index) => {
      const round = groupPlayer.group.round;
      const groupNumber = groupPlayer.group.number;
      
      // Calcular posición en el grupo
      const groupPlayers = groupPlayer.group.players.sort((a, b) => b.points - a.points);
      const position = groupPlayers.findIndex(p => p.playerId === playerId) + 1;

      // Calcular movimiento
      const { movement, movementText } = calculateMovement(position, index === 0);

      // Procesar matches del jugador en esta ronda
      const matches = groupPlayer.group.matches.map(match => {
        const isTeam1 = [match.team1Player1Id, match.team1Player2Id].includes(playerId);
        const { g1, g2, winner } = decideWinnerAndGames(
          match.team1Games,
          match.team2Games,
          match.tiebreakScore
        );

        const playerWon = (isTeam1 && winner === 1) || (!isTeam1 && winner === 2);
        const gamesWon = isTeam1 ? g1 : g2;
        const gamesLost = isTeam1 ? g2 : g1;
        const pointsInMatch = gamesWon + (playerWon ? 1 : 0);

        // Obtener compañero de equipo
        const teammateId = isTeam1 
          ? (match.team1Player1Id === playerId ? match.team1Player2Id : match.team1Player1Id)
          : (match.team2Player1Id === playerId ? match.team2Player2Id : match.team2Player1Id);
        
        const teammate = groupPlayers.find(p => p.player.id === teammateId);
        const vs = teammate ? teammate.player.name : "Compañero";

        return {
          vs,
          result: `${gamesWon}-${gamesLost}${match.tiebreakScore ? ` (TB: ${match.tiebreakScore})` : ''}`,
          points: pointsInMatch
        };
      });

      return {
        round: round.number,
        group: groupNumber,
        position,
        points: groupPlayer.points,
        movement,
        movementText,
        date: round.endDate.toISOString(),
        matches
      };
    });

    // Calcular estadísticas totales
    const totalRounds = processedRounds.length;
    const totalPoints = processedRounds.reduce((sum, r) => sum + r.points, 0);
    const averagePoints = totalRounds > 0 ? totalPoints / totalRounds : 0;
    
    const bestRound = processedRounds.reduce((best, current) => {
      if (!best || current.points > best.points) {
        return { round: current.round, points: current.points };
      }
      return best;
    }, null as { round: number; points: number } | null);

    // Calcular rachas (simplificado)
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    for (let i = processedRounds.length - 1; i >= 0; i--) {
      const isGoodResult = processedRounds[i].position <= 2; // 1º o 2º lugar
      
      if (isGoodResult) {
        tempStreak++;
        if (i === processedRounds.length - 1) currentStreak = tempStreak;
      } else {
        if (tempStreak > bestStreak) bestStreak = tempStreak;
        tempStreak = 0;
      }
    }
    
    if (tempStreak > bestStreak) bestStreak = tempStreak;

    const response: HistoryData = {
      hasHistory: true,
      tournament: {
        id: tournament.id,
        title: tournament.title
      },
      rounds: processedRounds,
      totalStats: {
        totalRounds,
        totalPoints,
        averagePoints,
        bestRound,
        currentStreak,
        bestStreak
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching player history:", error);
    return NextResponse.json(
      {
        hasHistory: false,
        message: "Error interno del servidor",
        rounds: [],
        totalStats: {
          totalRounds: 0,
          totalPoints: 0,
          averagePoints: 0,
          bestRound: null,
          currentStreak: 0,
          bestStreak: 0
        }
      },
      { status: 500 }
    );
  }
}