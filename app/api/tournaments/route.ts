import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { title, startDate, endDate, totalRounds, roundDurationDays, isPublic } = body;

    // Validación
    if (!title || !startDate || !totalRounds || !roundDurationDays) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    if (totalRounds < 1 || totalRounds > 20) {
      return NextResponse.json({ error: "Las rondas deben estar entre 1 y 20" }, { status: 400 });
    }

    if (roundDurationDays < 1 || roundDurationDays > 30) {
      return NextResponse.json({ error: "Los días por ronda deben estar entre 1 y 30" }, { status: 400 });
    }

    // Verificar que no haya un torneo con el mismo nombre
    const existingTournament = await prisma.tournament.findFirst({
      where: { title: title.trim() }
    });

    if (existingTournament) {
      return NextResponse.json({ error: "Ya existe un torneo con ese nombre" }, { status: 400 });
    }

    // Crear el torneo
    const tournament = await prisma.tournament.create({
      data: {
        title: title.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalRounds: Number(totalRounds),
        roundDurationDays: Number(roundDurationDays),
        isActive: false, // Los torneos nuevos empiezan inactivos
        isPublic: Boolean(isPublic),
      },
    });

    return NextResponse.json(tournament, { status: 201 });
  } catch (error) {
    console.error("Error creating tournament:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        rounds: true,
        players: true,
      }
    });

    return NextResponse.json(tournaments);
  } catch (error) {
    console.error("Error getting tournaments:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}