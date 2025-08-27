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
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Eliminar el match o marcarlo como rechazado
    await prisma.match.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Match rechazado y eliminado" });
  } catch (error) {
    console.error("Error rejecting match:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}