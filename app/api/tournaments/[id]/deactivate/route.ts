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

    // Desactivar el torneo específico
    const tournament = await prisma.tournament.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json(tournament);
  } catch (error) {
    console.error("Error deactivating tournament:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}