// app/api/comodin/status/route.ts - VERSIÓN CORREGIDA
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getComodinStatus } from "@/lib/comodin.server";

export const dynamic = "force-dynamic";

// Helper para resolver playerId de forma robusta
async function resolvePlayerId(session: any): Promise<string | null> {
  // 1. Intentar obtener directamente desde la sesión
  let playerId = session.user?.playerId;
  
  if (playerId) {
    console.log(`🎯 PlayerId encontrado en sesión: ${playerId}`);
    return playerId;
  }
  
  // 2. Buscar por userId si está disponible
  const userId = session.user?.id;
  if (userId) {
    console.log(`🔍 Buscando jugador por userId: ${userId}`);
    try {
      const player = await prisma.player.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (player) {
        console.log(`✅ Jugador encontrado por userId: ${player.id}`);
        return player.id;
      }
    } catch (error) {
      console.warn(`⚠️ Error buscando por userId:`, error);
    }
  }
  
  // 3. Buscar por email como último recurso
  const email = session.user?.email;
  if (email) {
    console.log(`🔍 Buscando jugador por email: ${email}`);
    try {
      const player = await prisma.player.findFirst({
        where: { user: { email } },
        select: { id: true },
      });
      if (player) {
        console.log(`✅ Jugador encontrado por email: ${player.id}`);
        return player.id;
      }
    } catch (error) {
      console.warn(`⚠️ Error buscando por email:`, error);
    }
  }
  
  console.error(`❌ No se pudo resolver playerId para:`, {
    userId,
    email,
    sessionKeys: Object.keys(session.user || {}),
  });
  
  return null;
}

export async function GET(req: Request) {
  try {
    console.log(`🎲 [COMODIN STATUS] Iniciando petición`);
    
    // 1. Verificar autenticación
    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string; email?: string | null; playerId?: string } | undefined;
    
    if (!user) {
      console.log(`❌ [COMODIN STATUS] No autenticado`);
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    console.log(`👤 [COMODIN STATUS] Usuario autenticado:`, {
      id: user.id,
      email: user.email,
      hasPlayerId: !!user.playerId,
    });

    // 2. Resolver playerId de forma robusta
    const playerId = await resolvePlayerId(session);
    if (!playerId) {
      console.error(`❌ [COMODIN STATUS] No se encontró información del jugador`);
      return NextResponse.json({ 
        error: "No se encontró información del jugador. Verifica que tengas un perfil de jugador asociado a tu cuenta." 
      }, { status: 400 });
    }

    console.log(`🎯 [COMODIN STATUS] PlayerId resuelto: ${playerId}`);

    // 3. Validar roundId
    const url = new URL(req.url);
    const roundId = url.searchParams.get("roundId");
    
    if (!roundId) {
      console.error(`❌ [COMODIN STATUS] Falta roundId`);
      return NextResponse.json({ error: "Falta roundId" }, { status: 400 });
    }

    console.log(`🎯 [COMODIN STATUS] RoundId: ${roundId}`);

    // 4. Verificar que la ronda existe y el jugador tiene acceso
    const round = await prisma.round.findFirst({
      where: { 
        id: roundId,
        groups: {
          some: {
            players: {
              some: { playerId }
            }
          }
        }
      },
      select: { 
        id: true, 
        number: true, 
        tournamentId: true,
        tournament: { select: { title: true } }
      },
    });

    if (!round) {
      console.warn(`⚠️ [COMODIN STATUS] Ronda no encontrada o sin acceso: ${roundId}`);
      return NextResponse.json({ 
        error: "No tienes acceso a esta ronda o la ronda no existe" 
      }, { status: 404 });
    }

    console.log(`✅ [COMODIN STATUS] Ronda verificada: ${round.tournament.title} - Ronda ${round.number}`);

    // 5. Obtener estado del comodín
    console.log(`🔍 [COMODIN STATUS] Obteniendo estado del comodín...`);
    const status = await getComodinStatus(playerId, roundId);
    
    if (!status) {
      console.warn(`⚠️ [COMODIN STATUS] No se encontró información del comodín`);
      return NextResponse.json({ 
        error: "No se encontró información del comodín para esta ronda" 
      }, { status: 404 });
    }

    console.log(`✅ [COMODIN STATUS] Estado obtenido exitosamente:`, {
      used: status.used,
      canUse: status.canUse,
      mode: status.mode || 'ninguno',
    });

    return NextResponse.json(status);
    
  } catch (err: any) {
    console.error("[COMODIN STATUS] Error completo:", {
      message: err?.message,
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
      name: err?.name,
    });
    
    return NextResponse.json({ 
      error: err?.message ?? "Error inesperado al obtener estado del comodín",
      details: process.env.NODE_ENV === 'development' ? {
        stack: err?.stack,
        name: err?.name
      } : undefined
    }, { status: 500 });
  }
}