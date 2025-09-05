// app/api/rounds/[id]/close/route.ts - CORREGIDO CON CAMPOS CONTINUITY
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  closeRound,
  generateNextRoundFromMovements,
  GROUP_SIZE,
} from "@/lib/rounds";
import { processContinuityStreaksForRound } from "@/lib/streak-calculator";

type ClosePayload = {
  generateNext?: boolean;
  groupSize?: number;
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const roundId = decodeURIComponent(params.id);

  let body: ClosePayload = {};
  try {
    body = (await req.json()) as ClosePayload;
  } catch {}
  const { generateNext = false, groupSize = GROUP_SIZE } = body;

  try {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { 
        tournament: { 
          select: { 
            id: true, 
            title: true,
            // ✅ CORREGIDO: Usando campos correctos de la DB
            continuityEnabled: true,
            continuityPointsPerSet: true,
            continuityPointsPerRound: true,
            continuityMinRounds: true,
            continuityMaxBonus: true,
            continuityMode: true,
          } 
        } 
      },
    });

    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    // Idempotencia
    if (round.isClosed) {
      const nextRoundId = generateNext
        ? await generateNextRoundFromMovements(round.id, groupSize)
        : null;

      return NextResponse.json({
        ok: true,
        message: "Ronda ya estaba cerrada",
        roundId: round.id,
        tournamentId: round.tournament.id,
        nextRoundId,
      });
    }

    // === CALCULAR RACHAS DE CONTINUIDAD ANTES DE CERRAR ===
    let streakMessage = "";
    if (round.tournament.continuityEnabled) {
      try {
        // ✅ CORREGIDO: Mapeo directo a nueva interfaz
        const continuityConfig = {
          continuityEnabled: round.tournament.continuityEnabled,
          continuityPointsPerSet: round.tournament.continuityPointsPerSet,
          continuityPointsPerRound: round.tournament.continuityPointsPerRound,
          continuityMinRounds: round.tournament.continuityMinRounds,
          continuityMaxBonus: round.tournament.continuityMaxBonus,
          continuityMode: round.tournament.continuityMode as "SETS" | "MATCHES" | "BOTH",
        };

        await processContinuityStreaksForRound(roundId, continuityConfig);
        streakMessage = " - Rachas de continuidad aplicadas";
      } catch (streakError) {
        console.error("Error procesando rachas de continuidad:", streakError);
        streakMessage = " - Error en rachas (continuando con cierre)";
      }
    }

    // Cerrar la ronda
    await closeRound(round.id);

    // Generar siguiente (opcional)
    const nextRoundId = generateNext
      ? await generateNextRoundFromMovements(round.id, groupSize)
      : null;

    return NextResponse.json({
      ok: true,
      message: `Ronda cerrada correctamente${streakMessage}`,
      roundId: round.id,
      tournamentId: round.tournament.id,
      nextRoundId,
    });
  } catch (error) {
    console.error("Error al cerrar la ronda:", error);
    return NextResponse.json(
      { error: "Error interno al cerrar la ronda" },
      { status: 500 }
    );
  }
}