import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const t = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      maxComodinesPerPlayer: true,
      enableMeanComodin: true,
      enableSubstituteComodin: true,
      substituteCreditFactor: true,
      substituteMaxAppearances: true,
    },
  });

  if (!t) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  return NextResponse.json({ success: true, tournament: t });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const {
    maxComodinesPerPlayer,
    enableMeanComodin,
    enableSubstituteComodin,
    substituteCreditFactor,
    substituteMaxAppearances,
  } = body as Partial<{
    maxComodinesPerPlayer: number;
    enableMeanComodin: boolean;
    enableSubstituteComodin: boolean;
    substituteCreditFactor: number;
    substituteMaxAppearances: number;
  }>;

  try {
    const updated = await prisma.tournament.update({
      where: { id: params.id },
      data: {
        ...(typeof maxComodinesPerPlayer === "number" ? { maxComodinesPerPlayer } : {}),
        ...(typeof enableMeanComodin === "boolean" ? { enableMeanComodin } : {}),
        ...(typeof enableSubstituteComodin === "boolean" ? { enableSubstituteComodin } : {}),
        ...(typeof substituteCreditFactor === "number" ? { substituteCreditFactor } : {}),
        ...(typeof substituteMaxAppearances === "number" ? { substituteMaxAppearances } : {}),
      },
      select: {
        id: true,
        title: true,
        maxComodinesPerPlayer: true,
        enableMeanComodin: true,
        enableSubstituteComodin: true,
        substituteCreditFactor: true,
        substituteMaxAppearances: true,
      },
    });
    return NextResponse.json({ success: true, tournament: updated });
  } catch (e) {
    console.error("[PUT comodin-settings] error:", e);
    return NextResponse.json({ error: "Error al actualizar la configuración" }, { status: 500 });
  }
}
