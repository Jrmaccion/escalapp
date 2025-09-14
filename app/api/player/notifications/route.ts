import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type NotificationPayload = {
  pendingMatches: number;
  pendingConfirmations: number;
  unreadUpdates: number; // solo novedades no leídas desde notificationsReadAt
  total: number; // pendingMatches + pendingConfirmations + unreadUpdates
};

function buildPayload(pendingMatches: number, pendingConfirmations: number, unreadUpdates: number): NotificationPayload {
  return {
    pendingMatches,
    pendingConfirmations,
    unreadUpdates,
    total: pendingMatches + pendingConfirmations + unreadUpdates,
  };
}

export async function GET(_request: NextRequest) {
  try {
    console.log("🔔 GET /api/player/notifications - Iniciando...");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log("❌ Usuario no autorizado");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    console.log("👤 Usuario autenticado:", session.user.email);

    const player = await prisma.player.findUnique({
      where: { userId: session.user.id },
      select: { id: true, notificationsReadAt: true },
    });

    if (!player) {
      console.log("❌ Jugador no encontrado para userId:", session.user.id);
      return NextResponse.json(buildPayload(0, 0, 0));
    }

    console.log("🎮 Jugador encontrado:", player.id);

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
              include: {
                players: { where: { playerId: player.id } },
                matches: {
                  where: {
                    OR: [
                      { team1Player1Id: player.id },
                      { team1Player2Id: player.id },
                      { team2Player1Id: player.id },
                      { team2Player2Id: player.id },
                    ],
                  },
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

    for (const tournament of activeTournaments) {
      console.log(`🔍 Analizando torneo: ${tournament.title}`);
      
      for (const round of tournament.rounds) {
        console.log(`🔍 Analizando ronda ${round.number} (cerrada: ${round.isClosed})`);
        
        for (const group of round.groups) {
          if (group.players.length === 0) {
            console.log(`⚠️ Grupo ${group.number} sin jugadores`);
            continue;
          }
          
          console.log(`🔍 Analizando grupo ${group.number} con ${group.matches.length} matches`);
          
          for (const match of group.matches) {
            const hasGames1 = match.team1Games != null;
            const hasGames2 = match.team2Games != null;
            const isConfirmed = match.isConfirmed;
            
            if (!hasGames1 && !hasGames2) {
              // Sin jugar
              pendingMatches++;
              console.log(`📝 Match ${match.id} sin jugar (set ${match.setNumber})`);
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
      unreadUpdates
    });

    return NextResponse.json(buildPayload(pendingMatches, pendingConfirmations, unreadUpdates));

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
    console.log("🔔 PATCH /api/player/notifications - Marcando como leídas...");
    
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
    // Pero mantenemos pendingMatches y pendingConfirmations actuales
    
    // Recalcular rápidamente
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
              include: {
                players: { where: { playerId: player.id } },
                matches: {
                  where: {
                    OR: [
                      { team1Player1Id: player.id },
                      { team1Player2Id: player.id },
                      { team2Player1Id: player.id },
                      { team2Player2Id: player.id },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    });

    let pendingMatches = 0;
    let pendingConfirmations = 0;

    for (const tournament of activeTournaments) {
      for (const round of tournament.rounds) {
        for (const group of round.groups) {
          if (group.players.length === 0) continue;
          
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

    return NextResponse.json(buildPayload(pendingMatches, pendingConfirmations, 0));

  } catch (error) {
    console.error("❌ Error en PATCH /api/player/notifications:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" }, 
      { status: 500 }
    );
  }
}

// POST de prueba (desarrollo)
export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Simular datos aleatorios para testing
    const pendingMatches = Math.floor(Math.random() * 3);
    const pendingConfirmations = Math.floor(Math.random() * 2);
    const unreadUpdates = Math.floor(Math.random() * 2);

    console.log("🧪 POST /api/player/notifications - Datos de prueba:", {
      pendingMatches,
      pendingConfirmations,
      unreadUpdates
    });

    return NextResponse.json(buildPayload(pendingMatches, pendingConfirmations, unreadUpdates));

  } catch (error) {
    console.error("❌ Error en POST /api/player/notifications:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" }, 
      { status: 500 }
    );
  }
}