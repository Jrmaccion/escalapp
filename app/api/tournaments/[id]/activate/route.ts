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

    // Desactivar cualquier torneo activo actual
    await prisma.tournament.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Activar el torneo seleccionado
    const tournament = await prisma.tournament.update({
      where: { id: params.id },
      data: { isActive: true },
    });

    return NextResponse.json(tournament);
  } catch (error) {
    console.error("Error activating tournament:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}