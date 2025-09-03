// app/api/comodin/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

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

    // Obtener información completa del jugador en esta ronda
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
                id: true,
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
        error: "No estás asignado a un grupo en esta ronda"
      });
    }

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + (24 * 60 * 60 * 1000));

    // Analizar estado de partidos
    const confirmedMatches = groupPlayer.group.matches.filter(match => match.isConfirmed);
    const upcomingMatches = groupPlayer.group.matches.filter(match => 
      match.acceptedDate && new Date(match.acceptedDate) <= twentyFourHoursFromNow
    );

    // Obtener información del torneo
    const tournamentPlayer = await prisma.tournamentPlayer.findFirst({
      where: {
        playerId,
        tournamentId: groupPlayer.group.round.tournamentId
      }
    });

    // Determinar si puede revocar
    const canRevoke = groupPlayer.usedComodin && 
      upcomingMatches.length === 0 && 
      confirmedMatches.length === 0 &&
      !groupPlayer.group.round.isClosed;

    // Si ya tiene comodín aplicado
    if (groupPlayer.usedComodin) {
      let substitutePlayer = null;
      if (groupPlayer.substitutePlayerId) {
        const substitute = await prisma.player.findUnique({
          where: { id: groupPlayer.substitutePlayerId },
          select: { name: true }
        });
        substitutePlayer = substitute?.name;
      }

      return NextResponse.json({
        success: true,
        used: true,
        mode: groupPlayer.substitutePlayerId ? 'substitute' : 'mean',
        substitutePlayer,
        points: groupPlayer.points || 0,
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
    const comodinesUsed = tournamentPlayer?.comodinesUsed || 0;
    const maxComodines = 1; // Límite por torneo

    const canUse = !groupPlayer.group.round.isClosed &&
      comodinesUsed < maxComodines &&
      upcomingMatches.length === 0 &&
      confirmedMatches.length === 0;

    // Determinar razón por la que no puede usar comodín
    let restrictionReason = "";
    if (groupPlayer.group.round.isClosed) {
      restrictionReason = "La ronda está cerrada";
    } else if (comodinesUsed >= maxComodines) {
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
        comodinesUsed,
        maxComodines,
        comodinesRemaining: maxComodines - comodinesUsed
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
    console.error("[COMODIN_STATUS] error:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" }, 
      { status: 500 }
    );
  }
}