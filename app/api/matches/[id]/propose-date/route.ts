import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type RouteParams = { params: { id: string } };

export async function POST(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matchId = params.id;
  const { proposedDate, message } = await req.json();

  if (!proposedDate) {
    return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });
  }

  // Verificar que el usuario puede proponer fecha para este partido
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      group: {
        include: {
          round: true
        }
      }
    }
  });

  if (!match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  if (match.group.round.isClosed) {
    return NextResponse.json({ error: "La ronda está cerrada" }, { status: 400 });
  }

  // Verificar que el usuario participa en el partido
  const playerId = session.user.playerId;
  const isParticipant = playerId && [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id
  ].includes(playerId);

  if (!isParticipant && !session.user.isAdmin) {
    return NextResponse.json({ error: "No puedes proponer fecha para este partido" }, { status: 403 });
  }

  try {
    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        proposedDate: new Date(proposedDate),
        proposedById: session.user.id,
        status: 'DATE_PROPOSED',
        acceptedBy: [session.user.id], // El que propone automáticamente acepta
      }
    });

    // TODO: Enviar notificaciones a otros jugadores del partido

    return NextResponse.json({
      success: true,
      message: "Fecha propuesta correctamente",
      match: updatedMatch
    });
  } catch (error) {
    console.error("Error proposing date:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matchId = params.id;
  const { action } = await req.json(); // 'accept' | 'reject'

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      group: {
        include: {
          round: true
        }
      }
    }
  });

  if (!match || match.group.round.isClosed) {
    return NextResponse.json({ error: "Partido no válido o ronda cerrada" }, { status: 400 });
  }

  const playerId = session.user.playerId;
  const isParticipant = playerId && [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id
  ].includes(playerId);

  if (!isParticipant && !session.user.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    if (action === 'accept') {
      // Añadir usuario a la lista de aceptados
      const acceptedBy = match.acceptedBy || [];
      if (!acceptedBy.includes(session.user.id)) {
        acceptedBy.push(session.user.id);
      }

      // Si todos han aceptado (4 jugadores), confirmar fecha
      const allPlayerIds = [
        match.team1Player1Id,
        match.team1Player2Id,
        match.team2Player1Id,
        match.team2Player2Id
      ];

      // Obtener IDs de usuarios de estos jugadores
      const players = await prisma.player.findMany({
        where: { id: { in: allPlayerIds } },
        include: { user: true }
      });

      const userIds = players
        .map(p => p.user?.id)
        .filter(Boolean) as string[];

      const allAccepted = userIds.every(uid => acceptedBy.includes(uid));

      const updateData: any = {
        acceptedBy,
        ...(allAccepted && {
          acceptedDate: match.proposedDate,
          status: 'SCHEDULED'
        })
      };

      const updatedMatch = await prisma.match.update({
        where: { id: matchId },
        data: updateData
      });

      return NextResponse.json({
        success: true,
        message: allAccepted ? "Fecha confirmada por todos los jugadores" : "Fecha aceptada",
        match: updatedMatch,
        allAccepted
      });
    } else if (action === 'reject') {
      // Rechazar fecha propuesta
      const updatedMatch = await prisma.match.update({
        where: { id: matchId },
        data: {
          proposedDate: null,
          proposedById: null,
          acceptedBy: [],
          status: 'PENDING'
        }
      });

      return NextResponse.json({
        success: true,
        message: "Fecha rechazada. Pueden proponer una nueva.",
        match: updatedMatch
      });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    console.error("Error handling date response:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}