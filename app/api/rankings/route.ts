// app/api/rankings/route.ts - VERSIÓN CON SELECTOR DE TORNEOS
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Helpers
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

async function getUserTournaments(session: any) {
  console.log("=== getUserTournaments DEBUG ===");
  console.log("Session user:", session?.user);
  
  // Resolver playerId
  let playerId: string | null = session?.user?.playerId ?? null;
  console.log("Initial playerId from session:", playerId);

  if (!playerId && session?.user) {
    const userId = session.user.id ?? null;
    const email = session.user.email ?? null;
    console.log("Trying fallback - userId:", userId, "email:", email);

    const byUser = userId
      ? await prisma.player.findUnique({
          where: { userId },
          select: { id: true },
        })
      : null;
    console.log("Player found by userId:", byUser);

    const byEmail = !byUser && email
      ? await prisma.player.findFirst({
          where: { user: { email } },
          select: { id: true },
        })
      : null;
    console.log("Player found by email:", byEmail);

    playerId = (byUser ?? byEmail)?.id ?? null;
    console.log("Resolved playerId:", playerId);
  }

  if (!playerId) {
    console.log("No playerId found - returning empty array");
    return [];
  }

  // Obtener torneos donde el usuario ha participado
  console.log("Searching tournaments for playerId:", playerId);
  const tournaments = await prisma.tournament.findMany({
    where: {
      players: {
        some: { playerId }
      }
    },
    select: {
      id: true,
      title: true,
      isActive: true,
      startDate: true,
      endDate: true,
      rounds: {
        select: { id: true, number: true, isClosed: true },
        orderBy: { number: 'desc' }
      }
    },
    orderBy: [
      { isActive: 'desc' },
      { startDate: 'desc' }
    ]
  });

  console.log("Found tournaments:", tournaments.length);
  console.log("Tournaments details:", tournaments);

  const filteredTournaments = tournaments.filter(t => t.rounds.length > 0);
  console.log("Tournaments with rounds:", filteredTournaments.length);
  
  return filteredTournaments;
}

async function pickTournamentId(explicitId?: string | null, userTournaments?: any[]) {
  if (explicitId) {
    const t = await prisma.tournament.findUnique({ where: { id: explicitId } });
    if (t) return t.id;
  }

  // Priorizar torneo activo del usuario
  if (userTournaments) {
    const activeTournament = userTournaments.find(t => t.isActive);
    if (activeTournament) return activeTournament.id;

    // Si no hay activo, usar el más reciente
    if (userTournaments.length > 0) return userTournaments[0].id;
  }

  // Fallback a cualquier torneo activo
  const active = await prisma.tournament.findFirst({ where: { isActive: true } });
  if (active) {
    const anyResults = await prisma.match.count({
      where: { isConfirmed: true, group: { round: { tournamentId: active.id } } },
    });
    if (anyResults > 0) return active.id;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const DEBUG = url.searchParams.get("debug") === "1";
  const REF = url.searchParams.get("ref") ? Number(url.searchParams.get("ref")) : undefined;
  const TOURNAMENT_ID = url.searchParams.get("tournamentId");

  console.log("=== RANKINGS API DEBUG ===");
  console.log("Query params:", Object.fromEntries(url.searchParams));

  const debug: any = DEBUG ? { queryParams: Object.fromEntries(url.searchParams), notes: [], steps: {} } : null;

  try {
    const session = await getServerSession(authOptions);
    console.log("Session:", session?.user);
    
    // Obtener torneos del usuario
    const userTournaments = session ? await getUserTournaments(session) : [];
    console.log("User tournaments found:", userTournaments.length);
    console.log("User tournaments:", userTournaments);

    // Seleccionar torneo
    const tournamentId = await pickTournamentId(TOURNAMENT_ID, userTournaments);
    console.log("Selected tournament ID:", tournamentId);
    
    if (!tournamentId) {
      return NextResponse.json({
        hasActiveTournament: false,
        hasRankings: false,
        message: "No hay torneos con datos disponibles.",
        tournaments: userTournaments.map(t => ({
          id: t.id,
          title: t.title,
          isActive: t.isActive,
          hasData: t.rounds.some((r: any) => r.isClosed)
        })),
        selectedTournament: null,
        official: [],
        ironman: [],
        ...(DEBUG ? { debug } : {}),
      });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        rounds: { orderBy: { number: "desc" }, select: { id: true, number: true, isClosed: true } },
      },
    });

    if (!tournament || tournament.rounds.length === 0) {
      return NextResponse.json({
        hasActiveTournament: true,
        hasRankings: false,
        message: "El torneo no tiene rondas completadas.",
        tournaments: userTournaments.map(t => ({
          id: t.id,
          title: t.title,
          isActive: t.isActive,
          hasData: t.rounds.some((r: any) => r.isClosed)
        })),
        selectedTournament: tournament ? { id: tournamentId, title: tournament.title } : null,
        official: [],
        ironman: [],
        ...(DEBUG ? { debug: { ...debug, tournament } } : {}),
      });
    }

    const latestClosed = tournament.rounds.find((r) => r.isClosed);
    const referenceRound = REF
      ? tournament.rounds.find((r) => r.number === REF) ?? tournament.rounds[0]
      : latestClosed ?? tournament.rounds[0];
    const refRoundNumber = referenceRound.number;

    debug && (debug.steps.tournament = {
      selectedTournament: { id: tournament.id, title: tournament.title },
      rounds: tournament.rounds,
      latestClosed: latestClosed?.number ?? null,
      refRoundNumber,
    });

    // Obtener todos los jugadores del torneo para incluir los que no tienen puntos
    const tournamentPlayers = await prisma.tournamentPlayer.findMany({
      where: { tournamentId: tournament.id },
      include: { player: { select: { id: true, name: true } } },
    });

    // Traer todos los sets confirmados ≤ ronda de referencia
    const matches = await prisma.match.findMany({
      where: {
        isConfirmed: true,
        group: { round: { tournamentId: tournament.id, number: { lte: refRoundNumber } } },
      },
      select: {
        id: true,
        team1Player1Id: true,
        team1Player2Id: true,
        team2Player1Id: true,
        team2Player2Id: true,
        team1Games: true,
        team2Games: true,
        tiebreakScore: true,
        group: { select: { round: { select: { number: true } } } },
      },
      orderBy: { id: "asc" },
    });

    debug && (debug.steps.matches = { confirmedCount: matches.length, sample: matches.slice(0, 5) });

    // Agregar puntos por jugador según reglas
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

    const base = tournamentPlayers.map((tp) => {
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

    // Rankings (Oficial por promedio, Ironman por total)
    const official = [...base]
      .sort((a, b) =>
        b.averagePoints !== a.averagePoints ? b.averagePoints - a.averagePoints : b.totalPoints - a.totalPoints
      )
      .map((p, i) => ({ ...p, position: i + 1 }));

    const ironman = [...base]
      .sort((a, b) =>
        b.totalPoints !== a.totalPoints ? b.totalPoints - a.totalPoints : b.averagePoints - a.averagePoints
      )
      .map((p, i) => ({ ...p, position: i + 1 }));

    const hasRankings = matches.length > 0 && base.some((p) => p.roundsPlayed > 0 || p.totalPoints > 0);

    console.log("=== FINAL RESULT DEBUG ===");
    console.log("hasRankings:", hasRankings);
    console.log("matches.length:", matches.length);
    console.log("base players with data:", base.filter(p => p.roundsPlayed > 0 || p.totalPoints > 0).length);
    console.log("official ranking length:", official.length);
    console.log("ironman ranking length:", ironman.length);

    debug && (debug.steps.aggregates = {
      hasRankings,
      topOfficialSample: official.slice(0, 5),
      topIronmanSample: ironman.slice(0, 5),
    });

    const finalResponse = {
      hasActiveTournament: true,
      hasRankings,
      message: referenceRound.isClosed
        ? `Clasificaciones hasta la ronda cerrada ${refRoundNumber}.`
        : `Clasificaciones con progreso hasta la ronda ${refRoundNumber} (en curso).`,
      tournaments: userTournaments.map(t => ({
        id: t.id,
        title: t.title,
        isActive: t.isActive,
        hasData: t.rounds.some((r: any) => r.isClosed || matches.length > 0)
      })),
      selectedTournament: { id: tournament.id, title: tournament.title },
      official,
      ironman,
      ...(DEBUG ? { debug } : {}),
    };

    console.log("Final response hasRankings:", finalResponse.hasRankings);
    console.log("Final response hasActiveTournament:", finalResponse.hasActiveTournament);

    return NextResponse.json(finalResponse);
  } catch (e) {
    console.error("Error /api/rankings:", e);
    return NextResponse.json(
      { 
        hasActiveTournament: false, 
        hasRankings: false, 
        message: "Error interno", 
        tournaments: [],
        selectedTournament: null,
        official: [], 
        ironman: [] 
      },
      { status: 500 }
    );
  }
}