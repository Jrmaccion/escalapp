// app/api/rounds/[id]/close/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { closeRound, generateNextRoundFromMovements, GROUP_SIZE } from "@/lib/rounds";
import { generateRotationForGroup } from "@/lib/matches";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    // 1) Validaciones básicas
    const round = await prisma.round.findUnique({
      where: { id: params.id },
      include: { tournament: true },
    });
    if (!round) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    if (round.isClosed) {
      // Idempotencia: si ya estaba cerrada, intentamos igualmente generar la siguiente
      // para evitar estados a medias.
    }

    // 2) Cerrar ronda y recalcular ranking de esa ronda
    await closeRound(params.id);

    // 3) Generar la siguiente ronda a partir de movimientos + nuevos inscritos
    let nextRoundId: string | null = null;
    try {
      nextRoundId = await generateNextRoundFromMovements(params.id);
    } catch (err: any) {
      // Si ya no hay más rondas que generar (límite del torneo), devolvemos OK sin siguiente ronda
      if (typeof err?.message === "string" && err.message.includes("No se pueden generar más rondas")) {
        return NextResponse.json({
          ok: true,
          message: "Ronda cerrada. No se generan más rondas (límite del torneo).",
          nextRoundId: null,
        });
      }
      throw err;
    }

    // 4) Autogenerar partidos en la nueva ronda SOLO para grupos exactos de GROUP_SIZE
    const nextRound = await prisma.round.findUnique({
      where: { id: nextRoundId! },
      include: {
        groups: {
          include: { players: true },
          orderBy: { number: "asc" },
        },
      },
    });

    let groupsWithMatches = 0;
    let groupsSkipped = 0;

    if (nextRound) {
      for (const g of nextRound.groups) {
        const ordered = [...g.players].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        if (ordered.length === GROUP_SIZE) {
          // (Opcional) si tu tabla de partidos permite duplicados, elimina anteriores del grupo:
          // await prisma.match.deleteMany({ where: { groupId: g.id } });

          await generateRotationForGroup(
            g.id,
            ordered.map((p) => ({ id: p.playerId, position: p.position ?? 0 }))
          );
          groupsWithMatches += 1;
        } else {
          groupsSkipped += 1;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      nextRoundId,
      summary: {
        groupsWithMatches,
        groupsSkipped, // p.ej. grupos incompletos (<4) o inconsistentes
        groupSize: GROUP_SIZE,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error al cerrar/generar ronda" },
      { status: 400 }
    );
  }
}
