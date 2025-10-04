// app/api/matches/party/propose-date/route.ts
// ✅ CORREGIDO: Proponer/actualizar fecha del partido (3 sets) de un grupo
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PartyManager } from "@/lib/party-manager";

type Body = {
  groupId: string;
  proposedDate: string; // ISO string
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { groupId, proposedDate } = (await request.json()) as Body;

    if (!groupId || !proposedDate) {
      return NextResponse.json(
        { error: "Parámetros inválidos: groupId y proposedDate son obligatorios" },
        { status: 400 }
      );
    }

    // Validaciones de fecha
    const dateObj = new Date(proposedDate);
    if (Number.isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
    if (dateObj <= new Date()) {
      return NextResponse.json(
        { error: "La fecha debe ser futura" },
        { status: 400 }
      );
    }

    const currentUserId = (session.user as any).id as string;
    const isAdmin = !!(session.user as any).isAdmin;

    // Delegamos en el PartyManager (canónico)
    const result = await PartyManager.proposePartyDate(
      groupId,
      dateObj,
      currentUserId,
      isAdmin
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    const party = result.party;
    return NextResponse.json({
      success: true,
      message: result.message,
      party: party
        ? {
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
              proposedByCurrentUser: party.proposedByCurrentUser,
            },
            progress: {
              totalSets: party.totalSets,
              completedSets: party.completedSets,
              playedSets: party.playedSets,
              pendingSets: party.pendingSets,
              isComplete: party.isComplete,
            },
          }
        : null,
    });
  } catch (err: any) {
    console.error("[POST /api/matches/party/propose-date] Error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}
