import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const round = await prisma.round.findUnique({
    where: { id: params.id },
    include: {
      groups: {
        select: {
          id: true,
          number: true,
          matches: {
            select: {
              id: true,
              setNumber: true,
              isConfirmed: true,
              team1Player1Id: true,
              team1Player2Id: true,
              team2Player1Id: true,
              team2Player2Id: true,
              team1Games: true,
              team2Games: true,
              tiebreakScore: true,
            },
            orderBy: { setNumber: "asc" },
          },
        },
        orderBy: { number: "asc" },
      },
    },
  });

  if (!round) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

  const matches = round.groups.flatMap((g) =>
    g.matches.map((m) => ({
      id: m.id,
      groupId: g.id,
      groupNumber: g.number,
      setNumber: m.setNumber ?? null,
      isConfirmed: !!m.isConfirmed,
      team1Player1Id: m.team1Player1Id,
      team1Player2Id: m.team1Player2Id,
      team2Player1Id: m.team2Player1Id,
      team2Player2Id: m.team2Player2Id,
      team1Games: m.team1Games,
      team2Games: m.team2Games,
      tiebreakScore: m.tiebreakScore,
    }))
  );

  return NextResponse.json({ ok: true, matches });
}
