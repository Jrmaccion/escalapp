// app/api/rounds/[id]/route.ts - GESTIÓN GENERAL DE RONDAS (CORREGIDO)
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PartyManager } from "@/lib/party-manager";
import { reopenRound } from "@/lib/round-reopen";

export const dynamic = 'force-dynamic';

// Función auxiliar para derivar estado del partido
function derivePartyStatus(matches: any[]): string {
  if (matches.length === 0) return "PENDING";
  
  const completedSets = matches.filter((m: any) => m.isConfirmed).length;
  if (completedSets === matches.length) return "COMPLETED";
  
  const firstMatch = matches[0];
  if (firstMatch.acceptedDate) return "SCHEDULED";
  if (firstMatch.proposedDate) return "DATE_PROPOSED";
  
  return "PENDING";
}

// GET /api/rounds/[id] - Obtener detalles completos de la ronda
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const roundId = params.id;
    
    // Obtener ronda con toda la información necesaria
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: {
          select: {
            id: true,
            title: true,
            totalRounds: true,
            roundDurationDays: true
          }
        },
        groups: {
          include: {
            players: {
              include: {
                player: {
                  select: { id: true, name: true }
                }
              },
              orderBy: { position: 'asc' }
            },
            matches: {
              select: {
                id: true,
                setNumber: true,
                team1Games: true,
                team2Games: true,
                tiebreakScore: true,
                isConfirmed: true,
                status: true,
                proposedDate: true,
                acceptedDate: true,
                acceptedBy: true
              },
              orderBy: { setNumber: 'asc' }
            }
          },
          orderBy: { number: 'asc' }
        }
      }
    });

    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    // Calcular estadísticas de partidos usando PartyManager
    const partyStats = await PartyManager.getRoundPartyStats(roundId);

    // Construir respuesta con información organizada
    const response = {
      round: {
        id: round.id,
        number: round.number,
        startDate: round.startDate,
        endDate: round.endDate,
        isClosed: round.isClosed,
        tournament: round.tournament
      },
      groups: round.groups.map(group => ({
        id: group.id,
        number: group.number,
        level: group.level,
        players: group.players.map(gp => ({
          id: gp.player.id,
          name: gp.player.name,
          position: gp.position,
          points: gp.points,
          streak: gp.streak,
          usedComodin: gp.usedComodin
        })),
        sets: group.matches.map(match => ({
          id: match.id,
          setNumber: match.setNumber,
          hasResult: match.team1Games !== null && match.team2Games !== null,
          isConfirmed: match.isConfirmed,
          status: match.status
        })),
        // Información del partido (abstracción)
        partySchedule: {
          status: derivePartyStatus(group.matches),
          proposedDate: group.matches[0]?.proposedDate,
          acceptedDate: group.matches[0]?.acceptedDate,
          acceptedCount: (group.matches[0]?.acceptedBy || []).length
        }
      })),
      stats: {
        totalGroups: round.groups.length,
        totalSets: round.groups.reduce((acc, g) => acc + g.matches.length, 0),
        completedSets: round.groups.reduce((acc, g) => 
          acc + g.matches.filter(m => m.isConfirmed).length, 0
        ),
        ...partyStats
      }
    };

    return NextResponse.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error("Error fetching round:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PATCH /api/rounds/[id] - Actualizar propiedades de la ronda
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Solo admins pueden modificar rondas" }, { status: 403 });
    }

    const body = await request.json();
    const { startDate, endDate, isClosed } = body;
    const roundId = params.id;

    // Validaciones básicas
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      return NextResponse.json(
        { error: "Fecha de inicio debe ser anterior a fecha de fin" },
        { status: 400 }
      );
    }

    // CASO ESPECIAL: Reabrir ronda cerrada (requiere cleanup)
    if (typeof isClosed === 'boolean' && isClosed === false) {
      // Verificar si la ronda está actualmente cerrada
      const currentRound = await prisma.round.findUnique({
        where: { id: roundId },
        select: { isClosed: true, number: true }
      });

      if (currentRound && currentRound.isClosed) {
        // Usar la función especializada de reapertura con cleanup
        try {
          const reopenResult = await reopenRound(roundId);

          return NextResponse.json({
            success: true,
            message: reopenResult.message,
            cleanup: reopenResult.cleanup,
            round: await prisma.round.findUnique({
              where: { id: roundId },
              include: {
                tournament: { select: { id: true, title: true } }
              }
            })
          });
        } catch (reopenError: any) {
          console.error("Error reabriendo ronda:", reopenError);
          return NextResponse.json(
            { error: reopenError.message || "Error al reabrir ronda" },
            { status: 500 }
          );
        }
      }
    }

    // CASO NORMAL: Actualizar fechas u otras propiedades
    const updateData: any = {};
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (typeof isClosed === 'boolean') updateData.isClosed = isClosed;

    // Actualizar ronda
    const updatedRound = await prisma.round.update({
      where: { id: roundId },
      data: updateData,
      include: {
        tournament: { select: { id: true, title: true } }
      }
    });

    return NextResponse.json({
      success: true,
      message: "Ronda actualizada correctamente",
      round: updatedRound
    });

  } catch (error) {
    console.error("Error updating round:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/rounds/[id] - Eliminar ronda (solo si no tiene datos)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Solo admins pueden eliminar rondas" }, { status: 403 });
    }

    const roundId = params.id;

    // Verificar que la ronda no tenga datos críticos
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        groups: {
          include: {
            matches: { select: { id: true, isConfirmed: true } }
          }
        }
      }
    });

    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    // No permitir eliminar si tiene partidos confirmados
    const hasConfirmedMatches = round.groups.some(group =>
      group.matches.some(match => match.isConfirmed)
    );

    if (hasConfirmedMatches) {
      return NextResponse.json(
        { error: "No se puede eliminar una ronda con partidos confirmados" },
        { status: 400 }
      );
    }

    if (round.isClosed) {
      return NextResponse.json(
        { error: "No se puede eliminar una ronda cerrada" },
        { status: 400 }
      );
    }

    // Eliminar en cascada: matches -> groupPlayers -> groups -> round
    await prisma.$transaction(async (tx) => {
      // Eliminar matches
      for (const group of round.groups) {
        await tx.match.deleteMany({
          where: { groupId: group.id }
        });
      }

      // Eliminar group players
      for (const group of round.groups) {
        await tx.groupPlayer.deleteMany({
          where: { groupId: group.id }
        });
      }

      // Eliminar groups
      await tx.group.deleteMany({
        where: { roundId }
      });

      // Eliminar round
      await tx.round.delete({
        where: { id: roundId }
      });
    });

    return NextResponse.json({
      success: true,
      message: "Ronda eliminada correctamente"
    });

  } catch (error) {
    console.error("Error deleting round:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}