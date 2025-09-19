// app/api/tournaments/[id]/overview/route.ts - OPTIMIZADA
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// Tipos para el response
type PlayerInGroup = {
  playerId: string;
  name: string;
  position: number;
  points: number;
  streak: number;
  setsWon: number;
  gamesWon: number;
  gamesLost: number;
  h2hWins: number;
  isCurrentUser: boolean;
  movement: {
    type: 'up' | 'down' | 'same';
    groups: number;
    description: string;
  };
};

type GroupOverview = {
  groupId: string;
  groupNumber: number;
  level: number;
  players: PlayerInGroup[];
  scheduleStatus: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED";
  scheduledDate: string | null;
  completedSets: number;
  totalSets: number;
  needsAction: boolean;
  completionPercentage: number;
};

// Función para calcular head-to-head
function calculateH2H(playerId: string, matches: any[]): number {
  let h2hWins = 0;
  
  for (const match of matches) {
    if (!match.isConfirmed) continue;
    
    const isInTeam1 = [match.team1Player1Id, match.team1Player2Id].includes(playerId);
    const isInTeam2 = [match.team2Player1Id, match.team2Player2Id].includes(playerId);
    
    if (isInTeam1 && (match.team1Games || 0) > (match.team2Games || 0)) {
      h2hWins++;
    } else if (isInTeam2 && (match.team2Games || 0) > (match.team1Games || 0)) {
      h2hWins++;
    }
  }
  
  return h2hWins;
}

// Función para calcular sets y juegos ganados/perdidos
function calculatePlayerStats(playerId: string, matches: any[]) {
  let setsWon = 0;
  let gamesWon = 0;
  let gamesLost = 0;
  
  for (const match of matches) {
    if (!match.isConfirmed) continue;
    
    const isInTeam1 = [match.team1Player1Id, match.team1Player2Id].includes(playerId);
    const isInTeam2 = [match.team2Player1Id, match.team2Player2Id].includes(playerId);
    
    if (isInTeam1) {
      gamesWon += match.team1Games || 0;
      gamesLost += match.team2Games || 0;
      if ((match.team1Games || 0) > (match.team2Games || 0)) {
        setsWon++;
      }
    } else if (isInTeam2) {
      gamesWon += match.team2Games || 0;
      gamesLost += match.team1Games || 0;
      if ((match.team2Games || 0) > (match.team1Games || 0)) {
        setsWon++;
      }
    }
  }
  
  return { setsWon, gamesWon, gamesLost };
}

// Función para determinar movimiento de escalera
function calculateMovement(position: number, groupLevel: number, totalGroups: number) {
  const isTopGroup = groupLevel === 1;
  const isBottomGroup = groupLevel === totalGroups;
  const isSecondGroup = groupLevel === 2;
  const isPenultimateGroup = groupLevel === totalGroups - 1;
  
  switch (position) {
    case 1: // Primer lugar
      if (isTopGroup) {
        return { type: 'same' as const, groups: 0, description: 'Se mantiene en grupo élite' };
      } else if (isSecondGroup) {
        return { type: 'up' as const, groups: 1, description: 'Sube al grupo élite' };
      } else {
        return { type: 'up' as const, groups: 2, description: 'Sube 2 grupos' };
      }
    
    case 2: // Segundo lugar
      if (isTopGroup) {
        return { type: 'same' as const, groups: 0, description: 'Se mantiene en grupo élite' };
      } else {
        return { type: 'up' as const, groups: 1, description: 'Sube 1 grupo' };
      }
    
    case 3: // Tercer lugar
      if (isBottomGroup) {
        return { type: 'same' as const, groups: 0, description: 'Se mantiene en grupo inferior' };
      } else {
        return { type: 'down' as const, groups: 1, description: 'Baja 1 grupo' };
      }
    
    case 4: // Cuarto lugar
      if (isBottomGroup) {
        return { type: 'same' as const, groups: 0, description: 'Se mantiene en grupo inferior' };
      } else if (isPenultimateGroup) {
        return { type: 'down' as const, groups: 1, description: 'Baja al grupo inferior' };
      } else {
        return { type: 'down' as const, groups: 2, description: 'Baja 2 grupos' };
      }
    
    default:
      return { type: 'same' as const, groups: 0, description: 'Se mantiene' };
  }
}

// Función de comparación para ordenar jugadores (con desempates)
function comparePlayersWithTiebreakers(
  a: { points: number; setsWon: number; gamesWon: number; gamesLost: number; h2hWins: number },
  b: { points: number; setsWon: number; gamesWon: number; gamesLost: number; h2hWins: number }
) {
  // 1. Puntos (descendente)
  if (a.points !== b.points) return b.points - a.points;
  
  // 2. Sets ganados (descendente)
  if (a.setsWon !== b.setsWon) return b.setsWon - a.setsWon;
  
  // 3. Diferencia de juegos (descendente)
  const aDiff = a.gamesWon - a.gamesLost;
  const bDiff = b.gamesWon - b.gamesLost;
  if (aDiff !== bDiff) return bDiff - aDiff;
  
  // 4. Head-to-head wins (descendente)
  if (a.h2hWins !== b.h2hWins) return b.h2hWins - a.h2hWins;
  
  // 5. Juegos ganados totales (descendente)
  if (a.gamesWon !== b.gamesWon) return b.gamesWon - a.gamesWon;
  
  return 0; // Empate total
}

export async function GET(
  _req: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournamentId = params.id;
    const userId = session.user.id;

    console.log(`[Tournament Overview] ${tournamentId} - Usuario: ${userId}`);

    // Obtener playerId del usuario
    const player = await prisma.player.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!player) {
      return NextResponse.json({ error: "No hay jugador asociado" }, { status: 401 });
    }

    const playerId = player.id;

    // Verificar que el usuario participa en el torneo
    const tournamentPlayer = await prisma.tournamentPlayer.findUnique({
      where: {
        tournamentId_playerId: { tournamentId, playerId }
      }
    });

    if (!tournamentPlayer) {
      return NextResponse.json({ error: "No participas en este torneo" }, { status: 403 });
    }

    // Obtener información completa del torneo y ronda actual
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        rounds: {
          where: { isClosed: false },
          orderBy: { number: "asc" },
          take: 1,
          include: {
            groups: {
              include: {
                players: {
                  include: { 
                    player: { 
                      include: { user: { select: { id: true, name: true } } } 
                    } 
                  }
                },
                matches: {
                  select: {
                    id: true,
                    setNumber: true,
                    status: true,
                    proposedDate: true,
                    acceptedDate: true,
                    acceptedBy: true,
                    proposedById: true,
                    isConfirmed: true,
                    team1Games: true,
                    team2Games: true,
                    tiebreakScore: true,
                    team1Player1Id: true,
                    team1Player2Id: true,
                    team2Player1Id: true,
                    team2Player2Id: true
                  }
                }
              },
              orderBy: { level: "asc" }
            }
          }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    if (!tournament.rounds.length) {
      return NextResponse.json({ error: "No hay rondas activas en este torneo" }, { status: 404 });
    }

    const currentRound = tournament.rounds[0];
    let userCurrentGroupId: string | undefined;
    const totalGroups = currentRound.groups.length;

    // Procesar información de todos los grupos con cálculos mejorados
    const groups: GroupOverview[] = currentRound.groups.map(group => {
      // Calcular estadísticas avanzadas para cada jugador
      const playersWithStats = group.players.map(gp => {
        const stats = calculatePlayerStats(gp.playerId, group.matches);
        const h2hWins = calculateH2H(gp.playerId, group.matches);
        
        return {
          playerId: gp.playerId,
          name: gp.player.name,
          points: gp.points || 0,
          streak: gp.streak || 0,
          setsWon: stats.setsWon,
          gamesWon: stats.gamesWon,
          gamesLost: stats.gamesLost,
          h2hWins,
          isCurrentUser: gp.playerId === playerId
        };
      });

      // Ordenar por criterios de desempate
      playersWithStats.sort(comparePlayersWithTiebreakers);

      // Identificar si el usuario actual está en este grupo
      const userInGroup = playersWithStats.find(p => p.isCurrentUser);
      if (userInGroup) {
        userCurrentGroupId = group.id;
      }

      // Asignar posiciones y calcular movimientos
      const players: PlayerInGroup[] = playersWithStats.map((player, index) => {
        const position = index + 1;
        const movement = calculateMovement(position, group.level, totalGroups);
        
        return {
          ...player,
          position,
          movement
        };
      });

      // Calcular estado de programación del grupo
      let scheduleStatus: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED" = "PENDING";
      let scheduledDate: string | null = null;
      
      const firstMatch = group.matches[0];
      if (firstMatch) {
        if (firstMatch.acceptedDate) {
          scheduleStatus = "SCHEDULED";
          scheduledDate = firstMatch.acceptedDate.toISOString();
        } else if (firstMatch.proposedDate) {
          scheduleStatus = "DATE_PROPOSED";
        }
      }

      // Verificar si todos los sets están completados
      const completedSets = group.matches.filter(m => m.isConfirmed).length;
      const totalSets = group.matches.length;
      const completionPercentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
      
      if (completedSets === totalSets && totalSets > 0) {
        scheduleStatus = "COMPLETED";
      }

      // Determinar si el usuario tiene acciones pendientes en este grupo
      let needsAction = false;
      if (userInGroup) {
        // Verificar si hay propuesta de fecha pendiente de respuesta del usuario
        if (firstMatch?.proposedDate && firstMatch.status === "DATE_PROPOSED") {
          const userAccepted = (firstMatch.acceptedBy || []).includes(userId);
          const proposedByUser = firstMatch.proposedById === userId;
          needsAction = !userAccepted && !proposedByUser;
        }

        // Verificar si hay sets sin jugar donde participa el usuario
        const userMatches = group.matches.filter(match => 
          [match.team1Player1Id, match.team1Player2Id, match.team2Player1Id, match.team2Player2Id]
            .includes(playerId)
        );
        
        const pendingUserMatches = userMatches.filter(match => 
          !match.isConfirmed && match.team1Games === null && match.team2Games === null
        );
        
        if (pendingUserMatches.length > 0) {
          needsAction = true;
        }
      }

      return {
        groupId: group.id,
        groupNumber: group.number,
        level: group.level || group.number,
        players,
        scheduleStatus,
        scheduledDate,
        completedSets,
        totalSets,
        needsAction,
        completionPercentage
      };
    });

    // Calcular estadísticas generales
    const stats = {
      totalGroups: groups.length,
      scheduledGroups: groups.filter(g => g.scheduleStatus === "SCHEDULED").length,
      completedGroups: groups.filter(g => g.scheduleStatus === "COMPLETED").length,
      userPendingActions: groups.filter(g => g.needsAction).length,
      averageCompletion: Math.round(
        groups.reduce((sum, g) => sum + g.completionPercentage, 0) / groups.length
      )
    };

    const response = {
      tournamentId,
      tournamentTitle: tournament.title,
      currentRound: currentRound.number,
      totalRounds: tournament.totalRounds,
      groups,
      userCurrentGroupId,
      stats
    };

    console.log(`[Tournament Overview] Procesados ${groups.length} grupos, completion promedio: ${stats.averageCompletion}%`);

    return NextResponse.json(response);

  } catch (error) {
    console.error(`[Tournament Overview] Error:`, error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}