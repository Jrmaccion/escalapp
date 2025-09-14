// app/api/parties/[id]/route.ts - VERSIÓN CORREGIDA
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PartyManager } from "@/lib/party-manager";

type RouteParams = { params: { id: string } };

/**
 * GET - Obtener información del partido (3 sets) de un grupo
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const groupId = params.id; // <- CORRECCIÓN: usar params.id
    const currentUserId = session.user.id;

    console.log(`[GET /api/parties/${groupId}] Usuario: ${currentUserId}`);

    // VALIDACIÓN CRÍTICA
    if (!groupId || groupId === 'undefined') {
      console.error(`[GET /api/parties] GroupId inválido: ${groupId}`);
      return NextResponse.json({
        error: "ID de grupo requerido"
      }, { status: 400 });
    }

    const party = await PartyManager.getParty(groupId, currentUserId);

    if (!party) {
      console.warn(`[GET /api/parties/${groupId}] Partido no encontrado`);
      return NextResponse.json({
        error: "Partido no encontrado o no tienes acceso"
      }, { status: 404 });
    }

    console.log(`[GET /api/parties/${groupId}] Partido encontrado exitosamente`);

    return NextResponse.json({
      success: true,
      party: {
        groupId: party.groupId,
        groupNumber: party.groupNumber,
        roundNumber: party.roundNumber,
        roundId: party.roundId,
        players: party.players,
        sets: party.sets,
        schedule: {
          status: party.status,
          proposedDate: party.proposedDate?.toISOString() || null,
          acceptedDate: party.acceptedDate?.toISOString() || null,
          proposedBy: party.proposedBy,
          acceptedBy: party.acceptedBy,
          acceptedCount: party.acceptedCount,
          totalPlayersNeeded: party.totalPlayersNeeded,
          proposedByCurrentUser: party.proposedByCurrentUser
        },
        progress: {
          totalSets: party.totalSets,
          completedSets: party.completedSets,
          playedSets: party.playedSets,
          pendingSets: party.pendingSets,
          isComplete: party.isComplete
        }
      }
    });
  } catch (error) {
    console.error(`[GET /api/parties/${params.id}] Error:`, error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST - Proponer fecha para el partido completo
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const groupId = params.id; // <- CORRECCIÓN: usar params.id
    const currentUserId = session.user.id;
    const isAdmin = (session.user as any).isAdmin === true;

    // VALIDACIÓN CRÍTICA
    if (!groupId || groupId === 'undefined') {
      console.error(`[POST /api/parties] GroupId inválido: ${groupId}`);
      return NextResponse.json({
        error: "ID de grupo requerido"
      }, { status: 400 });
    }

    const body = await request.json();
    const { proposedDate, message } = body;

    if (!proposedDate) {
      return NextResponse.json(
        { error: "Fecha propuesta requerida" },
        { status: 400 }
      );
    }

    const dateObj = new Date(proposedDate);
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json(
        { error: "Fecha inválida" },
        { status: 400 }
      );
    }

    if (dateObj <= new Date()) {
      return NextResponse.json(
        { error: "La fecha debe ser futura" },
        { status: 400 }
      );
    }

    console.log(`[POST /api/parties/${groupId}] Propuesta de fecha: ${proposedDate} por ${currentUserId}`);

    const result = await PartyManager.proposePartyDate(
      groupId,
      dateObj,
      currentUserId,
      isAdmin
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    // Formatear respuesta
    const party = result.party;
    const response = {
      success: true,
      message: result.message,
      party: party ? {
        groupId: party.groupId,
        groupNumber: party.groupNumber,
        roundNumber: party.roundNumber,
        roundId: party.roundId,
        players: party.players,
        sets: party.sets,
        schedule: {
          status: party.status,
          proposedDate: party.proposedDate?.toISOString() || null,
          acceptedDate: party.acceptedDate?.toISOString() || null,
          proposedBy: party.proposedBy,
          acceptedBy: party.acceptedBy,
          acceptedCount: party.acceptedCount,
          totalPlayersNeeded: party.totalPlayersNeeded,
          proposedByCurrentUser: party.proposedByCurrentUser
        },
        progress: {
          totalSets: party.totalSets,
          completedSets: party.completedSets,
          playedSets: party.playedSets,
          pendingSets: party.pendingSets,
          isComplete: party.isComplete
        }
      } : null
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(`[POST /api/parties/${params.id}] Error:`, error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Responder a propuesta de fecha (aceptar/rechazar)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const groupId = params.id; // <- CORRECCIÓN: usar params.id
    const currentUserId = session.user.id;
    const isAdmin = (session.user as any).isAdmin === true;

    // VALIDACIÓN CRÍTICA
    if (!groupId || groupId === 'undefined') {
      console.error(`[PATCH /api/parties] GroupId inválido: ${groupId}`);
      return NextResponse.json({
        error: "ID de grupo requerido"
      }, { status: 400 });
    }

    const body = await request.json();
    const { action, adminAction, forcedDate } = body;

    if (!["accept", "reject", "admin_force_schedule"].includes(action)) {
      return NextResponse.json(
        { error: "Acción inválida" },
        { status: 400 }
      );
    }

    console.log(`[PATCH /api/parties/${groupId}] Acción: ${action} por ${currentUserId}`);

    // Manejo de acciones de admin
    if (action === "admin_force_schedule" && isAdmin && adminAction) {
      if (!forcedDate) {
        return NextResponse.json(
          { error: "Fecha requerida para forzar programación" },
          { status: 400 }
        );
      }

      const dateObj = new Date(forcedDate);
      if (isNaN(dateObj.getTime())) {
        return NextResponse.json(
          { error: "Fecha inválida" },
          { status: 400 }
        );
      }

      const result = await PartyManager.adminSetPartyDate(
        groupId,
        dateObj,
        currentUserId,
        {
          skipApproval: true,
          forceScheduled: true,
          notifyPlayers: true
        }
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }

      const party = result.party;
      return NextResponse.json({
        success: true,
        message: result.message,
        party: party ? {
          groupId: party.groupId,
          groupNumber: party.groupNumber,
          roundNumber: party.roundNumber,
          roundId: party.roundId,
          players: party.players,
          sets: party.sets,
          schedule: {
            status: party.status,
            proposedDate: party.proposedDate?.toISOString() || null,
            acceptedDate: party.acceptedDate?.toISOString() || null,
            proposedBy: party.proposedBy,
            acceptedBy: party.acceptedBy,
            acceptedCount: party.acceptedCount,
            totalPlayersNeeded: party.totalPlayersNeeded,
            proposedByCurrentUser: party.proposedByCurrentUser
          },
          progress: {
            totalSets: party.totalSets,
            completedSets: party.completedSets,
            playedSets: party.playedSets,
            pendingSets: party.pendingSets,
            isComplete: party.isComplete
          }
        } : null
      });
    }

    // Acciones normales de jugadores
    const result = await PartyManager.respondToPartyDate(
      groupId,
      action as "accept" | "reject",
      currentUserId
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    const party = result.party;
    const response = {
      success: true,
      message: result.message,
      party: party ? {
        groupId: party.groupId,
        groupNumber: party.groupNumber,
        roundNumber: party.roundNumber,
        roundId: party.roundId,
        players: party.players,
        sets: party.sets,
        schedule: {
          status: party.status,
          proposedDate: party.proposedDate?.toISOString() || null,
          acceptedDate: party.acceptedDate?.toISOString() || null,
          proposedBy: party.proposedBy,
          acceptedBy: party.acceptedBy,
          acceptedCount: party.acceptedCount,
          totalPlayersNeeded: party.totalPlayersNeeded,
          proposedByCurrentUser: party.proposedByCurrentUser
        },
        progress: {
          totalSets: party.totalSets,
          completedSets: party.completedSets,
          playedSets: party.playedSets,
          pendingSets: party.pendingSets,
          isComplete: party.isComplete
        }
      } : null
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(`[PATCH /api/parties/${params.id}] Error:`, error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Cancelar fecha programada (solo admin)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const groupId = params.id; // <- CORRECCIÓN: usar params.id
    const currentUserId = session.user.id;
    const isAdmin = (session.user as any).isAdmin === true;

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Solo administradores pueden cancelar fechas" },
        { status: 403 }
      );
    }

    // VALIDACIÓN CRÍTICA
    if (!groupId || groupId === 'undefined') {
      console.error(`[DELETE /api/parties] GroupId inválido: ${groupId}`);
      return NextResponse.json({
        error: "ID de grupo requerido"
      }, { status: 400 });
    }

    console.log(`[DELETE /api/parties/${groupId}] Cancelación por admin: ${currentUserId}`);

    const result = await PartyManager.adminCancelPartyDate(groupId, currentUserId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    const party = result.party;
    return NextResponse.json({
      success: true,
      message: result.message,
      party: party ? {
        groupId: party.groupId,
        groupNumber: party.groupNumber,
        roundNumber: party.roundNumber,
        roundId: party.roundId,
        players: party.players,
        sets: party.sets,
        schedule: {
          status: party.status,
          proposedDate: party.proposedDate?.toISOString() || null,
          acceptedDate: party.acceptedDate?.toISOString() || null,
          proposedBy: party.proposedBy,
          acceptedBy: party.acceptedBy,
          acceptedCount: party.acceptedCount,
          totalPlayersNeeded: party.totalPlayersNeeded,
          proposedByCurrentUser: party.proposedByCurrentUser
        },
        progress: {
          totalSets: party.totalSets,
          completedSets: party.completedSets,
          playedSets: party.playedSets,
          pendingSets: party.pendingSets,
          isComplete: party.isComplete
        }
      } : null
    });
  } catch (error) {
    console.error(`[DELETE /api/parties/${params.id}] Error:`, error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}