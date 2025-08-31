// app/api/tournaments/[id]/delete-info/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournamentId = params.id;

    // Obtener información detallada para evaluar el impacto de la eliminación
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: {
          select: {
            rounds: true,
            players: true
          }
        },
        rounds: {
          include: {
            _count: {
              select: {
                groups: true
              }
            },
            groups: {
              include: {
                _count: {
                  select: {
                    matches: true,
                    players: true
                  }
                },
                matches: {
                  select: {
                    id: true,
                    isConfirmed: true,
                    team1Games: true,
                    team2Games: true,
                    reportedById: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    // Calcular estadísticas de impacto
    const stats = {
      canDelete: !tournament.isActive,
      isActive: tournament.isActive,
      totalPlayers: tournament._count.players,
      totalRounds: tournament._count.rounds,
      totalGroups: tournament.rounds.reduce((acc, round) => acc + round._count.groups, 0),
      totalMatches: tournament.rounds.reduce((acc, round) => 
        acc + round.groups.reduce((groupAcc, group) => 
          groupAcc + group._count.matches, 0
        ), 0
      ),
      confirmedMatches: tournament.rounds.reduce((acc, round) => 
        acc + round.groups.reduce((groupAcc, group) => 
          groupAcc + group.matches.filter(match => match.isConfirmed).length, 0
        ), 0
      ),
      pendingMatches: tournament.rounds.reduce((acc, round) => 
        acc + round.groups.reduce((groupAcc, group) => 
          groupAcc + group.matches.filter(match => !match.isConfirmed).length, 0
        ), 0
      ),
      playedMatches: tournament.rounds.reduce((acc, round) => 
        acc + round.groups.reduce((groupAcc, group) => 
          groupAcc + group.matches.filter(match => 
            match.team1Games !== null && match.team2Games !== null
          ).length, 0
        ), 0
      ),
      hasImportantData: false // se calculará abajo
    };

    stats.hasImportantData = stats.confirmedMatches > 0 || stats.playedMatches > 0;

    // Razones por las que no se puede eliminar
    const blockingReasons = [];
    if (tournament.isActive) {
      blockingReasons.push("El torneo está activo");
    }

    // Warnings (no bloquean, pero alertan)
    const warnings = [];
    if (stats.confirmedMatches > 0) {
      warnings.push(`Eliminará ${stats.confirmedMatches} resultados confirmados`);
    }
    if (stats.totalPlayers > 0) {
      warnings.push(`Eliminará inscripciones de ${stats.totalPlayers} jugadores`);
    }
    if (stats.totalRounds > 1) {
      warnings.push(`Eliminará ${stats.totalRounds} rondas con toda su configuración`);
    }

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        title: tournament.title,
        isActive: tournament.isActive,
        createdAt: tournament.createdAt
      },
      stats,
      blockingReasons,
      warnings,
      canDelete: blockingReasons.length === 0,
      impact: stats.hasImportantData ? 'high' : stats.totalPlayers > 0 ? 'medium' : 'low'
    });

  } catch (error: any) {
    console.error("Error getting tournament delete info:", error);
    return NextResponse.json({ 
      error: "Error interno del servidor" 
    }, { status: 500 });
  }
}