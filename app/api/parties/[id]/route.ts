// /app/api/parties/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
// IMPORTS RELATIVOS (evita errores con "@/...")
import { authOptions } from "../../../../lib/auth";
import { PartyManager } from "../../../../lib/party-manager";
import { prisma } from "../../../../lib/prisma";

type Params = { params: { id: string } };

// Helper: resolver userId de forma segura (id en sesión o lookup por email)
async function resolveUserId() {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; email?: string | null } | undefined;
  let userId: string | null = u?.id ?? null;

  if (!userId && u?.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: u.email },
      select: { id: true },
    });
    userId = dbUser?.id ?? null;
  }

  return { userId, session };
}

// GET: obtener el partido (los 3 sets del grupo)
export async function GET(_req: Request, { params }: Params) {
  try {
    const { userId } = await resolveUserId(); // puede ser null (solo afecta a canSchedule / proposedByCurrentUser)
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

// POST: proponer fecha para el partido
export async function POST(req: Request, { params }: Params) {
  try {
    const { userId } = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { proposedDate } = await req.json();
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
    const res = await PartyManager.proposePartyDate(groupId, when, userId);
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

// PATCH: responder a la propuesta (accept | reject)
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { userId } = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { action } = await req.json();
    if (action !== "accept" && action !== "reject") {
      return NextResponse.json(
        { success: false, error: "Acción inválida (accept|reject)" },
        { status: 400 }
      );
    }

    const groupId = params.id;
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
