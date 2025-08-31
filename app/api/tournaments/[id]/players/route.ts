import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/* ------------------------ GET: lista jugadores del torneo ------------------------ */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    const tps = await prisma.tournamentPlayer.findMany({
      where: { tournamentId: params.id },
      select: {
        playerId: true,
        joinedRound: true,
        player: { select: { id: true, name: true } },
      },
      orderBy: [{ joinedRound: "asc" }],
    });

    const players = tps.map((tp) => ({
      id: tp.player.id,
      name: tp.player.name,
      joinedRound: tp.joinedRound,
    }));

    return NextResponse.json({ ok: true, players });
  } catch (err: any) {
    console.error("GET /tournaments/:id/players error", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* ------------- POST: inscribir jugadores con joinedRound automático ------------- */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournamentId = params.id;
    let body: { playerIds?: string[]; playerId?: string } = {};
    try {
      body = await req.json();
    } catch {
      // ignore
    }

    const playerIds = Array.isArray(body.playerIds)
      ? body.playerIds
      : body.playerId
      ? [body.playerId]
      : [];

    if (playerIds.length === 0) {
      return NextResponse.json(
        { error: "Debes indicar 'playerIds' (string[]) o 'playerId' (string)" },
        { status: 400 }
      );
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        rounds: {
          orderBy: { number: "asc" },
          select: { id: true, number: true, startDate: true, endDate: true, isClosed: true },
        },
      },
    });
    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    const now = new Date();
    const rounds = tournament.rounds;
    const first = rounds[0] ?? null;
    const last = rounds[rounds.length - 1] ?? null;
    const active = rounds.find((r) => r.startDate <= now && now <= r.endDate && !r.isClosed);
    const upcoming = rounds
      .filter((r) => r.startDate > now && !r.isClosed)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];

    let targetJoinedRoundNumber: number;
    if (first && now < first.startDate) targetJoinedRoundNumber = 1;
    else if (active) targetJoinedRoundNumber = active.number + 1;
    else if (upcoming) targetJoinedRoundNumber = upcoming.number;
    else if (last) targetJoinedRoundNumber = last.number + 1;
    else targetJoinedRoundNumber = 1;

    const results: Array<{ playerId: string; joinedRound?: number; status: string; reason?: string }> = [];

    for (const pid of playerIds) {
      const playerExists = await prisma.player.findUnique({ where: { id: pid }, select: { id: true } });
      if (!playerExists) {
        results.push({ playerId: pid, status: "skipped", reason: "Jugador inexistente" });
        continue;
      }

      const existing = await prisma.tournamentPlayer.findUnique({
        where: { tournamentId_playerId: { tournamentId, playerId: pid } },
        select: { joinedRound: true },
      });

      if (existing) {
        const current = existing.joinedRound ?? 1;
        const next = Math.min(current, targetJoinedRoundNumber); // nunca elevamos el umbral si ya era anterior
        const updated = await prisma.tournamentPlayer.update({
          where: { tournamentId_playerId: { tournamentId, playerId: pid } },
          data: { joinedRound: next },
          select: { playerId: true, joinedRound: true },
        });
        results.push({ playerId: updated.playerId, joinedRound: updated.joinedRound, status: "updated" });
      } else {
        const created = await prisma.tournamentPlayer.create({
          data: { tournamentId, playerId: pid, joinedRound: targetJoinedRoundNumber },
          select: { playerId: true, joinedRound: true },
        });
        results.push({ playerId: created.playerId, joinedRound: created.joinedRound, status: "created" });
      }
    }

    return NextResponse.json({ ok: true, tournamentId, targetJoinedRoundNumber, results });
  } catch (err: any) {
    console.error("POST /tournaments/:id/players error", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* ---- DELETE (fallback con ?playerId=... para mantener compatibilidad en UI) ---- */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const url = new URL(req.url);
    const playerId = url.searchParams.get("playerId") ?? "";
    if (!playerId) {
      return NextResponse.json(
        { error: "Falta 'playerId'. Usa /api/tournaments/:id/players/:playerId o /api/tournaments/:id/players?playerId=..." },
        { status: 400 }
      );
    }

    // Reutilizamos la misma lógica del handler de :playerId
    // 1) Validar inscripción
    const tp = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId: params.id, playerId } },
      select: { playerId: true },
    });
    if (!tp) {
      return NextResponse.json({ error: "Inscripción no encontrada" }, { status: 404 });
    }

    // 2) Rondas abiertas
    const rounds = await prisma.round.findMany({
      where: { tournamentId: params.id },
      select: { id: true, isClosed: true },
    });
    const openRoundIds = rounds.filter((r) => !r.isClosed).map((r) => r.id);

    if (openRoundIds.length > 0) {
      const setsCount = await prisma.match.count({
        where: {
          group: { roundId: { in: openRoundIds } },
          OR: [
            { team1Player1Id: playerId },
            { team1Player2Id: playerId },
            { team2Player1Id: playerId },
            { team2Player2Id: playerId },
          ],
        },
      });
      if (setsCount > 0) {
        return NextResponse.json(
          { error: "No se puede eliminar: el jugador tiene partidos en rondas no cerradas." },
          { status: 409 }
        );
      }
    }

    // 3) Eliminar de grupos + TournamentPlayer
    const groups = await prisma.group.findMany({
      where: { round: { tournamentId: params.id } },
      select: { id: true },
    });
    const groupIds = groups.map((g: { id: string }) => g.id);

    await prisma.$transaction(async (tx) => {
      if (groupIds.length > 0) {
        await tx.groupPlayer.deleteMany({
          where: { groupId: { in: groupIds }, playerId },
        });
      }
      await tx.tournamentPlayer.delete({
        where: { tournamentId_playerId: { tournamentId: params.id, playerId } },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /tournaments/:id/players (fallback) error", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
