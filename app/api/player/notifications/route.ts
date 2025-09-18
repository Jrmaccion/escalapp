// app/api/player/notifications/route.ts - VERSIÓN CORREGIDA CON MEJOR DETECCIÓN DE PROPUESTAS
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type NotificationPayload = {
  pendingMatches: number;
  pendingConfirmations: number;
  dateProposals: number; // Propuestas de fecha pendientes de respuesta
  unreadUpdates: number;
  total: number;
  details: {
    dateProposalGroups: Array<{
      groupId: string;
      groupNumber: number;
      proposedBy: string;
      proposedDate: string;
      roundNumber: number;
      tournamentTitle: string;
    }>;
  };
};

function buildPayload(
  pendingMatches: number, 
  pendingConfirmations: number, 
  dateProposals: number,
  unreadUpdates: number,
  dateProposalGroups: any[] = []
): NotificationPayload {
  return {
    pendingMatches,
    pendingConfirmations,
    dateProposals,
    unreadUpdates,
    total: pendingMatches + pendingConfirmations + dateProposals + unreadUpdates,
    details: {
      dateProposalGroups
    }
  };
}

export async function GET(_request: NextRequest) {
  try {
    console.log("📊 GET /api/player/notifications - Iniciando...");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log("❌ Usuario no autorizado");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    console.log("👤 Usuario autenticado:", session.user.email);

    // 🔧 CORREGIDO: Buscar player por userId directamente
    const player = await prisma.player.findUnique({
      where: { userId: session.user.id },
      select: { 
        id: true, 
        name: true,
        notificationsReadAt: true 
      },
    });

    if (!player) {
      console.log("❌ Jugador no encontrado para userId:", session.user.id);
      return NextResponse.json(buildPayload(0, 0, 0, 0));
    }

    console.log("🎮 Jugador encontrado:", player.id, "-", player.name);

    // Torneos activos del jugador
    const activeTournaments = await prisma.tournament.findMany({
      where: {
        isActive: true,
        players: { some: { playerId: player.id } },
      },
      include: {
        rounds: {
          where: { isClosed: false },
          include: {
            groups: {
              where: {
                players: { some: { playerId: player.id } }
              },
              include: {
                players: { 
                  where: { playerId: player.id },
                  select: { playerId: true }
                },
                matches: {
                  where: {
                    OR: [
                      { team1Player1Id: player.id },
                      { team1Player2Id: player.id },
                      { team2Player1Id: player.id },
                      { team2Player2Id: player.id },
                    ],
                  },
                  include: {
                    proposer: { 
                      select: { 
                        id: true, 
                        name: true,
                        player: {
                          select: { name: true }
                        }
                      } 
                    }
                  }
                },
              },
            },
          },
        },
      },
    });

    console.log("🏆 Torneos activos encontrados:", activeTournaments.length);

    let pendingMatches = 0;
    let pendingConfirmations = 0;
    let dateProposals = 0;
    const dateProposalGroups: any[] = [];

    for (const tournament of activeTournaments) {
      console.log(`🔍 Analizando torneo: ${tournament.title}`);
      
      for (const round of tournament.rounds) {
        console.log(`🔍 Analizando ronda ${round.number} (cerrada: ${round.isClosed})`);
        
        for (const group of round.groups) {
          if (group.players.length === 0) {
            console.log(`⚠️ Grupo ${group.number} sin jugadores del usuario actual`);
            continue;
          }
          
          console.log(`🔍 Analizando grupo ${group.number} con ${group.matches.length} matches`);
          
          // 🆕 MEJORADO: Verificar propuestas de fecha pendientes de respuesta del usuario
          const firstMatch = group.matches[0];
          if (firstMatch && firstMatch.proposedDate && firstMatch.status === "DATE_PROPOSED") {
            const userAccepted = (firstMatch.acceptedBy || []).includes(session.user.id);
            const proposedByUser = firstMatch.proposedById === session.user.id;
            
            // Si hay propuesta, no la propuso el usuario actual, y el usuario no la ha aceptado
            if (!proposedByUser && !userAccepted) {
              dateProposals++;
              
              // Obtener nombre del proponente
              let proposedByName = "Jugador desconocido";
              if (firstMatch.proposer) {
                proposedByName = firstMatch.proposer.player?.name || firstMatch.proposer.name || "Jugador desconocido";
              }
              
              dateProposalGroups.push({
                groupId: group.id,
                groupNumber: group.number,
                proposedBy: proposedByName,
                proposedDate: firstMatch.proposedDate.toISOString(),
                roundNumber: round.number,
                tournamentTitle: tournament.title
              });
              
              console.log(`📅 Propuesta de fecha pendiente en grupo ${group.number} por ${proposedByName}`);
            }
          }
          
          // Análisis de matches (sets) individuales
          for (const match of group.matches) {
            const hasGames1 = match.team1Games != null;
            const hasGames2 = match.team2Games != null;
            const isConfirmed = match.isConfirmed;
            
            if (!hasGames1 && !hasGames2) {
              // Sin jugar
              pendingMatches++;
              console.log(`🔍 Match ${match.id} sin jugar (set ${match.setNumber})`);
            } else if ((hasGames1 || hasGames2) && !isConfirmed) {
              // Jugado pero no confirmado
              pendingConfirmations++;
              console.log(`⏳ Match ${match.id} sin confirmar (set ${match.setNumber})`);
            }
          }
        }
      }
    }

    // Novedades no leídas: cambios confirmados desde la última vez que abrió el panel
    const since = player.notificationsReadAt ?? new Date(0);
    console.log("📅 Buscando actualizaciones desde:", since);

    const unreadUpdates = await prisma.match.count({
      where: {
        OR: [
          { team1Player1Id: player.id },
          { team1Player2Id: player.id },
          { team2Player1Id: player.id },
          { team2Player2Id: player.id },
        ],
        updatedAt: { gt: since },
        isConfirmed: true,
      },
    });

    console.log("📊 Resumen de notificaciones:", {
      pendingMatches,
      pendingConfirmations,
      dateProposals,
      unreadUpdates,
      dateProposalGroups: dateProposalGroups.length
    });

    return NextResponse.json(buildPayload(
      pendingMatches, 
      pendingConfirmations, 
      dateProposals,
      unreadUpdates,
      dateProposalGroups
    ));

  } catch (error) {
    console.error("❌ Error en GET /api/player/notifications:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" }, 
      { status: 500 }
    );
  }
}

// PATCH = marcar como leídas (actualiza notificationsReadAt a ahora)
export async function PATCH(_request: NextRequest) {
  try {
    console.log("📊 PATCH /api/player/notifications - Marcando como leídas...");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log("❌ Usuario no autorizado");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const player = await prisma.player.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!player) {
      console.log("❌ Jugador no encontrado para userId:", session.user.id);
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    // Actualizar timestamp de lectura
    await prisma.player.update({
      where: { userId: session.user.id },
      data: { notificationsReadAt: new Date() },
    });

    console.log("✅ Notificaciones marcadas como leídas para:", session.user.email);

    // Tras marcar leídas, devolvemos payload recalculado (unreadUpdates = 0)
    // Pero mantenemos pendingMatches, pendingConfirmations y dateProposals actuales
    
    // Recalcular rápidamente solo lo necesario
    const activeTournaments = await prisma.tournament.findMany({
      where: {
        isActive: true,
        players: { some: { playerId: player.id } },
      },
      include: {
        rounds: {
          where: { isClosed: false },
          include: {
            groups: {
              where: {
                players: { some: { playerId: player.id } }
              },
              include: {
                players: { 
                  where: { playerId: player.id },
                  select: { playerId: true }
                },
                matches: {
                  where: {
                    OR: [
                      { team1Player1Id: player.id },
                      { team1Player2Id: player.id },
                      { team2Player1Id: player.id },
                      { team2Player2Id: player.id },
                    ],
                  },
                  include: {
                    proposer: { 
                      select: { 
                        id: true, 
                        name: true,
                        player: {
                          select: { name: true }
                        }
                      } 
                    }
                  }
                },
              },
            },
          },
        },
      },
    });

    let pendingMatches = 0;
    let pendingConfirmations = 0;
    let dateProposals = 0;
    const dateProposalGroups: any[] = [];

    for (const tournament of activeTournaments) {
      for (const round of tournament.rounds) {
        for (const group of round.groups) {
          if (group.players.length === 0) continue;
          
          // Verificar propuestas de fecha
          const firstMatch = group.matches[0];
          if (firstMatch && firstMatch.proposedDate && firstMatch.status === "DATE_PROPOSED") {
            const userAccepted = (firstMatch.acceptedBy || []).includes(session.user.id);
            const proposedByUser = firstMatch.proposedById === session.user.id;
            
            if (!proposedByUser && !userAccepted) {
              dateProposals++;
              
              let proposedByName = "Jugador desconocido";
              if (firstMatch.proposer) {
                proposedByName = firstMatch.proposer.player?.name || firstMatch.proposer.name || "Jugador desconocido";
              }
              
              dateProposalGroups.push({
                groupId: group.id,
                groupNumber: group.number,
                proposedBy: proposedByName,
                proposedDate: firstMatch.proposedDate.toISOString(),
                roundNumber: round.number,
                tournamentTitle: tournament.title
              });
            }
          }
          
          // Análisis de matches
          for (const match of group.matches) {
            const hasGames1 = match.team1Games != null;
            const hasGames2 = match.team2Games != null;
            const isConfirmed = match.isConfirmed;
            
            if (!hasGames1 && !hasGames2) {
              pendingMatches++;
            } else if ((hasGames1 || hasGames2) && !isConfirmed) {
              pendingConfirmations++;
            }
          }
        }
      }
    }

    return NextResponse.json(buildPayload(
      pendingMatches, 
      pendingConfirmations, 
      dateProposals,
      0, // unreadUpdates = 0 después de marcar como leídas
      dateProposalGroups
    ));

  } catch (error) {
    console.error("❌ Error en PATCH /api/player/notifications:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" }, 
      { status: 500 }
    );
  }
}