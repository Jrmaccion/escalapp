// app/api/tournaments/[id]/available-players/route.ts - NUEVO ARCHIVO
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournamentId = params.id;

    // Verificar que el torneo existe
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true }
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    // Obtener todos los jugadores
    const allPlayers = await prisma.player.findMany({
      include: {
        user: { select: { email: true } }
      },
      orderBy: { name: 'asc' }
    });

    // Obtener jugadores ya inscritos en este torneo
    const inscribedPlayerIds = await prisma.tournamentPlayer.findMany({
      where: { tournamentId },
      select: { playerId: true }
    }).then(results => results.map(tp => tp.playerId));

    // Filtrar jugadores disponibles (no inscritos)
    const availablePlayers = allPlayers
      .filter(player => !inscribedPlayerIds.includes(player.id))
      .map(player => ({
        id: player.id,
        name: player.name,
        email: player.user.email
      }));

    return NextResponse.json({
      ok: true,
      availablePlayers,
      stats: {
        total: allPlayers.length,
        available: availablePlayers.length,
        inscribed: inscribedPlayerIds.length
      }
    });

  } catch (error) {
    console.error("Error fetching available players:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}