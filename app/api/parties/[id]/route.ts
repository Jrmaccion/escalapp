// /app/api/parties/[id]/route.ts - VERSIÓN EXTENDIDA CON FUNCIONALIDAD ADMIN
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { PartyManager } from "../../../../lib/party-manager";
import { prisma } from "../../../../lib/prisma";

type Params = { params: { id: string } };

// Helper: resolver userId de forma segura (id en sesión o lookup por email)
async function resolveUserId() {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; email?: string | null; isAdmin?: boolean } | undefined;
  let userId: string | null = u?.id ?? null;

  if (!userId && u?.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: u.email },
      select: { id: true },
    });
    userId = dbUser?.id ?? null;
  }

  return { 
    userId, 
    session,
    isAdmin: Boolean(u?.isAdmin)
  };
}

// GET: obtener el partido (los 3 sets del grupo)
export async function GET(_req: Request, { params }: Params) {
  try {
    const { userId } = await resolveUserId();
    const groupId = params.id;

    const party = await PartyManager.getParty(groupId, userId);
    if (!party) {
      return NextResponse.json({ success: false, error: "Partido no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: true, party });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}

// POST: proponer fecha para el partido (con detección de admin)
export async function POST(req: Request, { params }: Params) {
  try {
    const { userId, isAdmin } = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { proposedDate, adminOptions } = body;

    if (!proposedDate) {
      return NextResponse.json({ success: false, error: "Falta proposedDate" }, { status: 400 });
    }

    const when = new Date(proposedDate);
    if (isNaN(when.getTime()) || when <= new Date()) {
      return NextResponse.json(
        { success: false, error: "Fecha inválida o no futura" },
        { status: 400 }
      );
    }

    const groupId = params.id;

    // 🔧 NUEVO: Lógica específica para admin
    if (isAdmin && adminOptions) {
      const { 
        skipApproval = false, 
        forceScheduled = false, 
        notifyPlayers = true 
      } = adminOptions;

      const res = await PartyManager.adminSetPartyDate(groupId, when, userId, {
        skipApproval,
        forceScheduled,
        notifyPlayers
      });

      return NextResponse.json(
        { 
          success: res.success, 
          message: res.message, 
          party: res.party,
          adminAction: true
        },
        { status: res.success ? 200 : 400 }
      );
    }

    // Flujo normal para jugadores (con detección de admin)
    const res = await PartyManager.proposePartyDate(groupId, when, userId, isAdmin);
    return NextResponse.json(
      { success: res.success, message: res.message, party: res.party },
      { status: res.success ? 200 : 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}

// PATCH: responder a la propuesta (accept | reject) + nuevas acciones admin
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { userId, isAdmin } = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { action, adminAction } = body;

    const groupId = params.id;

    // 🔧 NUEVO: Acciones específicas de admin
    if (isAdmin && adminAction) {
      switch (action) {
        case "admin_cancel":
          const cancelRes = await PartyManager.adminCancelPartyDate(groupId, userId);
          return NextResponse.json(
            { 
              success: cancelRes.success, 
              message: cancelRes.message, 
              party: cancelRes.party,
              adminAction: true
            },
            { status: cancelRes.success ? 200 : 400 }
          );

        case "admin_force_schedule":
          const { forcedDate } = body;
          if (!forcedDate) {
            return NextResponse.json(
              { success: false, error: "Falta forcedDate para admin_force_schedule" },
              { status: 400 }
            );
          }

          const forceRes = await PartyManager.adminSetPartyDate(
            groupId, 
            new Date(forcedDate), 
            userId, 
            { forceScheduled: true }
          );
          return NextResponse.json(
            { 
              success: forceRes.success, 
              message: forceRes.message, 
              party: forceRes.party,
              adminAction: true
            },
            { status: forceRes.success ? 200 : 400 }
          );

        default:
          return NextResponse.json(
            { success: false, error: "Acción de admin no válida" },
            { status: 400 }
          );
      }
    }

    // Flujo normal para respuestas de jugadores
    if (action !== "accept" && action !== "reject") {
      return NextResponse.json(
        { success: false, error: "Acción inválida (accept|reject)" },
        { status: 400 }
      );
    }

    const res = await PartyManager.respondToPartyDate(groupId, action, userId);
    return NextResponse.json(
      { success: res.success, message: res.message, party: res.party },
      { status: res.success ? 200 : 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}

// 🔧 NUEVO: DELETE - Cancelar/resetear fecha (solo admin)
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { userId, isAdmin } = await resolveUserId();
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Solo admins pueden cancelar fechas" },
        { status: 403 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const groupId = params.id;
    const res = await PartyManager.adminCancelPartyDate(groupId, userId);
    
    return NextResponse.json(
      { 
        success: res.success, 
        message: res.message, 
        party: res.party,
        adminAction: true
      },
      { status: res.success ? 200 : 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}