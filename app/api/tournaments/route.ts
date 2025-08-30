// app/api/tournaments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";
import { buildGroupsForRound, GROUP_SIZE } from "@/lib/rounds";
import { generateRotationForGroup } from "@/lib/matches";

/**
 * GET /api/tournaments
 * Devuelve el listado de torneos con información básica.
 */
export async function GET() {
  try {
    const tournaments = await prisma.tournament.findMany({
      include: {
        rounds: { select: { id: true, number: true, isClosed: true } },
        players: { include: { player: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tournaments);
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tournaments
 * Crea un torneo y sus rondas. Opcionalmente inscribe jugadores en R1 y construye grupos (de 4) + partidos.
 * Body esperado:
 * {
 *   title: string,
 *   startDate: "YYYY-MM-DD",
 *   totalRounds: number,
 *   roundDurationDays: number,
 *   isPublic: boolean,
 *   selectedPlayerIds?: string[]   // opcional
 * }
 *
 * Respuesta: { id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      startDate,
      totalRounds,
      roundDurationDays,
      isPublic,
      selectedPlayerIds,
    } = body as {
      title: string;
      startDate: string;
      totalRounds: number;
      roundDurationDays: number;
      isPublic: boolean;
      selectedPlayerIds?: string[];
    };

    // Validaciones mínimas
    if (!title || !startDate || !totalRounds || !roundDurationDays) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }
    if (totalRounds < 3 || totalRounds > 20) {
      return NextResponse.json(
        { error: "Las rondas deben estar entre 3 y 20" },
        { status: 400 }
      );
    }
    if (roundDurationDays < 7 || roundDurationDays > 30) {
      return NextResponse.json(
        { error: "Los días por ronda deben estar entre 7 y 30" },
        { status: 400 }
      );
    }
    if (new Date(startDate) <= new Date()) {
      return NextResponse.json(
        { error: "La fecha de inicio debe ser futura" },
        { status: 400 }
      );
    }

    // Nombre único (opcional)
    const existingTournament = await prisma.tournament.findFirst({
      where: { title: title.trim() },
    });
    if (existingTournament) {
      return NextResponse.json(
        { error: "Ya existe un torneo con ese nombre" },
        { status: 400 }
      );
    }

    // 1) Crear torneo
    const start = new Date(startDate);
    const end = addDays(start, totalRounds * roundDurationDays);

    const tournament = await prisma.tournament.create({
      data: {
        title: title.trim(),
        startDate: start,
        endDate: end,
        totalRounds: Number(totalRounds),
        roundDurationDays: Number(roundDurationDays),
        isActive: true,
        isPublic: Boolean(isPublic),
      },
    });

    // 2) Crear todas las rondas (R1..RN)
    let currentStartDate = new Date(start);
    for (let i = 1; i <= totalRounds; i++) {
      const roundEndDate = addDays(currentStartDate, roundDurationDays);
      await prisma.round.create({
        data: {
          tournamentId: tournament.id,
          number: i,
          startDate: currentStartDate,
          endDate: roundEndDate,
          isClosed: false,
        },
      });
      currentStartDate = roundEndDate;
    }

    // 3) Inscribir jugadores en R1 si se han pasado explícitamente
    if (Array.isArray(selectedPlayerIds) && selectedPlayerIds.length > 0) {
      // Elimina duplicados
      const uniqueIds = Array.from(new Set(selectedPlayerIds.filter(Boolean)));

      // Inscribir todos con joinedRound = 1
      await prisma.$transaction(async (tx) => {
        for (const pid of uniqueIds) {
          // Valida que el jugador existe
          const exists = await tx.player.findUnique({ where: { id: pid } });
          if (!exists) continue;

          await tx.tournamentPlayer.upsert({
            where: {
              tournamentId_playerId: {
                tournamentId: tournament.id,
                playerId: pid,
              },
            },
            update: { joinedRound: 1 }, // si ya estaba apuntado al torneo, lo forzamos a empezar en R1
            create: {
              tournamentId: tournament.id,
              playerId: pid,
              joinedRound: 1,
              comodinesUsed: 0,
            },
          });
        }
      });

      // 4) Construir R1 en bloques exactos de 4 y generar partidos
      const r1 = await prisma.round.findFirst({
        where: { tournamentId: tournament.id, number: 1 },
      });

      if (r1) {
        // Construye grupos estrictos (de 4)
        const result = await buildGroupsForRound(r1.id, "ranking");

        // Autogenera partidos en cada grupo con exactamente 4 jugadores
        const groups = await prisma.group.findMany({
          where: { roundId: r1.id },
          include: {
            players: true,
          },
          orderBy: { number: "asc" },
        });

        for (const g of groups) {
          const ordered = [...g.players].sort(
            (a, b) => (a.position ?? 0) - (b.position ?? 0)
          );
          if (ordered.length === GROUP_SIZE) {
            await generateRotationForGroup(
              g.id,
              ordered.map((p) => ({ id: p.playerId, position: p.position ?? 0 }))
            );
          }
        }

        // (Opcional) Si quieres notificar en la UI quién se quedó fuera de R1:
        // result.skippedPlayerIds
      }
    }

    // ✅ Respuesta simplificada para el redirect del cliente
    return NextResponse.json({ id: tournament.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating tournament:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
