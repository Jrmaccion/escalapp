// app/api/comodin/round-stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/comodin/round-stats?roundId=...
 * Solo admin. Devuelve contadores y lista de jugadores (con/sin comodín),
 * con datos suficientes para revocar y mostrar motivos/restricciones.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isAdmin = (session?.user as any)?.isAdmin === true;
    if (!isAdmin) return NextResponse.json({ error: "Solo admins" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get("roundId");
    if (!roundId) return NextResponse.json({ error: "Falta roundId" }, { status: 400 });

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        groups: {
          include: {
            players: {
              select: {
                id: true,
                playerId: true,
                usedComodin: true,
                substitutePlayerId: true,
                comodinReason: true,
                comodinAt: true,
                points: true,
                position: true,
                player: { select: { id: true, name: true } },
              },
              orderBy: { position: "asc" },
            },
            matches: {
              select: {
                id: true,
                acceptedDate: true,
                isConfirmed: true,
                team1Player1Id: true,
                team1Player2Id: true,
                team2Player1Id: true,
                team2Player2Id: true,
              },
            },
          },
          orderBy: { number: "asc" },
        },
      },
    });

    if (!round) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    // Mapa nombre de suplentes
    const subIds = new Set<string>();
    for (const g of round.groups) {
      for (const gp of g.players) if (gp.substitutePlayerId) subIds.add(gp.substitutePlayerId);
    }
    const subs = subIds.size
      ? await prisma.player.findMany({
          where: { id: { in: Array.from(subIds) } },
          select: { id: true, name: true },
        })
      : [];
    const subNameById = new Map(subs.map((s) => [s.id, s.name]));

    // Agregados de partidos por jugador para restricciones
    type Agg = { confirmed: number; upcoming: number; nextDate: Date | null };
    const byPlayer = new Map<string, Agg>();
    const now = new Date();
    const limit = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    for (const g of round.groups) {
      for (const m of g.matches) {
        const ids = [
          m.team1Player1Id,
          m.team1Player2Id,
          m.team2Player1Id,
          m.team2Player2Id,
        ].filter(Boolean) as string[];
        for (const pid of ids) {
          const rec = byPlayer.get(pid) ?? { confirmed: 0, upcoming: 0, nextDate: null };
          if (m.isConfirmed) rec.confirmed += 1;
          if (m.acceptedDate) {
            const d = new Date(m.acceptedDate);
            if (d <= limit) {
              rec.upcoming += 1;
              if (!rec.nextDate || d < rec.nextDate) rec.nextDate = d;
            }
          }
          byPlayer.set(pid, rec);
        }
      }
    }

    const players = round.groups.flatMap((g) =>
      g.players.map((gp) => {
        const agg = byPlayer.get(gp.playerId) ?? { confirmed: 0, upcoming: 0, nextDate: null };
        const canRevoke = gp.usedComodin && agg.upcoming === 0 && agg.confirmed === 0 && !round.isClosed;

        let restrictionReason: string | null = null;
        if (gp.usedComodin && !canRevoke) {
          if (round.isClosed) {
            restrictionReason = "La ronda está cerrada";
          } else if (agg.confirmed > 0) {
            restrictionReason = "Ya tienes partidos con resultados confirmados";
          } else if (agg.upcoming > 0 && agg.nextDate) {
            restrictionReason = `Tienes partidos programados en menos de 24 horas (${agg.nextDate.toLocaleString(
              "es-ES"
            )})`;
          }
        }

        return {
          playerId: gp.playerId,
          playerName: gp.player.name,
          groupNumber: (g as any).number as number,
          usedComodin: gp.usedComodin,
          comodinMode: gp.usedComodin ? (gp.substitutePlayerId ? "substitute" : "mean") : undefined,
          substitutePlayerName: gp.substitutePlayerId ? subNameById.get(gp.substitutePlayerId) ?? null : null,
          points: Number(gp.points ?? 0),
          comodinReason: gp.comodinReason,
          appliedAt: gp.comodinAt ? gp.comodinAt.toISOString() : null,
          canRevoke,
          restrictionReason,
        };
      })
    );

    const totalPlayers = players.length;
    const withComodin = players.filter((p) => p.usedComodin).length;
    const revocables = players.filter((p) => p.canRevoke).length;

    return NextResponse.json({
      roundId,
      totalPlayers,
      withComodin,
      revocables,
      players,
    });
  } catch (err) {
    console.error("[ROUND_STATS] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
