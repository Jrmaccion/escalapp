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

    const updatedMatch = await prisma.match.update({
      where: { id: params.id },
      data: {
        isConfirmed: true,
        confirmedById: session.user.id, // Si tienes este campo
      },
    });

    return NextResponse.json(updatedMatch);
  } catch (error) {
    console.error("Error confirming match:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}