import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { team1Games, team2Games, tiebreakScore } = body;

    // Validar datos
    if (typeof team1Games !== 'number' || typeof team2Games !== 'number') {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Actualizar el match
    const updatedMatch = await prisma.match.update({
      where: { id: params.id },
      data: {
        team1Games,
        team2Games,
        tiebreakScore: tiebreakScore || null,
      },
    });

    return NextResponse.json(updatedMatch);
  } catch (error) {
    console.error("Error updating match:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}