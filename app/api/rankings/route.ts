// app/api/rankings/route.ts - Endpoint unificado para rankings
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get("tournamentId");

    // Si no se especifica torneo, usar el activo
    let selectedTournamentId: string | null = tournamentId;
    if (!selectedTournamentId) {
      const activeTournament = await prisma.tournament.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      selectedTournamentId = activeTournament?.id ?? null;
    }

    if (!selectedTournamentId) {
      return NextResponse.json({ error: "No hay torneo disponible" }, { status: 404 });
    }

    // Obtener datos del torneo
    const tournament = await prisma.tournament.findUnique({
      where: { id: selectedTournamentId },
      select: {
        id: true,
        title: true,
        rounds: {
          where: { isClosed: true },
          orderBy: { number: "desc" },
          take: 1,
          select: { number: true },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    const lastClosedRound = tournament.rounds[0]?.number || 0;

    // Obtener rankings oficiales e ironman (Ranking NO tiene relación con player)
    const rankings = await prisma.ranking.findMany({
      where: {
        tournamentId: selectedTournamentId,
        roundNumber: lastClosedRound,
      },
      orderBy: { position: "asc" },
    });

    // Obtener nombres de jugadores (JOIN manual)
    const playerIds = rankings.map(r => r.playerId);
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, name: true },
    });
    const playerNameMap = new Map(players.map(p => [p.id, p.name]));

    // Obtener playerId del usuario actual (si es jugador)
    const currentUserId = session.user.id;
    const currentPlayer = await prisma.player.findUnique({
      where: { userId: currentUserId },
      select: { id: true },
    });

    // Transformar a formato esperado
    const officialRankings = rankings.map((r) => ({
      playerId: r.playerId,
      playerName: playerNameMap.get(r.playerId) || "Jugador",
      position: r.position,
      ironmanPosition: r.ironmanPosition,
      totalPoints: r.totalPoints,
      averagePoints: r.averagePoints,
      roundsPlayed: r.roundsPlayed,
      movement: r.movement || "=",
      isCurrentUser: currentPlayer ? r.playerId === currentPlayer.id : false,
    }));

    // Ironman ranking (ordenado por totalPoints)
    const ironmanRankings = [...officialRankings].sort(
      (a, b) => a.ironmanPosition - b.ironmanPosition
    );

    return NextResponse.json({
      tournamentId: tournament.id,
      tournamentTitle: tournament.title,
      roundNumber: lastClosedRound,
      official: officialRankings,
      ironman: ironmanRankings,
    });
  } catch (error: any) {
    console.error("Error en /api/rankings:", error);
    return NextResponse.json(
      { error: "Error al obtener rankings" },
      { status: 500 }
    );
  }
}
