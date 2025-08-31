// app/api/tournaments/[id]/available-players/route.ts
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
      select: { id: true },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    // Obtener todos los jugadores
    const allPlayers = await prisma.player.findMany({
      select: {
        id: true,
        name: true,
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Obtener jugadores ya inscritos en este torneo
    const tournamentPlayers = await prisma.tournamentPlayer.findMany({
      where: { tournamentId },
      select: { playerId: true }
    });

    const inscribedPlayerIds = new Set(tournamentPlayers.map(tp => tp.playerId));

    // Filtrar jugadores disponibles (no inscritos)
    const availablePlayers = allPlayers
      .filter(player => !inscribedPlayerIds.has(player.id))
      .map(player => ({
        id: player.id,
        name: player.name,
        email: player.user.email
      }));

    return NextResponse.json({ 
      ok: true, 
      availablePlayers,
      total: availablePlayers.length
    });

  } catch (err: any) {
    console.error("GET /tournaments/:id/available-players error", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}