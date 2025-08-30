// app/api/rounds/[id]/generate-matches/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateRotationForGroup } from "@/lib/matches";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { force = false } = await req.json();
    const roundId = params.id;

    const groups = await prisma.group.findMany({
      where: { roundId },
      include: { players: true, matches: true },
      orderBy: { number: "asc" },
    });

    await prisma.$transaction(async (tx) => {
      for (const g of groups) {
        if (force && g.matches.length > 0) {
          await tx.match.deleteMany({ where: { groupId: g.id } });
        }
        if (g.matches.length === 0) {
          // Necesitamos EXACTAMENTE 4 jugadores por grupo para la rotación base
          const ordered = [...g.players].sort((a, b) => a.position - b.position);
          if (ordered.length >= 4) {
            // Solo generamos para el primer cuarteto
            await generateRotationForGroup(g.id, ordered.slice(0, 4).map(p => ({ id: p.playerId, position: p.position })));
          }
        }
      }
    });

    return NextResponse.json({ message: "Partidos generados correctamente" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error generando partidos" }, { status: 400 });
  }
}
