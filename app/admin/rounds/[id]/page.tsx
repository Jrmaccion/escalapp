import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEligiblePlayersForRound } from "@/lib/rounds";
import RoundDetailClient from "./RoundDetailClient";

/** Tipos ligeros solo para este fichero */
type RoundData = {
  id: string;
  number: number;
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  tournament: { id: string; title: string };
  groups: Array<{
    id: string;
    number: number;
    level: number | null;
    players: Array<{ position: number; player: { id: string; name: string } }>;
    matches: Array<{
      id: string;
      setNumber: number;
      team1Player1Id: string;
      team1Player2Id: string;
      team2Player1Id: string;
      team2Player2Id: string;
      team1Games: number | null;
      team2Games: number | null;
      tiebreakScore: string | null;
      isConfirmed: boolean;
      status: string | null;
    }>;
  }>;
};

async function getRoundData(roundId: string): Promise<RoundData | null> {
  try {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: { select: { id: true, title: true } },
        groups: {
          include: {
            players: {
              include: { player: { select: { id: true, name: true } } },
              orderBy: { position: "asc" },
            },
            matches: {
              orderBy: { setNumber: "asc" },
            },
          },
          orderBy: { number: "asc" },
        },
      },
    });
    return round as unknown as RoundData | null;
  } catch (e) {
    console.error("[rounds/[id]] getRoundData error:", e);
    return null;
  }
}

export default async function RoundDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  const round = await getRoundData(params.id);
  if (!round) notFound();

  const eligiblePlayers = await getEligiblePlayersForRound(
    round.tournament.id,
    round.number
  );

  return <RoundDetailClient round={round} eligiblePlayers={eligiblePlayers as any[]} />;
}
