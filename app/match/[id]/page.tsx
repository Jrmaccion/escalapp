// app/match/[id]/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MatchDetailClient from "./MatchDetailClient";
import { MatchData } from "@/types/match";

type MatchPageProps = {
  params: { id: string };
};

export const metadata = { title: "Partido | Escalapp" };

async function getMatchData(matchId: string) {
  try {
    return await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        group: {
          include: {
            players: {
              include: { player: { select: { id: true, name: true } } },
              orderBy: { position: "asc" },
            },
            round: {
              include: {
                tournament: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    });
  } catch {
    return null;
  }
}

async function getPlayerNames(playerIds: string[]) {
  try {
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
    });
    return players.reduce(
      (acc, p) => {
        acc[p.id] = p.name;
        return acc;
      },
      {} as Record<string, string>
    );
  } catch {
    return {};
  }
}

export default async function MatchPage({ params }: MatchPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");

  const match = await getMatchData(params.id);
  if (!match) notFound();

  const playerId = session.user.playerId;
  const isAdmin = session.user.isAdmin;
  const isPlayerInMatch =
    playerId &&
    [
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id,
    ].includes(playerId);

  if (!isAdmin && !isPlayerInMatch) redirect("/dashboard");

  // recolectar todos los ids de jugadores implicados para mapear nombres
  const ids = [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id,
    match.reportedById ?? "",
    match.confirmedById ?? "",
    ...match.group.players.map((gp) => gp.playerId),
  ].filter(Boolean);

  const playerNames = await getPlayerNames(Array.from(new Set(ids)));

  const reportedByName = match.reportedById
    ? playerNames[match.reportedById] || "Jugador desconocido"
    : undefined;
  const confirmedByName = match.confirmedById
    ? playerNames[match.confirmedById] || "Jugador desconocido"
    : undefined;

  // construimos el objeto que espera MatchDetailClient con defaults seguros
  const matchData = {
    id: match.id,
    setNumber: match.setNumber,
    team1Player1Id: match.team1Player1Id,
    team1Player1Name:
      playerNames[match.team1Player1Id] || "Jugador desconocido",
    team1Player2Id: match.team1Player2Id,
    team1Player2Name:
      playerNames[match.team1Player2Id] || "Jugador desconocido",
    team2Player1Id: match.team2Player1Id,
    team2Player1Name:
      playerNames[match.team2Player1Id] || "Jugador desconocido",
    team2Player2Id: match.team2Player2Id,
    team2Player2Name:
      playerNames[match.team2Player2Id] || "Jugador desconocido",
    team1Games: match.team1Games,
    team2Games: match.team2Games,
    tiebreakScore: match.tiebreakScore,
    isConfirmed: match.isConfirmed,
    reportedById: match.reportedById,
    reportedByName,
    confirmedById: match.confirmedById,
    confirmedByName,
    photoUrl: match.photoUrl,

    // programación del partido (scheduling)
    status: (match.status as
      | "PENDING"
      | "DATE_PROPOSED"
      | "SCHEDULED"
      | "COMPLETED") ?? "PENDING",
    proposedDate: match.proposedDate
      ? match.proposedDate.toISOString()
      : null,
    acceptedDate: match.acceptedDate
      ? match.acceptedDate.toISOString()
      : null,
    acceptedBy: match.acceptedBy ?? [],
    proposedById: match.proposedById ?? null,

    group: {
      id: match.group.id,
      number: match.group.number,
      level: match.group.level,
      players: match.group.players.map((gp) => ({
        id: gp.playerId,
        name: playerNames[gp.playerId] || "Jugador desconocido",
        position: gp.position,
      })),
      round: {
        id: match.group.round.id,
        number: match.group.round.number,
        startDate: match.group.round.startDate.toISOString(),
        endDate: match.group.round.endDate.toISOString(),
        isClosed: match.group.round.isClosed,
      },
    },
    round: {
      id: match.group.round.id,
      number: match.group.round.number,
      startDate: match.group.round.startDate.toISOString(),
      endDate: match.group.round.endDate.toISOString(),
      isClosed: match.group.round.isClosed,
    },
    tournament: {
      id: match.group.round.tournament.id,
      title: match.group.round.tournament.title,
    },
  };

  return (
    <MatchDetailClient
      match={matchData}
      currentPlayerId={playerId}
      isAdmin={isAdmin}
    />
  );
}
