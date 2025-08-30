// app/api/rankings/route.ts - REEMPLAZAR TODO:
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener torneo activo
    const activeTournament = await prisma.tournament.findFirst({
      where: { isActive: true },
      select: { id: true, title: true }
    });

    if (!activeTournament) {
      return NextResponse.json({
        hasActiveTournament: false,
        message: "No hay torneo activo"
      });
    }

    // Obtener última ronda cerrada
    const lastClosedRound = await prisma.round.findFirst({
      where: {
        tournamentId: activeTournament.id,
        isClosed: true
      },
      orderBy: { number: 'desc' }
    });

    if (!lastClosedRound) {
      return NextResponse.json({
        hasActiveTournament: true,
        tournament: activeTournament,
        hasRankings: false,
        message: "Aún no hay rankings disponibles."
      });
    }

    // Obtener rankings
    const rankings = await prisma.ranking.findMany({
      where: {
        tournamentId: activeTournament.id,
        roundNumber: lastClosedRound.number
      },
      orderBy: { position: 'asc' }
    });

    // Obtener nombres de jugadores
    const playerIds = rankings.map(r => r.playerId);
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, name: true }
    });

    const playerMap = players.reduce((acc, player) => {
      acc[player.id] = player.name;
      return acc;
    }, {} as Record<string, string>);

    // Crear ranking ironman ordenado por puntos totales
    const ironmanRankings = [...rankings].sort((a, b) => b.totalPoints - a.totalPoints);

    // Buscar ranking del usuario actual
    const currentUserRanking = session.user.playerId
      ? rankings.find(r => r.playerId === session.user.playerId)
      : null;

    return NextResponse.json({
      hasActiveTournament: true,
      hasRankings: true,
      tournament: activeTournament,
      currentUser: currentUserRanking ? {
        playerId: currentUserRanking.playerId,
        position: currentUserRanking.position,
        averagePoints: currentUserRanking.averagePoints,
        totalPoints: currentUserRanking.totalPoints,
        roundsPlayed: currentUserRanking.roundsPlayed,
        ironmanPosition: ironmanRankings.findIndex(r => r.playerId === currentUserRanking.playerId) + 1
      } : null,
      official: rankings.map(ranking => ({
        id: ranking.playerId,
        name: playerMap[ranking.playerId] || 'Jugador desconocido',
        position: ranking.position,
        averagePoints: ranking.averagePoints,
        totalPoints: ranking.totalPoints,
        roundsPlayed: ranking.roundsPlayed,
        isCurrentUser: ranking.playerId === session.user.playerId
      })),
      ironman: ironmanRankings.map((ranking, index) => ({
        id: ranking.playerId,
        name: playerMap[ranking.playerId] || 'Jugador desconocido',
        position: index + 1,
        totalPoints: ranking.totalPoints,
        averagePoints: ranking.averagePoints,
        roundsPlayed: ranking.roundsPlayed,
        isCurrentUser: ranking.playerId === session.user.playerId
      }))
    });

  } catch (error) {
    console.error("Error in rankings API:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}