// app/api/comodin/eligible-substitutes/route.ts
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

    // Verificar que la ronda existe y no está cerrada
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { tournament: true },
    });

    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    if (round.isClosed) {
      return NextResponse.json({ error: "No se puede usar comodín en una ronda cerrada" }, { status: 400 });
    }

    // Obtener grupo actual del solicitante
    const playerGroup = await prisma.groupPlayer.findFirst({
      where: { 
        playerId, 
        group: { roundId } 
      },
      include: { 
        group: { 
          select: { id: true, number: true, level: true } 
        } 
      },
    });

    if (!playerGroup) {
      return NextResponse.json({ 
        error: "No estás asignado a un grupo en esta ronda" 
      }, { status: 400 });
    }

    // Si ya usó comodín, no puede usar otro
    if (playerGroup.usedComodin) {
      return NextResponse.json({ 
        players: [],
        message: "Ya has usado comodín en esta ronda" 
      });
    }

    const currentGroupLevel = playerGroup.group.level;

    // Buscar jugadores elegibles como sustitutos
    const eligiblePlayers = await prisma.groupPlayer.findMany({
      where: {
        group: {
          roundId,
          level: { gt: currentGroupLevel } // Grupos de nivel inferior (número mayor)
        },
        usedComodin: false, // No puede haber usado comodín
        substitutePlayerId: null, // No puede estar ya siendo sustituto
        player: {
          tournaments: {
            some: {
              tournamentId: round.tournamentId,
              comodinesUsed: { lt: 1 }, // No puede haber usado su comodín
              substituteAppearances: { 
                lt: round.tournament.substituteMaxAppearances 
              } // No puede haber alcanzado el límite de apariciones
            }
          }
        }
      },
      include: {
        player: {
          select: { id: true, name: true }
        },
        group: {
          select: { number: true, level: true }
        }
      },
      orderBy: [
        { group: { level: 'asc' } }, // Priorizar grupos más cercanos
        { points: 'desc' } // Luego por mejores jugadores
      ]
    });

    // Verificar que no estén ya actuando como sustitutos de otros
    const alreadySubstituting = await prisma.groupPlayer.findMany({
      where: {
        group: { roundId },
        substitutePlayerId: {
          in: eligiblePlayers.map(p => p.playerId)
        }
      },
      select: { substitutePlayerId: true }
    });

    const alreadySubstitutingSet = new Set(
      alreadySubstituting.map(s => s.substitutePlayerId).filter(Boolean)
    );

    // Filtrar jugadores que ya están sustituyendo
    const availablePlayers = eligiblePlayers.filter(
      p => !alreadySubstitutingSet.has(p.playerId)
    );

    // Formatear respuesta
    const players = availablePlayers.map(p => ({
      playerId: p.player.id,
      name: p.player.name,
      groupNumber: p.group.number,
      groupLevel: p.group.level,
      points: p.points || 0
    }));

    return NextResponse.json({
      success: true,
      players,
      currentGroup: {
        number: playerGroup.group.number,
        level: currentGroupLevel
      },
      message: players.length > 0 
        ? `${players.length} jugadores disponibles como sustitutos`
        : "No hay jugadores disponibles como sustitutos"
    });

  } catch (error) {
    console.error("[ELIGIBLE_SUBSTITUTES] error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" }, 
      { status: 500 }
    );
  }
}