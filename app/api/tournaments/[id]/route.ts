// app/api/tournaments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournamentId = params.id;

    // 1. Verificar que el torneo existe
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        rounds: {
          include: {
            groups: {
              include: {
                matches: true,
                _count: {
                  select: { matches: true }
                }
              }
            }
          }
        },
        players: true,
        _count: {
          select: {
            rounds: true,
            players: true
          }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    // 2. Validaciones de seguridad mejoradas
    if (tournament.isActive) {
      return NextResponse.json(
        { error: "No se puede eliminar un torneo activo. Desactívalo primero." }, 
        { status: 409 }
      );
    }

    // 3. Verificar si hay partidos jugados (datos importantes)
    const totalMatches = tournament.rounds.reduce((acc: number, round: any) => 
      acc + round.groups.reduce((groupAcc: number, group: any) => 
        groupAcc + group.matches.filter((match: any) => match.isConfirmed).length, 0
      ), 0
    );

    if (totalMatches > 0) {
      return NextResponse.json({
        error: "Este torneo tiene partidos confirmados. La eliminación destruiría datos históricos importantes.",
        details: {
          confirmedMatches: totalMatches,
          rounds: tournament._count.rounds,
          players: tournament._count.players
        }
      }, { status: 409 });
    }

    // 4. Eliminación completa en transacción
    await prisma.$transaction(async (tx: any) => {
      // Eliminar rankings primero (no tienen onDelete cascade)
      await tx.ranking.deleteMany({
        where: { tournamentId }
      });

      // Eliminar results de matches (por si acaso)
      const matchIds = tournament.rounds.flatMap((r: any) => 
        r.groups.flatMap((g: any) => g.matches.map((m: any) => m.id))
      );
      
      if (matchIds.length > 0) {
        await tx.matchResult.deleteMany({
          where: { matchId: { in: matchIds } }
        });
      }

      // El resto debería eliminarse en cascada automáticamente
      // Pero por seguridad, eliminamos explícitamente:
      
      // Matches (y sus results)
      await tx.match.deleteMany({
        where: {
          group: {
            round: { tournamentId }
          }
        }
      });

      // GroupPlayers  
      await tx.groupPlayer.deleteMany({
        where: {
          group: {
            round: { tournamentId }
          }
        }
      });

      // Groups
      await tx.group.deleteMany({
        where: {
          round: { tournamentId }
        }
      });

      // Rounds
      await tx.round.deleteMany({
        where: { tournamentId }
      });

      // TournamentPlayers
      await tx.tournamentPlayer.deleteMany({
        where: { tournamentId }
      });

      // Finalmente, el torneo
      await tx.tournament.delete({
        where: { id: tournamentId }
      });
    });

    return NextResponse.json({ 
      success: true, 
      message: "Torneo eliminado correctamente",
      deleted: {
        matches: totalMatches,
        rounds: tournament._count.rounds,
        players: tournament._count.players
      }
    });

  } catch (error: any) {
    console.error("Error deleting tournament:", error);
    
    // Manejar errores específicos de Prisma
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    if (error.code === 'P2003') {
      return NextResponse.json({ 
        error: "No se puede eliminar: existen dependencias que lo impiden" 
      }, { status: 409 });
    }

    return NextResponse.json({ 
      error: "Error interno del servidor",
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
      include: {
        rounds: {
          include: {
            groups: {
              include: {
                players: {
                  include: {
                    player: true
                  }
                },
                matches: true
              }
            }
          }
        },
        players: {
          include: {
            player: true
          }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    return NextResponse.json(tournament);
  } catch (error) {
    console.error("Error getting tournament:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}