import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { reason, reportedBy } = await request.json();
    const playerId = (session.user as any).playerId;

    // Verificar que el usuario es participante del match
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      select: {
        team1Player1Id: true,
        team1Player2Id: true,
        team2Player1Id: true,
        team2Player2Id: true,
        reportedById: true,
        isConfirmed: true
      }
    });

    if (!match) {
      return NextResponse.json({ error: "Match no encontrado" }, { status: 404 });
    }

    const isParticipant = [
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id
    ].includes(playerId);

    if (!isParticipant) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    if (match.isConfirmed) {
      return NextResponse.json({ error: "No se puede reportar error en match confirmado" }, { status: 400 });
    }

    // Resetear el match y marcar como disputado
    await prisma.match.update({
      where: { id: params.id },
      data: {
        team1Games: null,
        team2Games: null,
        tiebreakScore: null,
        isConfirmed: false,
        reportedById: null,
        confirmedById: null,
        // Agregar flag de disputa
        status: 'PENDING'
      }
    });

    // Opcional: Crear log de disputa para admins
    console.log(`Match ${params.id} disputado por ${playerId}: ${reason}`);

    return NextResponse.json({ 
      success: true,
      message: "Resultado reseteado. Reporta el resultado correcto." 
    });

  } catch (error) {
    console.error("Error reporting match error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}