// app/api/public/rankings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Helper function para decidir ganador y juegos
const toNum = (v: any) => (typeof v === "number" ? v : v == null ? 0 : Number(v));

function decideWinnerAndGames(
  g1: number | null,
  g2: number | null,
  tiebreakScore: string | null
): { g1: number; g2: number; winner: 1 | 2 | null } {
  let a = toNum(g1);
  let b = toNum(g2);
  let winner: 1 | 2 | null = null;

  // Caso especial TB: si 4-4 y hay marcador de TB, decidir por TB y computar 5-4
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

/**
 * GET /api/public/rankings
 * Devuelve clasificaciones de torneos públicos para la página de inicio
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Obtener torneos públicos activos
    const publicTournaments = await prisma.tournament.findMany({
      where: {
        isPublic: true,
        isActive: true,
      },
      include: {
        rounds: {
          orderBy: { number: "desc" },
          select: { id: true, number: true, isClosed: true }
        },
        players: {
          include: {
            player: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { startDate: "desc" }
    });

    // 2. Calcular estadísticas generales
    const totalActiveTournaments = publicTournaments.length;
    const totalPlayers = await prisma.tournamentPlayer.count({
      where: {
        tournament: {
          isPublic: true,
          isActive: true
        }
      }
    });

    // 3. Seleccionar torneo destacado (el más reciente con datos)
    let featuredTournament = null;
    
    for (const tournament of publicTournaments) {
      const hasMatches = await prisma.match.count({
        where: {
          isConfirmed: true,
          group: {
            round: {
              tournamentId: tournament.id
            }
          }
        }
      });

      if (hasMatches > 0) {
        // Este torneo tiene datos, procesarlo
        const latestClosedRound = tournament.rounds.find(r => r.isClosed);
        const referenceRound = latestClosedRound || tournament.rounds[0];
        
        if (referenceRound) {
          // Obtener partidos confirmados hasta la ronda de referencia
          const matches = await prisma.match.findMany({
            where: {
              isConfirmed: true,
              group: {
                round: {
                  tournamentId: tournament.id,
                  number: { lte: referenceRound.number }
                }
              }
            },
            select: {
              team1Player1Id: true,
              team1Player2Id: true,
              team2Player1Id: true,
              team2Player2Id: true,
              team1Games: true,
              team2Games: true,
              tiebreakScore: true,
              group: { select: { round: { select: { number: true } } } }
            }
          });

          // Calcular puntos por jugador
          const totalByPlayer = new Map<string, number>();
          const roundsByPlayer = new Map<string, Set<number>>();

          const addPoints = (playerId: string, pts: number, roundNumber: number) => {
            totalByPlayer.set(playerId, (totalByPlayer.get(playerId) ?? 0) + pts);
            const s = roundsByPlayer.get(playerId) ?? new Set<number>();
            s.add(roundNumber);
            roundsByPlayer.set(playerId, s);
          };

          for (const m of matches) {
            const rn = m.group.round.number;
            const { g1, g2, winner } = decideWinnerAndGames(m.team1Games, m.team2Games, m.tiebreakScore);

            const team1Pts = g1 + (winner === 1 ? 1 : 0);
            const team2Pts = g2 + (winner === 2 ? 1 : 0);

            if (m.team1Player1Id) addPoints(m.team1Player1Id, team1Pts, rn);
            if (m.team1Player2Id) addPoints(m.team1Player2Id, team1Pts, rn);
            if (m.team2Player1Id) addPoints(m.team2Player1Id, team2Pts, rn);
            if (m.team2Player2Id) addPoints(m.team2Player2Id, team2Pts, rn);
          }

          // Crear rankings
          const players = tournament.players.map(tp => {
            const pid = tp.player.id;
            const total = totalByPlayer.get(pid) ?? 0;
            const rounds = roundsByPlayer.get(pid)?.size ?? 0;
            const avg = rounds > 0 ? total / rounds : 0;
            return {
              id: pid,
              name: tp.player.name,
              totalPoints: total,
              roundsPlayed: rounds,
              averagePoints: avg,
            };
          });

          // Filtrar solo jugadores con datos
          const playersWithData = players.filter(p => p.roundsPlayed > 0 || p.totalPoints > 0);

          if (playersWithData.length > 0) {
            // Rankings oficial e ironman
            const official = [...playersWithData]
              .sort((a, b) =>
                b.averagePoints !== a.averagePoints 
                  ? b.averagePoints - a.averagePoints 
                  : b.totalPoints - a.totalPoints
              )
              .map((p, i) => ({ ...p, position: i + 1 }));

            const ironman = [...playersWithData]
              .sort((a, b) =>
                b.totalPoints !== a.totalPoints 
                  ? b.totalPoints - a.totalPoints 
                  : b.averagePoints - a.averagePoints
              )
              .map((p, i) => ({ ...p, position: i + 1 }));

            featuredTournament = {
              id: tournament.id,
              title: tournament.title,
              totalPlayers: tournament.players.length,
              official,
              ironman
            };
            break; // Usar el primer torneo con datos
          }
        }
      }
    }

    // 4. Preparar respuesta
    const tournamentsList = publicTournaments.map(t => ({
      id: t.id,
      title: t.title,
      isActive: t.isActive,
      startDate: t.startDate.toISOString(),
      endDate: t.endDate.toISOString(),
      totalPlayers: t.players.length
    }));

    const response = {
      tournaments: tournamentsList,
      featuredTournament,
      totalActiveTournaments,
      totalPlayers
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error in public rankings API:", error);
    
    // Fallback con datos vacíos en caso de error
    return NextResponse.json({
      tournaments: [],
      featuredTournament: null,
      totalActiveTournaments: 0,
      totalPlayers: 0
    });
  }
}