import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar que el torneo no esté activo
    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id }
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    if (tournament.isActive) {
      return NextResponse.json(
        { error: "No se puede eliminar un torneo activo" }, 
        { status: 400 }
      );
    }

    // Eliminar en cascada (Prisma debería manejar esto según tu esquema)
    await prisma.tournament.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: "Torneo eliminado correctamente" });
  } catch (error) {
    console.error("Error deleting tournament:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
      include: {
        rounds: {
          include: {
            groups: {
              include: {
                players: {
                  include: {
                    player: true
                  }
                },
                matches: true
              }
            }
          }
        },
        players: {
          include: {
            player: true
          }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    return NextResponse.json(tournament);
  } catch (error) {
    console.error("Error getting tournament:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}