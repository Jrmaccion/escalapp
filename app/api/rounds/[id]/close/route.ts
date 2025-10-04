// app/api/rounds/[id]/close/route.ts - VERSIÓN COMPLETA CON DETECCIÓN DE GRUPOS SKIPPED
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TournamentEngine } from "@/lib/tournament-engine";
import { processContinuityStreaksForRound } from "@/lib/streak-calculator";
import { applyTechnicalPoints } from "@/lib/points-calculator";
import { GroupStatus } from "@prisma/client";

enum CloseRoundError {
  UNAUTHORIZED = "UNAUTHORIZED",
  ROUND_NOT_FOUND = "ROUND_NOT_FOUND",
  ROUND_ALREADY_CLOSED = "ROUND_ALREADY_CLOSED",
  TOURNAMENT_NOT_FOUND = "TOURNAMENT_NOT_FOUND",
  INCOMPLETE_MATCHES = "INCOMPLETE_MATCHES",
  CONTINUITY_PROCESSING_FAILED = "CONTINUITY_PROCESSING_FAILED",
  ENGINE_FAILURE = "ENGINE_FAILURE",
  ROLLBACK_TRIGGERED = "ROLLBACK_TRIGGERED"
}

const CLOSE_ERROR_MESSAGES = {
  [CloseRoundError.UNAUTHORIZED]: "No autorizado",
  [CloseRoundError.ROUND_NOT_FOUND]: "Ronda no encontrada",
  [CloseRoundError.ROUND_ALREADY_CLOSED]: "La ronda ya está cerrada",
  [CloseRoundError.TOURNAMENT_NOT_FOUND]: "Torneo no encontrado",
  [CloseRoundError.INCOMPLETE_MATCHES]: "Hay partidos sin completar en la ronda",
  [CloseRoundError.CONTINUITY_PROCESSING_FAILED]: "Error procesando rachas de continuidad",
  [CloseRoundError.ENGINE_FAILURE]: "Error crítico en el motor del torneo",
  [CloseRoundError.ROLLBACK_TRIGGERED]: "Operación revertida por error crítico"
} as const;

type ClosePayload = {
  generateNext?: boolean;
  groupSize?: number;
  forceClose?: boolean;
};

async function validateRoundForClosure(roundId: string): Promise<{
  round: any;
  incompleteMatches: number;
  tournamentConfig: any;
}> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { 
      tournament: { 
        select: { 
          id: true, 
          title: true,
          totalRounds: true,
          continuityEnabled: true,
          continuityPointsPerSet: true,
          continuityPointsPerRound: true,
          continuityMinRounds: true,
          continuityMaxBonus: true,
          continuityMode: true,
        } 
      },
      groups: {
        include: {
          matches: {
            select: {
              id: true,
              isConfirmed: true,
              team1Games: true,
              team2Games: true
            }
          }
        }
      }
    },
  });

  if (!round) {
    throw new Error(CloseRoundError.ROUND_NOT_FOUND);
  }

  if (!round.tournament) {
    throw new Error(CloseRoundError.TOURNAMENT_NOT_FOUND);
  }

  const allMatches = round.groups.flatMap(g => g.matches);
  const incompleteMatches = allMatches.filter(m => !m.isConfirmed).length;

  const tournamentConfig = {
    continuityEnabled: round.tournament.continuityEnabled,
    continuityPointsPerSet: round.tournament.continuityPointsPerSet,
    continuityPointsPerRound: round.tournament.continuityPointsPerRound,
    continuityMinRounds: round.tournament.continuityMinRounds,
    continuityMaxBonus: round.tournament.continuityMaxBonus,
    continuityMode: round.tournament.continuityMode as "SETS" | "MATCHES" | "BOTH",
  };

  return {
    round,
    incompleteMatches,
    tournamentConfig
  };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  console.log(`Iniciando cierre de ronda: ${params.id}`);
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ 
        error: CLOSE_ERROR_MESSAGES[CloseRoundError.UNAUTHORIZED] 
      }, { status: 403 });
    }

    const roundId = decodeURIComponent(params.id);

    let body: ClosePayload = {};
    try {
      body = (await req.json()) as ClosePayload;
    } catch {
      // Body vacío está OK
    }
    const { generateNext = true, forceClose = false } = body;

    const { round, incompleteMatches, tournamentConfig } = await validateRoundForClosure(roundId);

    console.log(`Ronda ${round.number}: ${incompleteMatches} partidos incompletos`);

    if (round.isClosed) {
      console.log(`Ronda ${round.number} ya estaba cerrada`);
      return NextResponse.json({
        success: true,
        message: "Ronda ya estaba cerrada",
        roundId: round.id,
        roundNumber: round.number,
        tournamentId: round.tournament.id,
        alreadyClosed: true,
        processingTimeMs: Date.now() - startTime
      });
    }

    // ======================================================================
    // DETECCIÓN Y MARCADO DE GRUPOS NO DISPUTADOS (SKIPPED)
    // ======================================================================
    console.log(`Detectando grupos no disputados...`);
    const groupsData = await prisma.group.findMany({
      where: { roundId },
      include: {
        matches: {
          select: { isConfirmed: true }
        },
        players: {
          select: { playerId: true }
        }
      }
    });

    const skippedGroups: string[] = [];
    const playedGroups: string[] = [];

    for (const group of groupsData) {
      const confirmedMatches = group.matches.filter(m => m.isConfirmed).length;
      
      if (confirmedMatches < 3) {
        // Grupo no tiene 3 sets confirmados → marcar como SKIPPED
        await prisma.group.update({
          where: { id: group.id },
          data: {
            status: GroupStatus.SKIPPED,
            skippedReason: 'NO_AGREEMENT'
          }
        });
        skippedGroups.push(group.id);
        console.log(`Grupo ${group.number} marcado como SKIPPED (${confirmedMatches}/3 sets confirmados)`);
      } else {
        // Grupo completo → marcar como PLAYED
        await prisma.group.update({
          where: { id: group.id },
          data: { status: GroupStatus.PLAYED }
        });
        playedGroups.push(group.id);
      }
    }

    console.log(`Detección completada: ${playedGroups.length} grupos jugados, ${skippedGroups.length} grupos no disputados`);

    // ======================================================================
    // APLICAR PUNTOS TÉCNICOS A GRUPOS SKIPPED
    // ======================================================================
    if (skippedGroups.length > 0) {
      console.log(`Aplicando puntos técnicos a ${skippedGroups.length} grupos...`);
      try {
        await applyTechnicalPoints(roundId, round.number);
        console.log(`Puntos técnicos aplicados correctamente`);
      } catch (technicalPointsError: any) {
        console.error(`Error aplicando puntos técnicos:`, technicalPointsError);
        if (!forceClose) {
          return NextResponse.json({
            error: "Error aplicando puntos técnicos a grupos no disputados",
            details: {
              message: technicalPointsError.message,
              skippedGroups: skippedGroups.length,
              suggestion: "Usa forceClose=true para continuar ignorando este error"
            }
          }, { status: 400 });
        }
      }
    }

    // ======================================================================
    // VERIFICAR SI DEBEMOS PERMITIR CIERRE CON GRUPOS SKIPPED
    // ======================================================================
    if (incompleteMatches > 0 && !forceClose && skippedGroups.length === 0) {
      // Solo bloqueamos si hay partidos incompletos Y no son grupos SKIPPED
      return NextResponse.json({
        error: CLOSE_ERROR_MESSAGES[CloseRoundError.INCOMPLETE_MATCHES],
        details: {
          incompleteMatches,
          totalMatches: round.groups.reduce((acc: number, g: any) => acc + g.matches.length, 0),
          suggestion: "Completa todos los partidos o usa forceClose=true"
        }
      }, { status: 400 });
    }

    // ======================================================================
    // PROCESAR RACHAS DE CONTINUIDAD
    // ======================================================================
    let continuityResult = "";
    if (tournamentConfig.continuityEnabled) {
      try {
        console.log(`Procesando rachas de continuidad...`);
        await processContinuityStreaksForRound(roundId, tournamentConfig);
        continuityResult = " - Rachas de continuidad aplicadas";
        console.log(`Rachas de continuidad procesadas`);
      } catch (continuityError: any) {
        console.error(`Error procesando rachas de continuidad:`, continuityError);
        
        if (!forceClose) {
          return NextResponse.json({
            error: CLOSE_ERROR_MESSAGES[CloseRoundError.CONTINUITY_PROCESSING_FAILED],
            details: {
              continuityError: continuityError.message,
              suggestion: "Revisa la configuración de continuidad o usa forceClose=true"
            }
          }, { status: 400 });
        }
        
        continuityResult = " - Error en rachas (forzando cierre)";
      }
    }

    // ======================================================================
    // USAR TOURNAMENT ENGINE PARA CIERRE Y GENERACIÓN
    // ======================================================================
    console.log(`Ejecutando cierre robusto con Tournament Engine...`);
    
    let engineResult;
    try {
      engineResult = await TournamentEngine.closeRoundAndGenerateNext(roundId);
    } catch (engineError: any) {
      console.error(`Error crítico en Tournament Engine:`, engineError);
      
      const rollbackCheck = await prisma.round.findUnique({
        where: { id: roundId },
        select: { isClosed: true }
      });
      
      const wasRolledBack = rollbackCheck && !rollbackCheck.isClosed;
      
      return NextResponse.json({
        error: wasRolledBack 
          ? CLOSE_ERROR_MESSAGES[CloseRoundError.ROLLBACK_TRIGGERED]
          : CLOSE_ERROR_MESSAGES[CloseRoundError.ENGINE_FAILURE],
        details: {
          engineError: engineError.message,
          rollbackExecuted: wasRolledBack,
          troubleshooting: "Revisa logs del servidor para más detalles"
        }
      }, { status: 500 });
    }

    const processingTimeMs = Date.now() - startTime;
    console.log(`Ronda ${round.number} cerrada exitosamente en ${processingTimeMs}ms`);

    // ======================================================================
    // RESPUESTA EXITOSA CON INFORMACIÓN DE GRUPOS SKIPPED
    // ======================================================================
    return NextResponse.json({
      success: true,
      message: `Ronda ${round.number} cerrada correctamente${continuityResult}`,
      roundId: round.id,
      roundNumber: round.number,
      tournamentId: round.tournament.id,
      nextRoundGenerated: engineResult.nextRoundGenerated,
      movements: engineResult.movements?.length || 0,
      substituteCredits: engineResult.substituteCredits?.length || 0,
      processingTimeMs,
      details: {
        incompleteMatchesIgnored: incompleteMatches,
        continuityProcessed: tournamentConfig.continuityEnabled,
        totalMovements: engineResult.movements?.length || 0,
        isLastRound: round.number >= round.tournament.totalRounds,
        skippedGroups: skippedGroups.length,
        playedGroups: playedGroups.length,
        technicalPointsApplied: skippedGroups.length > 0
      }
    });

  } catch (error: any) {
    const processingTimeMs = Date.now() - startTime;
    console.error(`Error general cerrando ronda:`, error);
    
    if (Object.values(CloseRoundError).includes(error.message)) {
      return NextResponse.json({
        error: CLOSE_ERROR_MESSAGES[error.message as CloseRoundError],
        processingTimeMs
      }, { status: 400 });
    }

    return NextResponse.json({
      error: "Error interno del servidor",
      details: {
        message: error.message,
        processingTimeMs,
        troubleshooting: "Contacta al administrador del sistema"
      }
    }, { status: 500 });
  }
}

// Endpoint GET para verificar estado de la ronda
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const roundId = decodeURIComponent(params.id);
    const { round, incompleteMatches } = await validateRoundForClosure(roundId);
    
    const allMatches = round.groups.flatMap((g: any) => g.matches);
    const totalMatches = allMatches.length;
    const completedMatches = totalMatches - incompleteMatches;

    // Contar grupos por estado
    const groupsByStatus = await prisma.group.groupBy({
      by: ['status'],
      where: { roundId },
      _count: true
    });

    const statusCounts = groupsByStatus.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      roundId: round.id,
      roundNumber: round.number,
      tournamentTitle: round.tournament.title,
      isClosed: round.isClosed,
      canClose: incompleteMatches === 0 || statusCounts[GroupStatus.SKIPPED] > 0,
      progress: {
        totalMatches,
        completedMatches,
        incompleteMatches,
        completionPercentage: totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
      },
      groups: {
        total: round.groups.length,
        played: statusCounts[GroupStatus.PLAYED] || 0,
        skipped: statusCounts[GroupStatus.SKIPPED] || 0,
        pending: statusCounts[GroupStatus.PENDING] || 0,
        postponed: statusCounts[GroupStatus.POSTPONED] || 0
      },
      continuityEnabled: round.tournament.continuityEnabled,
      isLastRound: round.number >= round.tournament.totalRounds
    });
  } catch (error: any) {
    console.error("Error getting round status:", error);
    return NextResponse.json({
      error: "Error obteniendo estado de la ronda"
    }, { status: 500 });
  }
}