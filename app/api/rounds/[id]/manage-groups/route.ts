// app/api/rounds/[id]/manage-groups/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GroupManager } from "@/lib/group-manager";

// Tipos del payload esperado desde ManualGroupManager
type RequestGroup = {
  groupId?: string;
  level?: number | null;
  playerIds: string[];
};

type RequestBody = {
  groups: RequestGroup[];
};

// Validador mínimo sin dependencias externas
function validateBody(body: any): body is RequestBody {
  if (!body || typeof body !== "object") return false;
  if (!Array.isArray(body.groups)) return false;

  for (const g of body.groups) {
    if (typeof g !== "object" || g === null) return false;
    if (g.groupId !== undefined && typeof g.groupId !== "string") return false;
    if (g.level !== undefined && g.level !== null && typeof g.level !== "number") return false;
    if (!Array.isArray(g.playerIds)) return false;
    if (!g.playerIds.every((id: any) => typeof id === "string")) return false;
  }
  return true;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Auth admin
    const session = await getServerSession(authOptions);
    if (!session?.user || !(session.user as any).isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const roundId = params.id;
    if (!roundId) {
      return NextResponse.json({ error: "Falta parámetro de ruta: id (roundId)" }, { status: 400 });
    }

    const body = await req.json();
    if (!validateBody(body)) {
      return NextResponse.json(
        { error: "Payload inválido. Se espera { groups: [{ groupId?, level?, playerIds: string[] }] }" },
        { status: 400 }
      );
    }

    // Reorganización centralizada (borra partidos del/los grupos afectados)
    const result = await GroupManager.reorganizeGroups(roundId, body.groups);

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.message ?? "No se pudo reorganizar los grupos" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: result.message ?? "Grupos reorganizados correctamente",
      groupsUpdated: result.groupsUpdated,
      playersAssigned: result.playersAssigned,
    });
  } catch (err: any) {
    // Prisma unique constraint u otros conocidos
    const msg = typeof err?.message === "string" ? err.message : "Error interno del servidor";

    if (msg.includes("P2002")) {
      return NextResponse.json(
        {
          error: "Error de integridad (duplicado). Revisa posiciones o jugadores duplicados en un mismo grupo.",
          code: "P2002",
        },
        { status: 409 }
      );
    }

    if (msg.includes("Ronda no encontrada") || msg.includes("La ronda está cerrada")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: msg,
      },
      { status: 500 }
    );
  }
}
