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

async function getMatchWithPartyData(matchId: string) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        group: {
          include: {
            players: {
              include: { player: { select: { id: true, name: true } } },
              orderBy: { position: "asc" },
            },
            matches: {
              orderBy: { setNumber: "asc" },
              select: {
                id: true,
                setNumber: true,
                team1Player1Id: true,
                team1Player2Id: true,
                team2Player1Id: true,
                team2Player2Id: true,
                team1Games: true,
                team2Games: true,
                isConfirmed: true,
                status: true,
                proposedDate: true,
                acceptedDate: true,
                acceptedBy: true,
                proposedById: true,
              }
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

    return match;
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

  const match = await getMatchWithPartyData(params.id);
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

  // Recolectar todos los ids de jugadores implicados para mapear nombres
  const allPlayerIds = new Set<string>();
  
  // Jugadores del match actual
  allPlayerIds.add(match.team1Player1Id);
  allPlayerIds.add(match.team1Player2Id);
  allPlayerIds.add(match.team2Player1Id);
  allPlayerIds.add(match.team2Player2Id);
  
  // Jugadores de todos los matches del grupo
  match.group.matches.forEach(m => {
    allPlayerIds.add(m.team1Player1Id);
    allPlayerIds.add(m.team1Player2Id);
    allPlayerIds.add(m.team2Player1Id);
    allPlayerIds.add(m.team2Player2Id);
  });
  
  // Otros jugadores mencionados
  if (match.reportedById) allPlayerIds.add(match.reportedById);
  if (match.confirmedById) allPlayerIds.add(match.confirmedById);
  
  match.group.players.forEach(gp => allPlayerIds.add(gp.playerId));

  const playerNames = await getPlayerNames(Array.from(allPlayerIds));

  const reportedByName = match.reportedById
    ? playerNames[match.reportedById] || "Jugador desconocido"
    : undefined;
  const confirmedByName = match.confirmedById
    ? playerNames[match.confirmedById] || "Jugador desconocido"
    : undefined;

  // Construir el objeto que espera MatchDetailClient con defaults seguros
  const matchData: MatchData = {
    id: match.id,
    setNumber: match.setNumber,
    team1Player1Id: match.team1Player1Id,
    team1Player1Name: playerNames[match.team1Player1Id] || "Jugador desconocido",
    team1Player2Id: match.team1Player2Id,
    team1Player2Name: playerNames[match.team1Player2Id] || "Jugador desconocido",
    team2Player1Id: match.team2Player1Id,
    team2Player1Name: playerNames[match.team2Player1Id] || "Jugador desconocido",
    team2Player2Id: match.team2Player2Id,
    team2Player2Name: playerNames[match.team2Player2Id] || "Jugador desconocido",
    team1Games: match.team1Games,
    team2Games: match.team2Games,
    tiebreakScore: match.tiebreakScore,
    isConfirmed: match.isConfirmed,
    reportedById: match.reportedById,
    reportedByName,
    confirmedById: match.confirmedById,
    confirmedByName,
    photoUrl: match.photoUrl,

    // Programación del partido (scheduling)
    status: (match.status as "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED") ?? "PENDING",
    proposedDate: match.proposedDate ? match.proposedDate.toISOString() : null,
    acceptedDate: match.acceptedDate ? match.acceptedDate.toISOString() : null,
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

  // Construir datos del partido completo para PartyScheduling
  const firstMatch = match.group.matches[0];
  const partyData = {
    groupId: match.group.id,
    groupNumber: match.group.number,
    roundNumber: match.group.round.number,
    players: Array.from(new Set([
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id,
    ])).map(id => playerNames[id] || "Jugador desconocido"),
    sets: match.group.matches.map(m => ({
      id: m.id,
      setNumber: m.setNumber,
      team1Player1Name: playerNames[m.team1Player1Id] || "Jugador desconocido",
      team1Player2Name: playerNames[m.team1Player2Id] || "Jugador desconocido",
      team2Player1Name: playerNames[m.team2Player1Id] || "Jugador desconocido",
      team2Player2Name: playerNames[m.team2Player2Id] || "Jugador desconocido",
      hasResult: m.team1Games !== null && m.team2Games !== null,
      isConfirmed: m.isConfirmed,
    })),
    scheduleStatus: (firstMatch?.status as 'PENDING' | 'DATE_PROPOSED' | 'SCHEDULED' | 'COMPLETED') || 'PENDING',
    proposedDate: firstMatch?.proposedDate?.toISOString() || null,
    acceptedDate: firstMatch?.acceptedDate?.toISOString() || null,
    proposedBy: firstMatch?.proposedById || null,
    acceptedCount: firstMatch?.acceptedBy?.length || 0,
    proposedByCurrentUser: firstMatch?.proposedById === session.user.id,
  };

  return (
    <MatchDetailClient
      match={matchData}
      currentPlayerId={playerId}
      currentUserId={session.user.id}
      isAdmin={isAdmin}
      partyData={partyData}
    />
  );
}