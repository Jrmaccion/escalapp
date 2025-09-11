// app/api/admin/tournaments/[id]/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const tournamentId = params.id;

    // Verificar que el torneo existe
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        rounds: {
          include: {
            groups: {
              include: {
                matches: true,
              },
            },
          },
        },
        players: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    // Calcular stats del torneo específico
    const roundsArr = tournament.rounds as any[];

    const totalMatches = roundsArr.reduce(
      (acc, round) => acc + round.groups.reduce((gAcc: any, g: any) => gAcc + (g.matches?.length ?? 0), 0),
      0
    );

    const confirmedMatches = roundsArr.reduce(
      (acc, round) => acc + round.groups.reduce(
        (gAcc: any, g: any) => gAcc + g.matches.filter((m: any) => !!m?.isConfirmed).length, 0
      ),
      0
    );

    const pendingMatches = totalMatches - confirmedMatches;

    // Stats de comodines específicas del torneo
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const comodinesAgg = await prisma.tournamentPlayer.aggregate({
      where: { tournamentId },
      _sum: { comodinesUsed: true },
    });
    const comodinesUsados = comodinesAgg._sum.comodinesUsed || 0;

    const suplentesActivos = await prisma.groupPlayer.count({
      where: {
        substitutePlayerId: { not: null },
        group: { round: { tournamentId, isClosed: false } },
      },
    });

    const gpsWithComodin = await prisma.groupPlayer.findMany({
      where: {
        usedComodin: true,
        group: { round: { tournamentId, isClosed: false } },
      },
      select: { id: true, playerId: true, group: { select: { roundId: true } } },
    });

    const revocableChecks = await Promise.all(
      gpsWithComodin.map(async (gp) => {
        const blockingMatch = await prisma.match.findFirst({
          where: {
            group: { roundId: gp.group.roundId },
            AND: [
              {
                OR: [
                  { team1Player1Id: gp.playerId },
                  { team1Player2Id: gp.playerId },
                  { team2Player1Id: gp.playerId },
                  { team2Player2Id: gp.playerId },
                ],
              },
              {
                OR: [{ isConfirmed: true }, { acceptedDate: { lte: twentyFourHoursFromNow } }],
              },
            ],
          },
          select: { id: true },
        });
        return !blockingMatch;
      })
    );
    const revocables = revocableChecks.filter(Boolean).length;
    const mediaUsados = Math.round((comodinesUsados / Math.max(tournament.players.length, 1)) * 100) / 100;

    const stats = {
      totalPlayers: tournament.players.length,
      totalRounds: roundsArr.length,
      activeRounds: roundsArr.filter((r: any) => !r.isClosed).length,
      totalMatches,
      confirmedMatches,
      pendingMatches,
      comodinesUsados,
      suplentesActivos,
      revocables,
      mediaUsados,
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error("[ADMIN_TOURNAMENT_STATS] error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}