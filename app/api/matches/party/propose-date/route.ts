import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { groupId, proposedDate, message } = await req.json();

    if (!groupId || !proposedDate) {
      return NextResponse.json({ error: "groupId y proposedDate son requeridos" }, { status: 400 });
    }

    // Verificar que el grupo existe y no está cerrado
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        round: { select: { isClosed: true } },
        matches: {
          select: { 
            team1Player1Id: true, 
            team1Player2Id: true,
            team2Player1Id: true, 
            team2Player2Id: true 
          }
        }
      }
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    if (group.round.isClosed) {
      return NextResponse.json({ error: "La ronda está cerrada" }, { status: 400 });
    }

    // Obtener todos los jugadores del grupo (de los 3 sets)
    const allPlayerIds = new Set<string>();
    group.matches.forEach(match => {
      allPlayerIds.add(match.team1Player1Id);
      allPlayerIds.add(match.team1Player2Id);
      allPlayerIds.add(match.team2Player1Id);
      allPlayerIds.add(match.team2Player2Id);
    });

    const playerId = session.user.playerId;
    if (!playerId || !Array.from(allPlayerIds).includes(playerId)) {
      return NextResponse.json({ error: "No participas en este partido" }, { status: 403 });
    }

    // Actualizar TODOS los sets del grupo con la fecha propuesta
    await prisma.match.updateMany({
      where: { groupId },
      data: {
        proposedDate: new Date(proposedDate),
        proposedById: session.user.id,
        status: 'DATE_PROPOSED',
        acceptedBy: [session.user.id], // El proponente automáticamente acepta
      }
    });

    return NextResponse.json({
      success: true,
      message: "Fecha propuesta para el partido completo (3 sets)",
    });

  } catch (error) {
    console.error("Error proposing party date:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}