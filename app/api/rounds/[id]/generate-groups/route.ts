// app/api/rounds/[id]/generate-groups/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GroupManager } from "@/lib/group-manager";
import {
  getEligiblePlayersForRound,
  buildGroupsForFirstRound,
} from "@/lib/rounds";

type Body = {
  groupSize?: number;               // por defecto 4
  strategy?: "random" | "ranking";  // por defecto "random"
  force?: boolean;                  // si ya hay grupos, requiere force=true para regenerar
};

function parseBody(json: any): Body {
  const out: Body = {};
  if (json && typeof json === "object") {
    if (typeof json.groupSize === "number" && json.groupSize >= 2) out.groupSize = json.groupSize;
    if (json.strategy === "random" || json.strategy === "ranking") out.strategy = json.strategy;
    if (typeof json.force === "boolean") out.force = json.force;
  }
  return out;
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

    const bodyRaw = await req.json().catch(() => ({}));
    const { groupSize = 4, strategy = "random", force = false } = parseBody(bodyRaw);

    // Cargar ronda actual con estado
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: true,
        groups: { include: { players: true, matches: true } },
      },
    });

    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }
    if (round.isClosed) {
      return NextResponse.json({ error: "La ronda está cerrada y no se puede modificar" }, { status: 400 });
    }

    const hasGroups = round.groups.length > 0;
    if (hasGroups && !force) {
      return NextResponse.json({
        ok: false,
        message: "La ronda ya tiene grupos. Usa { force: true } para regenerar.",
        groupsExisting: round.groups.length,
      }, { status: 409 });
    }

    // Jugadores elegibles y construcción de estructura inicial (R1 vs siguientes)
    const elegibles = await getEligiblePlayersForRound(round.tournamentId, round.number);
    if (elegibles.length === 0) {
      return NextResponse.json({
        ok: false,
        message: "No hay jugadores elegibles para generar grupos en esta ronda.",
      }, { status: 400 });
    }

    const groupsStructure = buildGroupsForFirstRound(
      elegibles.map(e => ({ playerId: e.playerId, name: e.name ?? undefined })),
      groupSize,
      strategy
    );

    if (groupsStructure.length === 0) {
      return NextResponse.json({
        ok: false,
        message: "No se pudieron formar grupos con el tamaño indicado. Añade jugadores o reduce groupSize.",
      }, { status: 400 });
    }

    // Escritura centralizada con GroupManager
    const result = await GroupManager.updateRoundGroups(roundId, groupsStructure, {
      deleteExisting: hasGroups && force,
      generateMatches: false,   // sets se generan aparte si lo decides
      validateIntegrity: true,
    });

    return NextResponse.json({
      ok: true,
      message: "Grupos generados correctamente",
      groupsCreated: result.groupsCreated,
      playersAssigned: result.playersAssigned,
      skippedPlayerIds: elegibles.length % groupSize === 0
        ? []
        : elegibles.slice(groupsStructure.length * groupSize).map(p => p.playerId),
    });
  } catch (err: any) {
    const msg: string = typeof err?.message === "string" ? err.message : "Error interno del servidor";

    if (msg.includes("P2002")) {
      return NextResponse.json(
        { error: "Error de integridad al crear grupos (duplicados).", code: "P2002" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Error interno generando grupos", details: msg },
      { status: 500 }
    );
  }
}
