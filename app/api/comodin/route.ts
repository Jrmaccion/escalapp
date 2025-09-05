// app/api/comodin/route.ts - VERSIÓN ROBUSTA CON VALIDACIONES ATÓMICAS
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type MeanBody = { roundId: string; mode?: "mean" };
type SubstituteBody = { roundId: string; mode: "substitute"; substitutePlayerId: string };
type Body = MeanBody | SubstituteBody;

// ✅ ENUM para errores específicos
enum ComodinError {
  UNAUTHORIZED = "UNAUTHORIZED",
  MISSING_ROUND_ID = "MISSING_ROUND_ID",
  ROUND_NOT_FOUND = "ROUND_NOT_FOUND",
  ROUND_CLOSED = "ROUND_CLOSED",
  PLAYER_NOT_IN_TOURNAMENT = "PLAYER_NOT_IN_TOURNAMENT",
  PLAYER_NOT_IN_GROUP = "PLAYER_NOT_IN_GROUP",
  COMODIN_ALREADY_USED = "COMODIN_ALREADY_USED",
  COMODIN_LIMIT_REACHED = "COMODIN_LIMIT_REACHED",
  CONFIRMED_MATCHES_EXIST = "CONFIRMED_MATCHES_EXIST",
  UPCOMING_MATCHES_EXIST = "UPCOMING_MATCHES_EXIST",
  MEAN_COMODIN_DISABLED = "MEAN_COMODIN_DISABLED",
  SUBSTITUTE_COMODIN_DISABLED = "SUBSTITUTE_COMODIN_DISABLED",
  INVALID_SUBSTITUTE = "INVALID_SUBSTITUTE",
  SUBSTITUTE_SELF = "SUBSTITUTE_SELF",
  SUBSTITUTE_NOT_IN_TOURNAMENT = "SUBSTITUTE_NOT_IN_TOURNAMENT",
  SUBSTITUTE_NOT_IN_ROUND = "SUBSTITUTE_NOT_IN_ROUND",
  SUBSTITUTE_USED_COMODIN = "SUBSTITUTE_USED_COMODIN",
  SUBSTITUTE_LIMIT_REACHED = "SUBSTITUTE_LIMIT_REACHED",
  SUBSTITUTE_ALREADY_SUBBING = "SUBSTITUTE_ALREADY_SUBBING",
  INVALID_GROUP_LEVEL = "INVALID_GROUP_LEVEL",
  CONCURRENT_MODIFICATION = "CONCURRENT_MODIFICATION"
}

// ✅ Mapeo de errores a mensajes
const ERROR_MESSAGES = {
  [ComodinError.UNAUTHORIZED]: "No autorizado",
  [ComodinError.MISSING_ROUND_ID]: "Falta roundId",
  [ComodinError.ROUND_NOT_FOUND]: "Ronda no encontrada",
  [ComodinError.ROUND_CLOSED]: "No se puede usar comodín en una ronda cerrada",
  [ComodinError.PLAYER_NOT_IN_TOURNAMENT]: "No estás inscrito en este torneo",
  [ComodinError.PLAYER_NOT_IN_GROUP]: "No estás asignado a un grupo en esta ronda",
  [ComodinError.COMODIN_ALREADY_USED]: "Ya has usado comodín en esta ronda",
  [ComodinError.COMODIN_LIMIT_REACHED]: "Ya has usado todos tus comodines disponibles en este torneo",
  [ComodinError.CONFIRMED_MATCHES_EXIST]: "No se puede usar comodín: ya tienes partidos con resultados confirmados",
  [ComodinError.UPCOMING_MATCHES_EXIST]: "No se puede usar comodín: tienes partidos programados en menos de 24 horas",
  [ComodinError.MEAN_COMODIN_DISABLED]: "El comodín de media está deshabilitado en este torneo",
  [ComodinError.SUBSTITUTE_COMODIN_DISABLED]: "El comodín de sustituto está deshabilitado en este torneo",
  [ComodinError.INVALID_SUBSTITUTE]: "Falta substitutePlayerId",
  [ComodinError.SUBSTITUTE_SELF]: "No puedes ser tu propio suplente",
  [ComodinError.SUBSTITUTE_NOT_IN_TOURNAMENT]: "El suplente no está inscrito en este torneo",
  [ComodinError.SUBSTITUTE_NOT_IN_ROUND]: "El suplente debe estar en esta misma ronda",
  [ComodinError.SUBSTITUTE_USED_COMODIN]: "El suplente ya ha usado comodín y no puede actuar como suplente",
  [ComodinError.SUBSTITUTE_LIMIT_REACHED]: "El suplente ha alcanzado el límite de apariciones como suplente",
  [ComodinError.SUBSTITUTE_ALREADY_SUBBING]: "El suplente ya actúa como suplente de otro jugador en esta ronda",
  [ComodinError.INVALID_GROUP_LEVEL]: "El suplente debe provenir de un grupo válido según las reglas",
  [ComodinError.CONCURRENT_MODIFICATION]: "Los datos han sido modificados por otro usuario. Intenta de nuevo"
} as const;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// ✅ Validación inicial sin transacción
async function validateInitialConditions(playerId: string, roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      tournament: {
        select: {
          id: true,
          maxComodinesPerPlayer: true,
          enableMeanComodin: true,
          enableSubstituteComodin: true,
          substituteCreditFactor: true,
          substituteMaxAppearances: true,
        }
      },
      groups: {
        include: {
          matches: {
            where: {
              OR: [
                { team1Player1Id: playerId },
                { team1Player2Id: playerId },
                { team2Player1Id: playerId },
                { team2Player2Id: playerId },
              ],
            },
            select: {
              id: true,
              proposedDate: true,
              acceptedDate: true,
              status: true,
              isConfirmed: true,
            },
          },
        },
      },
    },
  });

  if (!round) throw new Error(ComodinError.ROUND_NOT_FOUND);
  if (round.isClosed) throw new Error(ComodinError.ROUND_CLOSED);

  const tournament = round.tournament;
  if (!tournament) throw new Error(ComodinError.ROUND_NOT_FOUND);

  // Verificar inscripción en torneo
  const tp = await prisma.tournamentPlayer.findFirst({
    where: { playerId, tournamentId: round.tournamentId },
    select: { tournamentId: true, playerId: true, comodinesUsed: true },
  });
  if (!tp) throw new Error(ComodinError.PLAYER_NOT_IN_TOURNAMENT);

  // Verificar límite de comodines
  if ((tp.comodinesUsed ?? 0) >= tournament.maxComodinesPerPlayer) {
    throw new Error(ComodinError.COMODIN_LIMIT_REACHED);
  }

  // Verificar asignación a grupo
  const gp = await prisma.groupPlayer.findFirst({
    where: { playerId, group: { roundId } },
    include: { group: { select: { id: true, number: true, roundId: true, level: true } } },
  });
  if (!gp) throw new Error(ComodinError.PLAYER_NOT_IN_GROUP);
  if (gp.usedComodin) throw new Error(ComodinError.COMODIN_ALREADY_USED);

  // Verificar restricciones temporales
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const playerMatches = round.groups.flatMap((g) => g.matches).filter(Boolean);
  const confirmedMatches = playerMatches.filter((m) => m.isConfirmed);
  const upcomingMatches = playerMatches.filter(
    (m) => m.acceptedDate && new Date(m.acceptedDate) <= twentyFourHoursFromNow
  );

  if (confirmedMatches.length > 0) {
    throw new Error(ComodinError.CONFIRMED_MATCHES_EXIST);
  }
  if (upcomingMatches.length > 0) {
    throw new Error(ComodinError.UPCOMING_MATCHES_EXIST);
  }

  return { round, tournament, gp };
}

// ✅ Transacción atómica para comodín de media
async function applyMeanComodin(
  playerId: string, 
  roundId: string, 
  tournament: any, 
  gp: any,
  comodinPoints: number
) {
  return await prisma.$transaction(async (tx) => {
    // Revalidar condiciones dentro de la transacción (protección contra race conditions)
    const tpCurrent = await tx.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId: tournament.id, playerId } },
      select: { comodinesUsed: true },
    });
    
    if (!tpCurrent || (tpCurrent.comodinesUsed ?? 0) >= tournament.maxComodinesPerPlayer) {
      throw new Error(ComodinError.CONCURRENT_MODIFICATION);
    }

    const gpCurrent = await tx.groupPlayer.findUnique({
      where: { id: gp.id },
      select: { usedComodin: true, substitutePlayerId: true },
    });
    
    if (!gpCurrent || gpCurrent.usedComodin || gpCurrent.substitutePlayerId) {
      throw new Error(ComodinError.CONCURRENT_MODIFICATION);
    }

    // Aplicar cambios atómicamente
    await tx.groupPlayer.update({
      where: { id: gp.id },
      data: {
        usedComodin: true,
        points: comodinPoints,
        comodinReason: `Comodín (media): ${comodinPoints.toFixed(1)} puntos`,
        comodinAt: new Date(),
      },
    });

    await tx.tournamentPlayer.update({
      where: { tournamentId_playerId: { tournamentId: tournament.id, playerId } },
      data: { comodinesUsed: { increment: 1 } },
    });

    return { success: true, points: comodinPoints };
  });
}

// ✅ Transacción atómica para comodín de sustituto
async function applySubstituteComodin(
  playerId: string,
  substitutePlayerId: string,
  tournament: any,
  gp: any,
  gpSub: any
) {
  return await prisma.$transaction(async (tx) => {
    // Revalidar todas las condiciones críticas
    const tpCurrent = await tx.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId: tournament.id, playerId } },
      select: { comodinesUsed: true },
    });

    const tpSubCurrent = await tx.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: substitutePlayerId } },
      select: { substituteAppearances: true, comodinesUsed: true },
    });

    const gpCurrent = await tx.groupPlayer.findUnique({
      where: { id: gp.id },
      select: { usedComodin: true, substitutePlayerId: true },
    });

    const gpSubCurrent = await tx.groupPlayer.findUnique({
      where: { id: gpSub.id },
      select: { usedComodin: true },
    });

    // Verificar que no hay modificaciones concurrentes
    if (!tpCurrent || (tpCurrent.comodinesUsed ?? 0) >= tournament.maxComodinesPerPlayer) {
      throw new Error(ComodinError.CONCURRENT_MODIFICATION);
    }

    if (!tpSubCurrent || (tpSubCurrent.substituteAppearances ?? 0) >= (tournament.substituteMaxAppearances ?? 2)) {
      throw new Error(ComodinError.CONCURRENT_MODIFICATION);
    }

    if (!gpCurrent || gpCurrent.usedComodin || gpCurrent.substitutePlayerId) {
      throw new Error(ComodinError.CONCURRENT_MODIFICATION);
    }

    if (!gpSubCurrent || gpSubCurrent.usedComodin) {
      throw new Error(ComodinError.CONCURRENT_MODIFICATION);
    }

    // Verificar que el sustituto no está actuando para otro jugador
    const alreadySubbing = await tx.groupPlayer.findFirst({
      where: { 
        group: { roundId: gp.group.roundId }, 
        substitutePlayerId,
        id: { not: gp.id }
      },
    });

    if (alreadySubbing) {
      throw new Error(ComodinError.SUBSTITUTE_ALREADY_SUBBING);
    }

    // Aplicar cambios atómicamente
    await tx.groupPlayer.update({
      where: { id: gp.id },
      data: {
        usedComodin: true,
        substitutePlayerId,
        comodinReason: `Suplente: ${gpSub.player.name}`,
        comodinAt: new Date(),
        points: 0,
      },
    });

    await tx.tournamentPlayer.update({
      where: { tournamentId_playerId: { tournamentId: tournament.id, playerId } },
      data: { comodinesUsed: { increment: 1 } },
    });

    await tx.tournamentPlayer.update({
      where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: substitutePlayerId } },
      data: { substituteAppearances: { increment: 1 } },
    });

    return { success: true, substitutePlayer: gpSub.player.name };
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const playerId = (session?.user as any)?.playerId as string | undefined;
    if (!playerId) {
      return NextResponse.json({ error: ERROR_MESSAGES[ComodinError.UNAUTHORIZED] }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    const { roundId } = body;
    if (!roundId) {
      return NextResponse.json({ error: ERROR_MESSAGES[ComodinError.MISSING_ROUND_ID] }, { status: 400 });
    }

    // ✅ Validación inicial fuera de transacción
    const { round, tournament, gp } = await validateInitialConditions(playerId, roundId);
    
    const mode = (body as any).mode ?? "mean";

    // ✅ Verificar tipo de comodín habilitado
    if (mode === "mean" && !tournament.enableMeanComodin) {
      return NextResponse.json({ error: ERROR_MESSAGES[ComodinError.MEAN_COMODIN_DISABLED] }, { status: 400 });
    }
    if (mode === "substitute" && !tournament.enableSubstituteComodin) {
      return NextResponse.json({ error: ERROR_MESSAGES[ComodinError.SUBSTITUTE_COMODIN_DISABLED] }, { status: 400 });
    }

    if (mode === "mean") {
      // ✅ Calcular puntos de media
      const groupWithPlayers = await prisma.group.findUnique({
        where: { id: gp.group.id },
        include: { players: true },
      });
      if (!groupWithPlayers) {
        return NextResponse.json({ error: ERROR_MESSAGES[ComodinError.ROUND_NOT_FOUND] }, { status: 404 });
      }

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
        }
      }
      comodinPoints = round1(comodinPoints);

      // ✅ Aplicar comodín de media atómicamente
      const result = await applyMeanComodin(playerId, roundId, tournament, gp, comodinPoints);

      return NextResponse.json({
        success: true,
        mode,
        points: result.points,
        message: `Comodín (media) aplicado: ${result.points.toFixed(1)} puntos.`,
      });

    } else {
      // ✅ Modo sustituto con validaciones adicionales
      const { substitutePlayerId } = body as SubstituteBody;
      if (!substitutePlayerId) {
        return NextResponse.json({ error: ERROR_MESSAGES[ComodinError.INVALID_SUBSTITUTE] }, { status: 400 });
      }
      if (substitutePlayerId === playerId) {
        return NextResponse.json({ error: ERROR_MESSAGES[ComodinError.SUBSTITUTE_SELF] }, { status: 400 });
      }

      // Validar suplente
      const tpSub = await prisma.tournamentPlayer.findFirst({
        where: { playerId: substitutePlayerId, tournamentId: round.tournamentId },
        include: { player: { select: { name: true } } },
      });
      if (!tpSub) {
        return NextResponse.json({ error: ERROR_MESSAGES[ComodinError.SUBSTITUTE_NOT_IN_TOURNAMENT] }, { status: 400 });
      }

      if ((tpSub.comodinesUsed ?? 0) >= tournament.maxComodinesPerPlayer) {
        return NextResponse.json({ error: ERROR_MESSAGES[ComodinError.SUBSTITUTE_USED_COMODIN] }, { status: 400 });
      }

      const gpSub = await prisma.groupPlayer.findFirst({
        where: { playerId: substitutePlayerId, group: { roundId } },
        include: {
          group: { select: { id: true, number: true, level: true } },
          player: { select: { name: true } },
        },
      });
      if (!gpSub) {
        return NextResponse.json({ error: ERROR_MESSAGES[ComodinError.SUBSTITUTE_NOT_IN_ROUND] }, { status: 400 });
      }
      if (gpSub.usedComodin) {
        return NextResponse.json({ error: ERROR_MESSAGES[ComodinError.SUBSTITUTE_USED_COMODIN] }, { status: 400 });
      }

      // ✅ Validar reglas de niveles de grupo
      if (gp.group?.number == null || gp.group?.level == null || 
          gpSub.group?.number == null || gpSub.group?.level == null) {
        return NextResponse.json({ error: "No se pudo determinar número o nivel de grupo" }, { status: 400 });
      }

      const maxGroupLevel = await prisma.group.findFirst({
        where: { roundId },
        orderBy: { level: "desc" },
        select: { level: true },
      });
      const isLastGroup = !!maxGroupLevel && gp.group.level === maxGroupLevel.level;

      let isValidSubstitution = false;
      if (isLastGroup) {
        isValidSubstitution = gpSub.group.level === gp.group.level - 1;
      } else {
        isValidSubstitution = gpSub.group.level > gp.group.level;
      }

      if (!isValidSubstitution) {
        return NextResponse.json({ error: ERROR_MESSAGES[ComodinError.INVALID_GROUP_LEVEL] }, { status: 400 });
      }

      if ((tpSub.substituteAppearances ?? 0) >= (tournament.substituteMaxAppearances ?? 2)) {
        return NextResponse.json({ error: ERROR_MESSAGES[ComodinError.SUBSTITUTE_LIMIT_REACHED] }, { status: 409 });
      }

      // ✅ Aplicar comodín de sustituto atómicamente
      const result = await applySubstituteComodin(playerId, substitutePlayerId, tournament, gp, gpSub);

      return NextResponse.json({
        success: true,
        mode: "substitute",
        substitutePlayer: result.substitutePlayer,
        message: "Comodín (suplente) aplicado. El suplente jugará por ti; los puntos se te asignarán a ti.",
      });
    }

  } catch (error: any) {
    console.error("[COMODIN] error:", error);
    
    // ✅ Manejo específico de errores conocidos
    if (Object.values(ComodinError).includes(error.message)) {
      const errorMsg = ERROR_MESSAGES[error.message as ComodinError];
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}