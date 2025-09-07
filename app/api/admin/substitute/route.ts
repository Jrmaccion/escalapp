// app/api/admin/substitute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/substitute?roundId=...
 * Devuelve jugadores elegibles: todos los jugadores inscritos en el torneo de la ronda.
 * NOTA: No excluimos aquí “mismo grupo” ni “ya está actuando de sustituto”;
 * eso se filtra en frontend al elegir el “Jugador original” y se valida en el POST.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roundId = searchParams.get("roundId");
    if (!roundId) {
      return NextResponse.json({ error: "Falta roundId" }, { status: 400 });
    }

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: { select: { id: true, title: true } },
      },
    });
    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    // Todos los jugadores del torneo (ordenados por nombre)
    const tournamentPlayers = await prisma.tournamentPlayer.findMany({
      where: { tournamentId: round.tournament.id },
      select: {
        player: { select: { id: true, name: true } },
      },
      orderBy: { player: { name: "asc" } },
    });

    const players = tournamentPlayers.map((tp) => tp.player);
    return NextResponse.json({ players });
  } catch (error) {
    console.error("GET /api/admin/substitute error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * POST /api/admin/substitute
 * body: { roundId, originalPlayerId, substitutePlayerId, reason? }
 * Reglas:
 * - Solo admin
 * - El jugador original debe pertenecer a un grupo de la ronda
 * - El sustituto DEBE pertenecer al torneo de la ronda
 * - No permitir sustituto del MISMO grupo del original
 * - Se permite asignar aunque el grupo tenga sets confirmados (afectará solo a partidos futuros no confirmados)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { roundId, originalPlayerId, substitutePlayerId, reason } = body as {
      roundId?: string;
      originalPlayerId?: string;
      substitutePlayerId?: string;
      reason?: string;
    };

    if (!roundId || !originalPlayerId || !substitutePlayerId) {
      return NextResponse.json(
        { error: "Faltan parámetros: roundId, originalPlayerId, substitutePlayerId" },
        { status: 400 }
      );
    }
    if (originalPlayerId === substitutePlayerId) {
      return NextResponse.json(
        { error: "El jugador original y el sustituto no pueden ser la misma persona" },
        { status: 400 }
      );
    }

    // Ronda + grupos con jugadores (para localizar original y su grupo)
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: { select: { id: true } },
        groups: { include: { players: true } },
      },
    });
    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    // Localizar el grupo del jugador original
    const groupOfOriginal = round.groups.find((g) =>
      g.players.some((gp) => gp.playerId === originalPlayerId)
    );
    if (!groupOfOriginal) {
      return NextResponse.json(
        { error: "El jugador original no pertenece a esta ronda" },
        { status: 400 }
      );
    }
    const gpOriginal = groupOfOriginal.players.find((gp) => gp.playerId === originalPlayerId)!;

    // Validar que el sustituto está inscrito en el torneo
    const tp = await prisma.tournamentPlayer.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId: round.tournament.id,
          playerId: substitutePlayerId,
        },
      },
      select: { playerId: true },
    });
    if (!tp) {
      return NextResponse.json(
        { error: "El sustituto no está inscrito en el torneo de esta ronda" },
        { status: 400 }
      );
    }

    // ❗ Nuevo: impedir sustituto del MISMO grupo que el original
    const substituteIsInSameGroup = groupOfOriginal.players.some(
      (gp) => gp.playerId === substitutePlayerId
    );
    if (substituteIsInSameGroup) {
      return NextResponse.json(
        { error: "No puedes asignar como sustituto a un jugador del mismo grupo" },
        { status: 400 }
      );
    }

    // Asignar sustituto (aunque existan sets confirmados; aplicará a futuros sets no confirmados)
    await prisma.groupPlayer.update({
      where: { id: gpOriginal.id },
      data: {
        substitutePlayerId,
        // substituteReason: reason ?? "Asignación manual por administrador", // (si existe el campo)
      },
    });

    return NextResponse.json({
      success: true,
      message: "Sustituto asignado correctamente",
    });
  } catch (error) {
    console.error("POST /api/admin/substitute error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/substitute
 * body: { roundId, playerId }  // playerId = jugador original
 * Reglas:
 * - Solo admin
 * - Se permite revocar aunque existan sets confirmados (solo deshace para partidos futuros)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { roundId, playerId } = body as { roundId?: string; playerId?: string };
    if (!roundId || !playerId) {
      return NextResponse.json(
        { error: "Faltan parámetros: roundId, playerId" },
        { status: 400 }
      );
    }

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { groups: { include: { players: true } } },
    });
    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    const groupOfOriginal = round.groups.find((g) =>
      g.players.some((gp) => gp.playerId === playerId)
    );
    if (!groupOfOriginal) {
      return NextResponse.json(
        { error: "El jugador no pertenece a esta ronda" },
        { status: 400 }
      );
    }
    const gpOriginal = groupOfOriginal.players.find((gp) => gp.playerId === playerId)!;

    await prisma.groupPlayer.update({
      where: { id: gpOriginal.id },
      data: { substitutePlayerId: null },
    });

    return NextResponse.json({
      success: true,
      message: "Sustituto revocado correctamente",
    });
  } catch (error) {
    console.error("DELETE /api/admin/substitute error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
