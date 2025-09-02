// app/api/rounds/[id]/eligible-players/route.ts
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

    const roundId = params.id;

    // Obtener información de la ronda
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { 
        id: true, 
        number: true, 
        tournamentId: true,
        tournament: { select: { title: true } }
      }
    });

    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    // Obtener jugadores elegibles para esta ronda
    const eligiblePlayers = await prisma.tournamentPlayer.findMany({
      where: { 
        tournamentId: round.tournamentId,
        joinedRound: { lte: round.number }
      },
      include: {
        player: { 
          select: { 
            id: true, 
            name: true,
            user: { select: { email: true } }
          } 
        }
      },
      orderBy: [
        { joinedRound: "asc" },
        { player: { name: "asc" } }
      ]
    });

    // Formatear la respuesta
    const players = eligiblePlayers.map(tp => ({
      playerId: tp.player.id,
      id: tp.player.id, // Alias para compatibilidad
      name: tp.player.name,
      email: tp.player.user.email,
      joinedRound: tp.joinedRound
    }));

    return NextResponse.json({
      ok: true,
      roundId: round.id,
      roundNumber: round.number,
      tournamentTitle: round.tournament.title,
      players,
      stats: {
        total: players.length,
        byJoinedRound: players.reduce((acc: Record<number, number>, p) => {
          acc[p.joinedRound] = (acc[p.joinedRound] || 0) + 1;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error("Error fetching eligible players:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}