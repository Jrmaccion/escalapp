import { NextRequest, NextResponse } from "next/server";
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

  // Caso especial TB: si 4–4 y hay marcador de TB, decidir por TB y computar 5–4
  if (a === 4 && b === 4 && tiebreakScore) {
    const m = /^(\d+)-(\d+)$/.exec(tiebreakScore.trim());
    if (m) {
      const tb1 = Number(m[1]);
      const tb2 = Number(m[2]);
      if (tb1 > tb2) {
        a = 5; // computa como 5–4
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

async function pickTournamentId(explicitId?: string | null, dbg?: any) {
  if (explicitId) {
    const t = await prisma.tournament.findUnique({ where: { id: explicitId } });
    if (t) {
      dbg?.notes.push(`pickTournamentId: usando explícito ${explicitId}`);
      return t.id;
    }
    dbg?.notes.push(`pickTournamentId: explícito ${explicitId} no encontrado`);
  }

  const active = await prisma.tournament.findFirst({ where: { isActive: true } });
  if (active) {
    const anyResults = await prisma.match.count({
      where: { isConfirmed: true, group: { round: { tournamentId: active.id } } },
    });
    dbg?.candidates.push({ id: active.id, title: active.title, tag: "active", anyResults });
    if (anyResults > 0) return active.id;
  }

  const recent = await prisma.tournament.findMany({ orderBy: { startDate: "desc" }, take: 5 });
  for (const t of recent) {
    const anyResults = await prisma.match.count({
      where: { isConfirmed: true, group: { round: { tournamentId: t.id } } },
    });
    dbg?.candidates.push({ id: t.id, title: t.title, tag: "recent", anyResults });
    if (anyResults > 0) return t.id;
  }
  return active?.id ?? recent[0]?.id ?? null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const DEBUG = url.searchParams.get("debug") === "1";
  const REF = url.searchParams.get("ref") ? Number(url.searchParams.get("ref")) : undefined;

  const debug: any = DEBUG ? { queryParams: Object.fromEntries(url.searchParams), notes: [], steps: {} } : null;

  try {
    // Torneo
    const tournamentId = await pickTournamentId(url.searchParams.get("tournamentId"), debug);
    if (!tournamentId) {
      return NextResponse.json({
        hasActiveTournament: false,
        hasRankings: false,
        message: "No hay torneos con datos.",
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
        message: "El torneo no tiene rondas.",
        official: [],
        ironman: [],
        tournament: { id: tournamentId, title: tournament?.title ?? "" },
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

    // 1) Traemos todos los sets confirmados ≤ ronda de referencia
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

    // 2) Agregamos puntos por jugador según reglas
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

      const team1Pts = g1 + (winner === 1 ? 1 : 0); // +1 por set ganado
      const team2Pts = g2 + (winner === 2 ? 1 : 0);

      // Suma a cada jugador (ignora nulos por si acaso)
      if (m.team1Player1Id) addPoints(m.team1Player1Id, team1Pts, rn);
      if (m.team1Player2Id) addPoints(m.team1Player2Id, team1Pts, rn);
      if (m.team2Player1Id) addPoints(m.team2Player1Id, team2Pts, rn);
      if (m.team2Player2Id) addPoints(m.team2Player2Id, team2Pts, rn);
    }

    // 3) Base de jugadores del torneo (para incluir con 0 puntos)
    const tPlayers = await prisma.tournamentPlayer.findMany({
      where: { tournamentId: tournament.id },
      include: { player: { select: { id: true, name: true } } },
      orderBy: { player: { name: "asc" } },
    });

    debug && (debug.steps.players = {
      tournamentPlayers: tPlayers.length,
      playersWithAnyPoints: Array.from(totalByPlayer.keys()).length,
      sample: tPlayers.slice(0, 5).map((tp) => ({ id: tp.player.id, name: tp.player.name })),
    });

    const base = tPlayers.map((tp) => {
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

    // 4) Rankings (Oficial por promedio, Ironman por total)
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

    debug && (debug.steps.aggregates = {
      hasRankings,
      topOfficialSample: official.slice(0, 5),
      topIronmanSample: ironman.slice(0, 5),
    });

    return NextResponse.json({
      hasActiveTournament: true,
      hasRankings,
      message: referenceRound.isClosed
        ? `Mostrando hasta la ronda cerrada ${refRoundNumber}.`
        : `Mostrando progreso hasta la ronda ${refRoundNumber} (sin cerrar).`,
      tournament: { id: tournament.id, title: tournament.title },
      official,
      ironman,
      ...(DEBUG ? { debug } : {}),
    });
  } catch (e) {
    console.error("Error /api/rankings:", e);
    return NextResponse.json(
      { hasActiveTournament: false, hasRankings: false, message: "Error interno", official: [], ironman: [] },
      { status: 500 }
    );
  }
}
