// app/api/comodin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type MeanBody = { roundId: string; mode?: "mean" };
type SubstituteBody = { roundId: string; mode: "substitute"; substitutePlayerId: string };
type Body = MeanBody | SubstituteBody;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const playerId = (session?.user as any)?.playerId as string | undefined;
    if (!playerId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = (await request.json()) as Body;
    const { roundId } = body;
    if (!roundId) return NextResponse.json({ error: "Falta roundId" }, { status: 400 });

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { tournament: true },
    });
    if (!round) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    if (round.isClosed) {
      return NextResponse.json({ error: "No se puede usar comodín en una ronda cerrada" }, { status: 400 });
    }

    // Inscripción del solicitante
    const tp = await prisma.tournamentPlayer.findFirst({
      where: { playerId, tournamentId: round.tournamentId },
      select: { tournamentId: true, playerId: true, comodinesUsed: true },
    });
    if (!tp) return NextResponse.json({ error: "No estás inscrito en este torneo" }, { status: 400 });
    if ((tp.comodinesUsed ?? 0) >= 1) {
      return NextResponse.json({ error: "Ya has usado tu comodín en este torneo" }, { status: 400 });
    }

    // El solicitante debe estar en un grupo de esta ronda
    const gp = await prisma.groupPlayer.findFirst({
      where: { playerId, group: { roundId } },
      include: { group: { select: { id: true, number: true, roundId: true } } },
    });
    if (!gp) return NextResponse.json({ error: "No estás asignado a un grupo en esta ronda" }, { status: 400 });
    if (gp.usedComodin) return NextResponse.json({ error: "Ya has usado comodín en esta ronda" }, { status: 400 });

    const mode = (body as any).mode ?? "mean";

    // ===== MODO MEDIA (compat) =====
    if (mode === "mean") {
      const groupWithPlayers = await prisma.group.findUnique({
        where: { id: gp.group.id },
        include: { players: true },
      });
      if (!groupWithPlayers) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

      let comodinPoints = 0;
      if (round.number <= 2) {
        const others = (groupWithPlayers.players || []).filter((p) => p.playerId !== playerId);
        const sum = others.reduce((acc, p) => acc + (p.points ?? 0), 0);
        comodinPoints = others.length > 0 ? sum / others.length : 0;
      } else {
        const prevGps = await prisma.groupPlayer.findMany({
          where: {
            playerId,
            usedComodin: false,
            group: {
              round: {
                tournamentId: round.tournamentId,
                number: { lt: round.number },
                isClosed: true,
              },
            },
          },
          select: { points: true },
        });
        if (prevGps.length > 0) {
          const sum = prevGps.reduce((acc, r) => acc + (r.points ?? 0), 0);
          comodinPoints = sum / prevGps.length;
        } else {
          comodinPoints = 0;
        }
      }
      comodinPoints = round1(comodinPoints);

      const result = await prisma.$transaction(async (tx) => {
        const tpNow = await tx.tournamentPlayer.findUnique({
          where: { tournamentId_playerId: { tournamentId: round.tournamentId, playerId } },
          select: { comodinesUsed: true },
        });
        if (!tpNow || (tpNow.comodinesUsed ?? 0) >= 1) {
          return { ok: false as const, reason: "COMODIN_ALREADY_USED_TOURNAMENT" as const };
        }
        const gpNow = await tx.groupPlayer.findUnique({
          where: { id: gp.id },
          select: { usedComodin: true },
        });
        if (!gpNow || gpNow.usedComodin) {
          return { ok: false as const, reason: "COMODIN_ALREADY_USED_ROUND" as const };
        }
        await tx.groupPlayer.update({
          where: { id: gp.id },
          data: { usedComodin: true, points: comodinPoints },
        });
        await tx.tournamentPlayer.update({
          where: { tournamentId_playerId: { tournamentId: round.tournamentId, playerId } },
          data: { comodinesUsed: { increment: 1 } },
        });
        return { ok: true as const };
      });

      if (!result.ok) {
        const map = {
          COMODIN_ALREADY_USED_TOURNAMENT: "Ya has usado tu comodín en este torneo",
          COMODIN_ALREADY_USED_ROUND: "Ya has usado comodín en esta ronda",
        } as const;
        return NextResponse.json({ error: map[result.reason] }, { status: 409 });
      }

      return NextResponse.json({
        success: true,
        mode,
        points: comodinPoints,
        message: `Comodín (media) aplicado: ${comodinPoints.toFixed(1)} puntos.`,
      });
    }

    // ===== MODO SUPLENTE =====
    const { substitutePlayerId } = body as SubstituteBody;
    if (!substitutePlayerId) return NextResponse.json({ error: "Falta substitutePlayerId" }, { status: 400 });
    if (substitutePlayerId === playerId) {
      return NextResponse.json({ error: "No puedes ser tu propio suplente" }, { status: 400 });
    }

    // Suplente debe estar en la misma ronda, en grupo inferior (número mayor)
    const gpSub = await prisma.groupPlayer.findFirst({
      where: { playerId: substitutePlayerId, group: { roundId } },
      include: { group: { select: { number: true, round: { select: { tournamentId: true } } } } },
    });
    if (!gpSub) return NextResponse.json({ error: "El suplente debe estar en esta misma ronda" }, { status: 400 });
    if (!gp.group?.number || !gpSub.group?.number) {
      return NextResponse.json({ error: "No se pudo determinar el número de grupo" }, { status: 400 });
    }
    if (!(gpSub.group.number > gp.group.number)) {
      return NextResponse.json({ error: "El suplente debe provenir de un grupo inferior" }, { status: 400 });
    }

    // Config del torneo (factor y máximo de apariciones)
    const tcfg = await prisma.tournament.findUnique({
      where: { id: round.tournamentId },
      select: { substituteCreditFactor: true, substituteMaxAppearances: true },
    });

    // Evitar que el suplente ya esté actuando como suplente de otro en esta ronda
    const alreadySubbing = await prisma.groupPlayer.findFirst({
      where: { group: { roundId }, substitutePlayerId },
      select: { id: true },
    });
    if (alreadySubbing) {
      return NextResponse.json({ error: "Este jugador ya actúa como suplente en esta ronda" }, { status: 409 });
    }

    // TX: marcar comodín + registrar suplente + limitar apariciones
    const subResult = await prisma.$transaction(async (tx) => {
      const tpNow = await tx.tournamentPlayer.findUnique({
        where: { tournamentId_playerId: { tournamentId: round.tournamentId, playerId } },
        select: { comodinesUsed: true },
      });
      if (!tpNow || (tpNow.comodinesUsed ?? 0) >= 1) {
        return { ok: false as const, reason: "COMODIN_ALREADY_USED_TOURNAMENT" as const };
      }

      // Límite de apariciones del suplente en este torneo
      const tpSub = await tx.tournamentPlayer.findUnique({
        where: { tournamentId_playerId: { tournamentId: round.tournamentId, playerId: substitutePlayerId } },
        select: { substituteAppearances: true },
      });
      const maxApp = tcfg?.substituteMaxAppearances ?? 2;
      if (!tpSub) {
        // si aún no figura en el torneo, no puede ser suplente
        return { ok: false as const, reason: "SUB_NOT_IN_TOURNAMENT" as const };
      }
      if ((tpSub.substituteAppearances ?? 0) >= maxApp) {
        return { ok: false as const, reason: "SUB_LIMIT_REACHED" as const };
      }

      const gpNow = await tx.groupPlayer.findUnique({
        where: { id: gp.id },
        select: { usedComodin: true, substitutePlayerId: true },
      });
      if (!gpNow || gpNow.usedComodin || gpNow.substitutePlayerId) {
        return { ok: false as const, reason: "COMODIN_ALREADY_USED_ROUND" as const };
      }

      await tx.groupPlayer.update({
        where: { id: gp.id },
        data: {
          usedComodin: true,
          substitutePlayerId, // marcador de suplente
        },
      });

      // cuenta comodín del titular
      await tx.tournamentPlayer.update({
        where: { tournamentId_playerId: { tournamentId: round.tournamentId, playerId } },
        data: { comodinesUsed: { increment: 1 } },
      });

      // sube apariciones del suplente
      await tx.tournamentPlayer.update({
        where: { tournamentId_playerId: { tournamentId: round.tournamentId, playerId: substitutePlayerId } },
        data: { substituteAppearances: { increment: 1 } },
      });

      return { ok: true as const };
    });

    if (!subResult.ok) {
      const map = {
        COMODIN_ALREADY_USED_TOURNAMENT: "Ya has usado tu comodín en este torneo",
        COMODIN_ALREADY_USED_ROUND: "Ya has usado comodín en esta ronda",
        SUB_NOT_IN_TOURNAMENT: "El suplente no está inscrito en este torneo",
        SUB_LIMIT_REACHED: "El suplente alcanzó el límite de apariciones",
      } as const;
      return NextResponse.json({ error: map[subResult.reason] }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      mode: "substitute",
      message: "Comodín (suplente) aplicado. El suplente jugará por ti; los puntos se te asignarán a ti. El suplente recibirá crédito Ironman.",
    });
  } catch (error) {
    console.error("[COMODIN] error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
