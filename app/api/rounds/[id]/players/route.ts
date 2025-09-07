// app/api/rounds/[id]/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest, 
  { params }: { params: { id: string } } // ✅ CORREGIDO: usar 'id' no 'roundId'
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const roundId = params.id; // ✅ CORREGIDO: params.id

    if (!roundId) {
      return NextResponse.json({ 
        error: "roundId requerido" 
      }, { status: 400 });
    }

    // Verificar que la ronda existe
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, number: true, isClosed: true }
    });

    if (!round) {
      return NextResponse.json({ 
        error: "Ronda no encontrada" 
      }, { status: 404 });
    }

    // ✅ CORREGIDO: Include correcto sin substitutePlayer
    const playersInRound = await prisma.groupPlayer.findMany({
      where: {
        group: { roundId }
      },
      include: {
        player: {
          select: { id: true, name: true }
        },
        group: {
          select: { number: true, level: true }
        }
      },
      orderBy: [
        { group: { number: 'asc' } },
        { position: 'asc' }
      ]
    });

    // ✅ CORREGIDO: Obtener sustitutos por separado cuando existen
    const substitutesInfo = await Promise.all(
      playersInRound
        .filter(gp => gp.substitutePlayerId)
        .map(async (gp) => {
          const substitute = await prisma.player.findUnique({
            where: { id: gp.substitutePlayerId! },
            select: { id: true, name: true }
          });
          return { groupPlayerId: gp.id, substitute };
        })
    );

    // Crear map para acceso rápido
    const substitutesMap = new Map(
      substitutesInfo.map(info => [info.groupPlayerId, info.substitute])
    );

    // ✅ CORREGIDO: Formatear usando las propiedades correctas
    const formattedPlayers = playersInRound.map(gp => ({
      id: gp.player.id,
      name: gp.player.name,
      position: gp.position,
      groupNumber: gp.group.number,
      groupLevel: gp.group.level,
      hasSubstitute: !!gp.substitutePlayerId,
      substituteName: substitutesMap.get(gp.id)?.name || null,
      substituteId: gp.substitutePlayerId,
      usedComodin: gp.usedComodin,
      points: gp.points,
      streak: gp.streak
    }));

    return NextResponse.json({
      success: true,
      players: formattedPlayers,
      roundInfo: {
        number: round.number,
        isClosed: round.isClosed,
        totalPlayers: formattedPlayers.length,
        playersWithSubstitutes: formattedPlayers.filter(p => p.hasSubstitute).length,
        playersWithComodin: formattedPlayers.filter(p => p.usedComodin).length
      }
    });

  } catch (error) {
    console.error("Error obteniendo jugadores de la ronda:", error);
    return NextResponse.json({ 
      error: "Error interno del servidor" 
    }, { status: 500 });
  }
}