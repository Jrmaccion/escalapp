import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Movement = "up" | "down" | "stay" | "new" | "absent";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const tournamentId = params.id;

  // Rondas del torneo (asc)
  const rounds = await prisma.round.findMany({
    where: { tournamentId },
    orderBy: { number: "asc" },
    select: { id: true, number: true, startDate: true, endDate: true, isClosed: true },
  });

  if (rounds.length === 0) {
    return NextResponse.json({ rounds: [], players: [] });
  }

  // Para cada ronda, mapa playerId -> groupNumber
  const byRound: Record<number, Map<string, number>> = {};
  const playersMap = new Map<string, { playerId: string; name: string }>();

  for (const r of rounds) {
    const gps = await prisma.group.findMany({
      where: { roundId: r.id },
      select: {
        number: true,
        players: {
          select: {
            playerId: true,
            player: { select: { name: true } },
          },
        },
      },
      orderBy: { number: "asc" },
    });

    const map = new Map<string, number>();
    for (const g of gps) {
      for (const p of g.players) {
        map.set(p.playerId, g.number);
        playersMap.set(p.playerId, { playerId: p.playerId, name: p.player.name });
      }
    }
    byRound[r.number] = map;
  }

  // Construimos el histórico de cada jugador
  const players = [...playersMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const payload = players.map((pl) => {
    const history: Array<{ round: number; group: number | null; movement: Movement }> = [];
    let prevGroup: number | null = null;

    for (const r of rounds) {
      const currentGroup = byRound[r.number].get(pl.playerId) ?? null;
      let movement: Movement = "absent";
      if (currentGroup === null) {
        movement = prevGroup === null ? "absent" : "absent";
      } else if (prevGroup === null) {
        movement = "new";
      } else if (currentGroup < prevGroup) {
        movement = "up";
      } else if (currentGroup > prevGroup) {
        movement = "down";
      } else {
        movement = "stay";
      }
      history.push({ round: r.number, group: currentGroup, movement });
      prevGroup = currentGroup;
    }

    return { playerId: pl.playerId, name: pl.name, history };
  });

  return NextResponse.json({
    rounds: rounds.map((r) => ({
      number: r.number,
      startDate: r.startDate,
      endDate: r.endDate,
      isClosed: r.isClosed,
    })),
    players: payload,
  });
}
