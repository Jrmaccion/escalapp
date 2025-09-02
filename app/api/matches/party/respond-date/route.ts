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

    const { groupId, action } = await req.json(); // 'accept' | 'reject'

    if (!groupId || !action) {
      return NextResponse.json({ error: "groupId y action son requeridos" }, { status: 400 });
    }

    // Obtener el grupo y sus matches
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        round: { select: { isClosed: true } },
        matches: true
      }
    });

    if (!group || group.round.isClosed) {
      return NextResponse.json({ error: "Grupo no válido o ronda cerrada" }, { status: 400 });
    }

    // Verificar que el usuario participa en el partido
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

    const firstMatch = group.matches[0];
    if (!firstMatch) {
      return NextResponse.json({ error: "No hay sets en este grupo" }, { status: 400 });
    }

    if (action === 'accept') {
      // Obtener usuarios de todos los jugadores para verificar confirmaciones
      const players = await prisma.player.findMany({
        where: { id: { in: Array.from(allPlayerIds) } },
        include: { user: { select: { id: true } } }
      });

      const userIds = players
        .map(p => p.user?.id)
        .filter(Boolean) as string[];

      // Añadir usuario a la lista de aceptados
      const acceptedBy = firstMatch.acceptedBy || [];
      if (!acceptedBy.includes(session.user.id)) {
        acceptedBy.push(session.user.id);
      }

      // Verificar si todos han aceptado
      const allAccepted = userIds.every(uid => acceptedBy.includes(uid));

      const updateData: any = {
        acceptedBy,
        ...(allAccepted && {
          acceptedDate: firstMatch.proposedDate,
          status: 'SCHEDULED'
        })
      };

      // Actualizar TODOS los sets del grupo
      await prisma.match.updateMany({
        where: { groupId },
        data: updateData
      });

      return NextResponse.json({
        success: true,
        message: allAccepted ? 
          "Partido confirmado por todos los jugadores. ¡Ya pueden jugar los 3 sets!" : 
          "Fecha aceptada. Esperando confirmación de otros jugadores.",
        allAccepted
      });

    } else if (action === 'reject') {
      // Rechazar fecha: resetear programación de TODOS los sets
      await prisma.match.updateMany({
        where: { groupId },
        data: {
          proposedDate: null,
          proposedById: null,
          acceptedBy: [],
          acceptedDate: null,
          status: 'PENDING'
        }
      });

      return NextResponse.json({
        success: true,
        message: "Fecha rechazada. Pueden proponer una nueva fecha para el partido."
      });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });

  } catch (error) {
    console.error("Error responding to party date:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}