import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type RouteParams = { params: { id: string } };

/**
 * ⚠️ ENDPOINT DEPRECADO ⚠️
 * 
 * Este endpoint ha sido deprecado en favor del sistema de programación unificado.
 * Las fechas ahora se coordinan a nivel de partido completo (3 sets) usando:
 * - POST /api/parties/[groupId] - Para proponer fecha del partido
 * - PATCH /api/parties/[groupId] - Para responder a propuesta
 * 
 * Este endpoint solo devuelve información de solo lectura.
 */

export async function POST(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    error: "Endpoint deprecado",
    message: "La programación de fechas individuales ha sido deprecada. Usa el sistema de programación de partido completo.",
    newEndpoints: {
      proposePartyDate: "/api/parties/[groupId] (POST)",
      respondToPartyDate: "/api/parties/[groupId] (PATCH)",
      documentation: "Ver PartyManager en lib/party-manager.ts"
    },
    migration: {
      reason: "Las fechas se coordinan mejor a nivel de partido (3 sets) en lugar de sets individuales",
      benefits: [
        "Mayor claridad para los jugadores",
        "Evita confusiones de fechas múltiples",
        "Simplifica la coordinación",
        "Mejora la experiencia de usuario"
      ]
    }
  }, { status: 410 }); // 410 Gone - Recurso ya no disponible
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    error: "Endpoint deprecado",
    message: "La respuesta a fechas individuales ha sido deprecada. Usa el sistema de programación de partido completo.",
    newEndpoints: {
      respondToPartyDate: "/api/parties/[groupId] (PATCH with action: 'accept'|'reject')",
      documentation: "Ver PartyManager en lib/party-manager.ts"
    }
  }, { status: 410 });
}

/**
 * GET - Solo lectura para información del match (mantenido para compatibilidad)
 */
export async function GET(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matchId = params.id;

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        group: {
          include: {
            round: {
              select: { id: true, number: true, isClosed: true }
            }
          }
        },
        proposer: {
          select: { id: true, name: true }
        }
      }
    });

    if (!match) {
      return NextResponse.json({ error: "Match no encontrado" }, { status: 404 });
    }

    // Verificar que el usuario puede ver este match
    const playerId = session.user.playerId;
    const isParticipant = playerId && [
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id
    ].includes(playerId);

    if (!isParticipant && !session.user.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      match: {
        id: match.id,
        setNumber: match.setNumber,
        status: match.status,
        proposedDate: match.proposedDate?.toISOString() || null,
        acceptedDate: match.acceptedDate?.toISOString() || null,
        proposedBy: match.proposer?.name || null,
        acceptedCount: (match.acceptedBy || []).length,
        isConfirmed: match.isConfirmed,
        roundClosed: match.group.round.isClosed
      },
      deprecationNotice: {
        message: "Este endpoint es de solo lectura. Para programar fechas usa el sistema de partido completo.",
        newEndpoints: {
          getPartyInfo: `/api/parties/${match.groupId}`,
          proposePartyDate: `/api/parties/${match.groupId} (POST)`,
          respondToPartyDate: `/api/parties/${match.groupId} (PATCH)`
        }
      }
    });
  } catch (error) {
    console.error("Error fetching match info:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}