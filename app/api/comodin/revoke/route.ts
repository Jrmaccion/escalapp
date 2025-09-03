// app/api/comodin/revoke/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const playerId = (session?.user as any)?.playerId as string | undefined;
    const isAdmin = (session?.user as any)?.isAdmin === true;
    
    if (!playerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { roundId } = body;
    
    if (!roundId) {
      return NextResponse.json({ error: "Falta roundId" }, { status: 400 });
    }

    // Obtener información de la ronda
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
                status: true
              }
            }
          }
        }
      }
    });

    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    if (round.isClosed) {
      return NextResponse.json({ 
        error: "No se puede revocar comodín en una ronda cerrada" 
      }, { status: 400 });
    }

    // Buscar el registro de comodín del jugador
    const groupPlayer = await prisma.groupPlayer.findFirst({
      where: {
        playerId,
        group: { roundId },
        usedComodin: true
      },
      include: {
        group: true
      }
    });

    if (!groupPlayer) {
      return NextResponse.json({ 
        error: "No has usado comodín en esta ronda" 
      }, { status: 400 });
    }

    // VALIDACIÓN: Regla de 24 horas antes del partido (solo si no es admin)
    if (!isAdmin) {
      const now = new Date();
      const twentyFourHoursFromNow = new Date(now.getTime() + (24 * 60 * 60 * 1000));

      // Buscar partidos del jugador con fechas confirmadas
      const upcomingMatches = round.groups
        .flatMap(group => group.matches)
        .filter(match => {
          return match.acceptedDate && new Date(match.acceptedDate) <= twentyFourHoursFromNow;
        });

      if (upcomingMatches.length > 0) {
        const nextMatch = upcomingMatches[0];
        const matchDate = new Date(nextMatch.acceptedDate!);
        
        return NextResponse.json({ 
          error: `No se puede revocar: hay partidos programados en menos de 24 horas (próximo: ${matchDate.toLocaleString('es-ES')})`,
          nextMatchDate: matchDate.toISOString()
        }, { status: 400 });
      }

      // También verificar si hay partidos ya en progreso o completados
      const activeMatches = round.groups
        .flatMap(group => group.matches)
        .filter(match => ['IN_PROGRESS', 'COMPLETED'].includes(match.status || ''));

      if (activeMatches.length > 0) {
        return NextResponse.json({ 
          error: "No se puede revocar: ya hay partidos en progreso o completados"
        }, { status: 400 });
      }
    }

    // Ejecutar revocación en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Obtener datos actuales para validación
      const currentGP = await tx.groupPlayer.findUnique({
        where: { id: groupPlayer.id },
        select: { 
          usedComodin: true, 
          substitutePlayerId: true,
          playerId: true,
          group: {
            select: {
              round: {
                select: { tournamentId: true }
              }
            }
          }
        }
      });

      if (!currentGP || !currentGP.usedComodin) {
        return { success: false, reason: 'COMODIN_NOT_USED' };
      }

      const substituteId = currentGP.substitutePlayerId;

      // 1. Restablecer el comodín del titular
      await tx.groupPlayer.update({
        where: { id: groupPlayer.id },
        data: {
          usedComodin: false,
          substitutePlayerId: null,
          comodinReason: null,
          comodinAt: null,
          points: 0 // Resetear puntos (se recalcularán cuando juegue)
        }
      });

      // 2. Restablecer contador de comodines en el torneo
      await tx.tournamentPlayer.update({
        where: {
          tournamentId_playerId: {
            tournamentId: currentGP.group.round.tournamentId,
            playerId: currentGP.playerId
          }
        },
        data: {
          comodinesUsed: { decrement: 1 }
        }
      });

      // 3. Si había un sustituto, restablecer sus apariciones
      if (substituteId) {
        await tx.tournamentPlayer.updateMany({
          where: {
            tournamentId: currentGP.group.round.tournamentId,
            playerId: substituteId
          },
          data: {
            substituteAppearances: { decrement: 1 }
          }
        });
      }

      return { success: true, substituteId };
    });

    if (!result.success) {
      const messages = {
        COMODIN_NOT_USED: "No se encontró comodín activo para revocar"
      };
      return NextResponse.json({ 
        error: messages[result.reason as keyof typeof messages] 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Comodín revocado exitosamente",
      details: {
        hadSubstitute: !!result.substituteId,
        substituteId: result.substituteId,
        revokedBy: isAdmin ? 'admin' : 'player'
      }
    });

  } catch (error) {
    console.error("[REVOKE_COMODIN] error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" }, 
      { status: 500 }
    );
  }
}

// Endpoint adicional para admins: revocar cualquier comodín
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isAdmin = (session?.user as any)?.isAdmin === true;
    
    if (!isAdmin) {
      return NextResponse.json({ error: "Solo admins pueden usar este endpoint" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get('roundId');
    const targetPlayerId = searchParams.get('playerId');
    
    if (!roundId || !targetPlayerId) {
      return NextResponse.json({ 
        error: "Faltan parámetros: roundId y playerId" 
      }, { status: 400 });
    }

    // Buscar y revocar comodín del jugador específico
    const groupPlayer = await prisma.groupPlayer.findFirst({
      where: {
        playerId: targetPlayerId,
        group: { roundId },
        usedComodin: true
      },
      include: {
        player: { select: { name: true } },
        group: {
          include: {
            round: { select: { tournamentId: true } }
          }
        }
      }
    });

    if (!groupPlayer) {
      return NextResponse.json({ 
        error: "El jugador no tiene comodín activo en esta ronda" 
      }, { status: 400 });
    }

    // Ejecutar revocación (mismo proceso que arriba)
    await prisma.$transaction(async (tx) => {
      const substituteId = groupPlayer.substitutePlayerId;

      // Restablecer comodín
      await tx.groupPlayer.update({
        where: { id: groupPlayer.id },
        data: {
          usedComodin: false,
          substitutePlayerId: null,
          comodinReason: null,
          comodinAt: null,
          points: 0
        }
      });

      // Restablecer contador de torneo
      await tx.tournamentPlayer.update({
        where: {
          tournamentId_playerId: {
            tournamentId: groupPlayer.group.round.tournamentId,
            playerId: targetPlayerId
          }
        },
        data: {
          comodinesUsed: { decrement: 1 }
        }
      });

      // Restablecer apariciones de sustituto si había
      if (substituteId) {
        await tx.tournamentPlayer.updateMany({
          where: {
            tournamentId: groupPlayer.group.round.tournamentId,
            playerId: substituteId
          },
          data: {
            substituteAppearances: { decrement: 1 }
          }
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Comodín de ${groupPlayer.player.name} revocado por admin`,
      playerName: groupPlayer.player.name
    });

  } catch (error) {
    console.error("[ADMIN_REVOKE_COMODIN] error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" }, 
      { status: 500 }
    );
  }
}