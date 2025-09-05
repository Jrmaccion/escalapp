// app/api/tournaments/[id]/streak-settings/route.ts - CORREGIDO PARA CONTINUIDAD
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
      // ✅ CORREGIDO: Usando campos correctos de continuidad
      continuityEnabled: true,
      continuityPointsPerSet: true,
      continuityPointsPerRound: true,
      continuityMinRounds: true,
      continuityMaxBonus: true,
      continuityMode: true,
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
    
    // ✅ CORREGIDO: Mapear campos antiguos a nuevos para compatibilidad con UI
    const {
      // Mapeo de nombres legacy (UI usa nombres streak* para compatibilidad)
      streakEnabled,
      streakPointsPerSetWin,
      streakPointsPerMatchWin,
      streakMinSetsForBonus,
      streakMaxBonusPerRound,
      streakBonusMode,
      // Nombres nuevos directos
      continuityEnabled,
      continuityPointsPerSet,
      continuityPointsPerRound,
      continuityMinRounds,
      continuityMaxBonus,
      continuityMode,
    } = body as Partial<{
      // Legacy mapping
      streakEnabled: boolean;
      streakPointsPerSetWin: number;
      streakPointsPerMatchWin: number;
      streakMinSetsForBonus: number;
      streakMaxBonusPerRound: number;
      streakBonusMode: string;
      // New names
      continuityEnabled: boolean;
      continuityPointsPerSet: number;
      continuityPointsPerRound: number;
      continuityMinRounds: number;
      continuityMaxBonus: number;
      continuityMode: string;
    }>;

    // Usar nuevos nombres o mapear desde legacy
    const finalEnabled = continuityEnabled ?? streakEnabled;
    const finalPointsPerSet = continuityPointsPerSet ?? streakPointsPerSetWin;
    const finalPointsPerRound = continuityPointsPerRound ?? streakPointsPerMatchWin;
    const finalMinRounds = continuityMinRounds ?? streakMinSetsForBonus;
    const finalMaxBonus = continuityMaxBonus ?? streakMaxBonusPerRound;
    const finalMode = continuityMode ?? streakBonusMode;

    // Validaciones
    const validationErrors: string[] = [];

    if (typeof finalPointsPerSet === "number" && (finalPointsPerSet < 0 || finalPointsPerSet > 5)) {
      validationErrors.push("continuityPointsPerSet debe estar entre 0 y 5");
    }

    if (typeof finalPointsPerRound === "number" && (finalPointsPerRound < 0 || finalPointsPerRound > 10)) {
      validationErrors.push("continuityPointsPerRound debe estar entre 0 y 10");
    }

    if (typeof finalMinRounds === "number" && (finalMinRounds < 1 || finalMinRounds > 10)) {
      validationErrors.push("continuityMinRounds debe estar entre 1 y 10");
    }

    if (typeof finalMaxBonus === "number" && (finalMaxBonus < 0 || finalMaxBonus > 20)) {
      validationErrors.push("continuityMaxBonus debe estar entre 0 y 20");
    }

    if (typeof finalMode === "string" && !["SETS", "MATCHES", "BOTH"].includes(finalMode)) {
      validationErrors.push("continuityMode debe ser 'SETS', 'MATCHES' o 'BOTH'");
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({ 
        error: "Errores de validación", 
        details: validationErrors 
      }, { status: 400 });
    }

    // ✅ CORREGIDO: Actualizar campos correctos en DB
    const updated = await prisma.tournament.update({
      where: { id: params.id },
      data: {
        ...(typeof finalEnabled === "boolean" ? { continuityEnabled: finalEnabled } : {}),
        ...(typeof finalPointsPerSet === "number" ? { continuityPointsPerSet: finalPointsPerSet } : {}),
        ...(typeof finalPointsPerRound === "number" ? { continuityPointsPerRound: finalPointsPerRound } : {}),
        ...(typeof finalMinRounds === "number" ? { continuityMinRounds: finalMinRounds } : {}),
        ...(typeof finalMaxBonus === "number" ? { continuityMaxBonus: finalMaxBonus } : {}),
        ...(typeof finalMode === "string" ? { continuityMode: finalMode } : {}),
      },
      select: {
        id: true,
        title: true,
        continuityEnabled: true,
        continuityPointsPerSet: true,
        continuityPointsPerRound: true,
        continuityMinRounds: true,
        continuityMaxBonus: true,
        continuityMode: true,
      },
    });

    return NextResponse.json({ 
      success: true, 
      tournament: updated,
      message: "Configuración de continuidad actualizada correctamente"
    });

  } catch (error) {
    console.error("[PUT continuity-settings] error:", error);
    return NextResponse.json({ 
      error: "Error al actualizar la configuración de continuidad" 
    }, { status: 500 });
  }
}