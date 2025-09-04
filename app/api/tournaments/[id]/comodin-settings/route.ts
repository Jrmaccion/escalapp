// app/api/tournaments/[id]/comodin-settings/route.ts - VERSIÓN MEJORADA
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const tournament = await prisma.tournament.findUnique({
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

  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ success: true, tournament });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
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

    // Validaciones específicas
    const validationErrors: string[] = [];

    if (typeof maxComodinesPerPlayer === "number" && (maxComodinesPerPlayer < 0 || maxComodinesPerPlayer > 10)) {
      validationErrors.push("maxComodinesPerPlayer debe estar entre 0 y 10");
    }

    if (typeof substituteCreditFactor === "number" && (substituteCreditFactor < 0 || substituteCreditFactor > 1)) {
      validationErrors.push("substituteCreditFactor debe estar entre 0.0 y 1.0");
    }

    if (typeof substituteMaxAppearances === "number" && substituteMaxAppearances < 1) {
      validationErrors.push("substituteMaxAppearances debe ser al menos 1");
    }

    // Validación: al menos un tipo de comodín debe estar habilitado
    if (typeof enableMeanComodin === "boolean" && typeof enableSubstituteComodin === "boolean") {
      if (!enableMeanComodin && !enableSubstituteComodin) {
        validationErrors.push("Debe habilitar al menos un tipo de comodín");
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({ 
        error: "Errores de validación", 
        details: validationErrors 
      }, { status: 400 });
    }

    // Actualizar configuración
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

    return NextResponse.json({ 
      success: true, 
      tournament: updated,
      message: "Configuración actualizada correctamente"
    });

  } catch (error) {
    console.error("[PUT comodin-settings] error:", error);
    return NextResponse.json({ 
      error: "Error al actualizar la configuración" 
    }, { status: 500 });
  }
}