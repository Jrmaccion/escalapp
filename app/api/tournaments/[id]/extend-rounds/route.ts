// CREAR ARCHIVO: app/api/tournaments/[id]/extend-rounds/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { additionalRounds } = await request.json();

    // Validaciones
    if (!additionalRounds || typeof additionalRounds !== 'number') {
      return NextResponse.json(
        { error: "additionalRounds es requerido y debe ser un número" }, 
        { status: 400 }
      );
    }

    if (additionalRounds < 1 || additionalRounds > 10) {
      return NextResponse.json(
        { error: "Puedes añadir entre 1 y 10 rondas" }, 
        { status: 400 }
      );
    }

    // Obtener torneo actual
    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
      include: {
        rounds: {
          orderBy: { number: 'desc' },
          take: 1
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    if (!tournament.isActive) {
      return NextResponse.json(
        { error: "Solo se pueden extender torneos activos" }, 
        { status: 400 }
      );
    }

    const newTotalRounds = tournament.totalRounds + additionalRounds;

    if (newTotalRounds > 30) {
      return NextResponse.json(
        { error: "Un torneo no puede tener más de 30 rondas" }, 
        { status: 400 }
      );
    }

    // Ejecutar en transacción
    const result = await prisma.$transaction(async (tx) => {
      // 1. Actualizar el total de rondas del torneo
      const updatedTournament = await tx.tournament.update({
        where: { id: params.id },
        data: { 
          totalRounds: newTotalRounds,
          // Extender también la fecha de fin
          endDate: addDays(tournament.endDate, additionalRounds * tournament.roundDurationDays)
        }
      });

      // 2. Obtener la última ronda para saber desde dónde continuar
      const lastRound = tournament.rounds[0];
      let nextStartDate: Date;
      let nextRoundNumber: number;

      if (lastRound) {
        nextStartDate = new Date(lastRound.endDate);
        nextRoundNumber = lastRound.number + 1;
      } else {
        // Si no hay rondas (caso raro), empezar desde el inicio del torneo
        nextStartDate = new Date(tournament.startDate);
        nextRoundNumber = 1;
      }

      // 3. Crear las nuevas rondas
      const roundsToCreate = [];
      let currentStartDate = new Date(nextStartDate);

      for (let i = 0; i < additionalRounds; i++) {
        const roundEndDate = addDays(currentStartDate, tournament.roundDurationDays);
        
        roundsToCreate.push({
          tournamentId: tournament.id,
          number: nextRoundNumber + i,
          startDate: currentStartDate,
          endDate: roundEndDate,
          isClosed: false
        });
        
        currentStartDate = new Date(roundEndDate);
      }

      // Crear todas las rondas de una vez
      await tx.round.createMany({ data: roundsToCreate });

      return {
        tournament: updatedTournament,
        newRounds: roundsToCreate.length,
        newTotal: newTotalRounds
      };
    });

    return NextResponse.json({
      success: true,
      message: `Torneo extendido exitosamente. Se añadieron ${additionalRounds} ronda${additionalRounds > 1 ? 's' : ''}.`,
      data: {
        tournamentId: params.id,
        previousTotal: tournament.totalRounds,
        newTotal: result.newTotal,
        roundsAdded: additionalRounds,
        newEndDate: result.tournament.endDate.toISOString()
      }
    });

  } catch (error) {
    console.error("Error extending tournament:", error);
    return NextResponse.json(
      { 
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}