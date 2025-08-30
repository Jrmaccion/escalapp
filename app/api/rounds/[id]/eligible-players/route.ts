import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEligiblePlayersForRound } from "@/lib/rounds";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const round = await prisma.round.findUnique({ where: { id: params.id } });
  if (!round) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

  const players = await getEligiblePlayersForRound(round.tournamentId, round.number);
  return NextResponse.json({ players });
}
