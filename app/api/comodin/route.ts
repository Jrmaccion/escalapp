// app/api/comodin/route.ts - VERSIÓN COMPLETA CON VALIDACIONES TEMPORALES
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
      include: { 
        tournament: true,
        groups: {
          include: {
            matches: {
              where: {
                OR: [
                  { team1Player1Id: playerId },
                  { team1Player2Id: playerId },
                  { team2Player1Id: playerId },
                  { team2Player2Id: playerId }
                ]
              },
              select: {
                id: true,
                proposedDate: true,
                acceptedDate: true,
                status: true,
                isConfirmed: true
              }
            }
          }
        }
      },
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

    // NUEVA VALIDACIÓN: Verificar si hay partidos confirmados o en menos de 24h
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    
    const playerMatches = round.groups
      .flatMap(group => group.matches)
      .filter(match => match !== null);
    
    // Verificar partidos ya confirmados (con resultados)
    const confirmedMatches = playerMatches.filter(match => match.isConfirmed);
    if (confirmedMatches.length > 0) {
      return NextResponse.json({ 
        error: "No se puede usar comodín: ya tienes partidos con resultados confirmados en esta ronda" 
      }, { status: 400 });
    }

    // Verificar partidos programados en menos de 24h
    const upcomingMatches = playerMatches.filter(match => 
      match.acceptedDate && new Date(match.acceptedDate) <= twentyFourHoursFromNow
    );
    
    if (upcomingMatches.length > 0) {
      const nextMatch = upcomingMatches[0];
      const matchDate = new Date(nextMatch.acceptedDate!);
      return NextResponse.json({ 
        error: `No se puede usar comodín: tienes partidos programados en menos de 24 horas (próximo: ${matchDate.toLocaleString('es-ES')})`,
        nextMatchDate: matchDate.toISOString()
      }, { status: 400 });
    }

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
          data: { 
            usedComodin: true, 
            points: comodinPoints,
            comodinReason: `Comodín (media): ${comodinPoints.toFixed(1)} puntos`,
            comodinAt: new Date()
          },
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

    // Verificar que el suplente existe y está inscrito en el torneo
    const tpSub = await prisma.tournamentPlayer.findFirst({
      where: { playerId: substitutePlayerId, tournamentId: round.tournamentId },
      include: { 
        player: { select: { name: true } }
      }
    });
    if (!tpSub) {
      return NextResponse.json({ error: "El suplente no está inscrito en este torneo" }, { status: 400 });
    }

    // Validación: El suplente no puede haber usado ya su comodín
    if ((tpSub.comodinesUsed ?? 0) >= 1) {
      return NextResponse.json({ 
        error: `${tpSub.player.name} ya ha usado su comodín en este torneo y no puede ser suplente` 
      }, { status: 400 });
    }

    // Suplente debe estar en la misma ronda, en grupo inferior (número mayor)
    const gpSub = await prisma.groupPlayer.findFirst({
      where: { playerId: substitutePlayerId, group: { roundId } },
      include: { 
        group: { select: { number: true, round: { select: { tournamentId: true } } } },
        player: { select: { name: true } }
      },
    });
    if (!gpSub) {
      return NextResponse.json({ error: "El suplente debe estar en esta misma ronda" }, { status: 400 });
    }
    
    // Validación: El suplente no puede haber usado comodín en esta ronda
    if (gpSub.usedComodin) {
      return NextResponse.json({ 
        error: `${gpSub.player.name} ya ha usado comodín en esta ronda y no puede ser suplente` 
      }, { status: 400 });
    }

    if (!gp.group?.number || !gpSub.group?.number) {
      return NextResponse.json({ error: "No se pudo determinar el número de grupo" }, { status: 400 });
    }
    if (!(gpSub.group.number > gp.group.number)) {
      return NextResponse.json({ 
        error: `El suplente debe provenir de un grupo inferior. ${gpSub.player.name} está en grupo ${gpSub.group.number}, tú estás en grupo ${gp.group.number}` 
      }, { status: 400 });
    }

    // Config del torneo (factor y máximo de apariciones)
    const tcfg = await prisma.tournament.findUnique({
      where: { id: round.tournamentId },
      select: { substituteCreditFactor: true, substituteMaxAppearances: true },
    });

    // Evitar que el suplente ya esté actuando como suplente de otro en esta ronda
    const alreadySubbing = await prisma.groupPlayer.findFirst({
      where: { 
        group: { roundId }, 
        substitutePlayerId 
      },
      include: { 
        player: { select: { name: true } } 
      }
    });
    if (alreadySubbing) {
      return NextResponse.json({ 
        error: `${gpSub.player.name} ya actúa como suplente de ${alreadySubbing.player.name} en esta ronda` 
      }, { status: 409 });
    }

    // Verificar límite de apariciones del suplente
    const maxApp = tcfg?.substituteMaxAppearances ?? 2;
    if ((tpSub.substituteAppearances ?? 0) >= maxApp) {
      return NextResponse.json({ 
        error: `${tpSub.player.name} ha alcanzado el límite de ${maxApp} apariciones como suplente en este torneo` 
      }, { status: 409 });
    }

    // TX: marcar comodín + registrar suplente + limitar apariciones
    const subResult = await prisma.$transaction(async (tx) => {
      // Revalidar datos en transacción
      const tpNow = await tx.tournamentPlayer.findUnique({
        where: { tournamentId_playerId: { tournamentId: round.tournamentId, playerId } },
        select: { comodinesUsed: true },
      });
      if (!tpNow || (tpNow.comodinesUsed ?? 0) >= 1) {
        return { ok: false as const, reason: "COMODIN_ALREADY_USED_TOURNAMENT" as const };
      }

      const tpSubNow = await tx.tournamentPlayer.findUnique({
        where: { tournamentId_playerId: { tournamentId: round.tournamentId, playerId: substitutePlayerId } },
        select: { substituteAppearances: true, comodinesUsed: true },
      });
      if (!tpSubNow) {
        return { ok: false as const, reason: "SUB_NOT_IN_TOURNAMENT" as const };
      }
      if ((tpSubNow.substituteAppearances ?? 0) >= maxApp) {
        return { ok: false as const, reason: "SUB_LIMIT_REACHED" as const };
      }
      if ((tpSubNow.comodinesUsed ?? 0) >= 1) {
        return { ok: false as const, reason: "SUB_USED_COMODIN" as const };
      }

      const gpNow = await tx.groupPlayer.findUnique({
        where: { id: gp.id },
        select: { usedComodin: true, substitutePlayerId: true },
      });
      if (!gpNow || gpNow.usedComodin || gpNow.substitutePlayerId) {
        return { ok: false as const, reason: "COMODIN_ALREADY_USED_ROUND" as const };
      }

      const gpSubNow = await tx.groupPlayer.findUnique({
        where: { id: gpSub.id },
        select: { usedComodin: true },
      });
      if (!gpSubNow || gpSubNow.usedComodin) {
        return { ok: false as const, reason: "SUB_USED_COMODIN_ROUND" as const };
      }

      // Actualizar datos del titular
      await tx.groupPlayer.update({
        where: { id: gp.id },
        data: {
          usedComodin: true,
          substitutePlayerId, // marcador de suplente
          comodinReason: `Suplente: ${gpSub.player.name}`,
          comodinAt: new Date(),
          points: 0 // Se asignarán cuando el suplente juegue
        },
      });

      // Contar comodín del titular
      await tx.tournamentPlayer.update({
        where: { tournamentId_playerId: { tournamentId: round.tournamentId, playerId } },
        data: { comodinesUsed: { increment: 1 } },
      });

      // Incrementar apariciones del suplente
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
        SUB_USED_COMODIN: "El suplente ya usó su comodín y no puede actuar como suplente",
        SUB_USED_COMODIN_ROUND: "El suplente ya usó comodín en esta ronda",
      } as const;
      return NextResponse.json({ error: map[subResult.reason] }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      mode: "substitute",
      substitutePlayer: gpSub.player.name,
      message: `Comodín (suplente) aplicado. ${gpSub.player.name} jugará por ti; los puntos se te asignarán a ti. El suplente recibirá crédito Ironman.`,
    });
  } catch (error) {
    console.error("[COMODIN] error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// GET: Obtener estado actual del comodín
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const playerId = (session?.user as any)?.playerId as string | undefined;
    
    if (!playerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get('roundId');
    
    if (!roundId) {
      return NextResponse.json({ error: "Falta roundId" }, { status: 400 });
    }

    // Obtener estado actual del comodín
    const groupPlayer = await prisma.groupPlayer.findFirst({
      where: {
        playerId,
        group: { roundId }
      },
      include: {
        group: {
          include: {
            round: {
              include: {
                tournament: true
              }
            },
            matches: {
              where: {
                OR: [
                  { team1Player1Id: playerId },
                  { team1Player2Id: playerId },
                  { team2Player1Id: playerId },
                  { team2Player2Id: playerId }
                ]
              },
              select: {
                proposedDate: true,
                acceptedDate: true,
                status: true,
                isConfirmed: true
              }
            }
          }
        }
      }
    });

    if (!groupPlayer) {
      return NextResponse.json({
        success: false,
        used: false,
        canUse: false,
        restrictionReason: "No estás asignado a un grupo en esta ronda"
      });
    }

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + (24 * 60 * 60 * 1000));

    // Verificar si puede revocar (dentro de 24h de partidos programados)
    const upcomingMatches = groupPlayer.group.matches.filter(match => 
      match.acceptedDate && new Date(match.acceptedDate) <= twentyFourHoursFromNow
    );
    
    const confirmedMatches = groupPlayer.group.matches.filter(match => match.isConfirmed);
    
    const canRevoke = groupPlayer.usedComodin && 
      upcomingMatches.length === 0 && 
      confirmedMatches.length === 0 &&
      !groupPlayer.group.round.isClosed;

    if (groupPlayer.usedComodin) {
      // Ya tiene comodín aplicado
      const substitutePlayer = groupPlayer.substitutePlayerId ? 
        await prisma.player.findUnique({
          where: { id: groupPlayer.substitutePlayerId },
          select: { name: true }
        }) : null;

      return NextResponse.json({
        success: true,
        used: true,
        mode: groupPlayer.substitutePlayerId ? 'substitute' : 'mean',
        substitutePlayer: substitutePlayer?.name,
        points: groupPlayer.points,
        canRevoke,
        reason: groupPlayer.comodinReason || 'Comodín aplicado',
        appliedAt: groupPlayer.comodinAt,
        restrictions: {
          hasConfirmedMatches: confirmedMatches.length > 0,
          hasUpcomingMatches: upcomingMatches.length > 0,
          roundClosed: groupPlayer.group.round.isClosed,
          nextMatchDate: upcomingMatches.length > 0 ? upcomingMatches[0].acceptedDate : null
        }
      });
    }

    // No tiene comodín - determinar si puede usar uno
    const tournamentPlayer = await prisma.tournamentPlayer.findFirst({
      where: {
        playerId,
        tournamentId: groupPlayer.group.round.tournamentId
      }
    });

    const canUse = !groupPlayer.group.round.isClosed &&
      (tournamentPlayer?.comodinesUsed ?? 0) < 1 &&
      upcomingMatches.length === 0 &&
      confirmedMatches.length === 0;

    // Determinar razón por la que no puede usar comodín
    let restrictionReason = "";
    if (groupPlayer.group.round.isClosed) {
      restrictionReason = "La ronda está cerrada";
    } else if ((tournamentPlayer?.comodinesUsed ?? 0) >= 1) {
      restrictionReason = "Ya has usado tu comodín en este torneo";
    } else if (confirmedMatches.length > 0) {
      restrictionReason = "Ya tienes partidos con resultados confirmados";
    } else if (upcomingMatches.length > 0) {
      const nextMatch = upcomingMatches[0];
      const matchDate = new Date(nextMatch.acceptedDate!);
      restrictionReason = `Tienes partidos programados en menos de 24 horas (${matchDate.toLocaleString('es-ES')})`;
    }

    return NextResponse.json({
      success: true,
      used: false,
      canUse,
      restrictionReason,
      tournamentInfo: {
        comodinesUsed: tournamentPlayer?.comodinesUsed ?? 0,
        maxComodines: 1,
        comodinesRemaining: 1 - (tournamentPlayer?.comodinesUsed ?? 0)
      },
      groupInfo: {
        groupNumber: groupPlayer.group.number,
        points: groupPlayer.points || 0
      },
      restrictions: {
        hasConfirmedMatches: confirmedMatches.length > 0,
        hasUpcomingMatches: upcomingMatches.length > 0,
        roundClosed: groupPlayer.group.round.isClosed,
        nextMatchDate: upcomingMatches.length > 0 ? upcomingMatches[0].acceptedDate : null
      }
    });

  } catch (error) {
    console.error("[GET_COMODIN_STATUS] error:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Error interno del servidor" 
    }, { status: 500 });
  }
}