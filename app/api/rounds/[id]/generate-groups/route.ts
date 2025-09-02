import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getEligiblePlayersForRound,
  buildGroupsForFirstRound,
  GROUP_SIZE,
} from "@/lib/rounds";

type Payload = {
  groupSize?: number;
  force?: boolean;
};

type GroupRow = { id: string; number: number };
type GroupPlayerInsert = { groupId: string; playerId: string; position: number };

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const roundId = decodeURIComponent(params.id);

  let body: Payload = {};
  try {
    body = (await req.json()) as Payload;
  } catch {}

  const groupSize = Math.max(2, body.groupSize ?? GROUP_SIZE);
  const force = Boolean(body.force);

  try {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: { select: { id: true, title: true } },
        groups: { include: { players: true, matches: true } },
      },
    });

    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }
    if (round.isClosed) {
      return NextResponse.json({ error: "La ronda ya está cerrada" }, { status: 400 });
    }

    const hasGroups = (round.groups?.length ?? 0) > 0;
    if (hasGroups && !force) {
      return NextResponse.json({
        ok: true,
        message: "La ronda ya tenía grupos. Usa { force: true } para regenerar.",
        roundId: round.id,
        tournamentId: round.tournament.id,
        groupsCount: round.groups.length,
      });
    }

    const elegibles = await getEligiblePlayersForRound(round.tournament.id, round.number);
    if (elegibles.length === 0) {
      return NextResponse.json(
        { error: "No hay jugadores elegibles para generar grupos." },
        { status: 400 }
      );
    }

    const groupsData = buildGroupsForFirstRound(elegibles, groupSize);

    const result = await prisma.$transaction(async (tx: any) => {
      // Si hay grupos previos y force=true, borrarlos (partidos incluidos)
      if (hasGroups && force) {
        const groupIds = round.groups.map((g: { id: string }) => g.id);
        if (groupIds.length) {
          await tx.match.deleteMany({ where: { groupId: { in: groupIds } } });
          await tx.groupPlayer.deleteMany({ where: { groupId: { in: groupIds } } });
          await tx.group.deleteMany({ where: { id: { in: groupIds } } });
        }
      }

      await tx.group.createMany({
        data: groupsData.map((g) => ({
          number: g.number,
          level: g.level ?? 0,
          roundId: round.id,
        })),
      });

      const createdGroups: GroupRow[] = await tx.group.findMany({
        where: { roundId: round.id },
        orderBy: { number: "asc" },
        select: { id: true, number: true },
      });

      const byNumber = new Map<number, string>(
        createdGroups.map((g: GroupRow) => [g.number, g.id])
      );

      const gpInserts: GroupPlayerInsert[] = [];
      for (const g of groupsData) {
        const groupId = byNumber.get(g.number);
        if (!groupId) continue;
        for (const p of g.players) {
          gpInserts.push({ groupId, playerId: p.playerId, position: p.position });
        }
      }

      if (gpInserts.length) {
        await tx.groupPlayer.createMany({ data: gpInserts });
      }

      return {
        createdGroups: createdGroups.length,
        createdPlayers: gpInserts.length,
      };
    });

    return NextResponse.json({
      ok: true,
      message: "Grupos generados correctamente",
      roundId: round.id,
      tournamentId: round.tournament.id,
      groupSize,
      ...result,
    });
  } catch (error) {
    console.error("Error generando grupos:", error);
    return NextResponse.json({ error: "Error interno generando grupos" }, { status: 500 });
  }
}
