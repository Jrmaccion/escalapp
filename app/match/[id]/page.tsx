import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MatchDetailClient from "./MatchDetailClient";

type MatchPageProps = {
  params: {
    id: string;
  };
};

export const metadata = { title: "Partido | Escalapp" };

async function getMatchData(matchId: string) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        group: {
          include: {
            round: {
              include: {
                tournament: true
              }
            },
            players: {
              include: {
                player: true
              },
              orderBy: { position: 'asc' }
            }
          }
        }
      }
    });

    return match;
  } catch (error) {
    console.error("Error fetching match data:", error);
    return null;
  }
}

async function getPlayerNames(playerIds: string[]) {
  try {
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } }
    });
    
    return players.reduce((acc, player) => {
      acc[player.id] = player.name;
      return acc;
    }, {} as Record<string, string>);
  } catch (error) {
    console.error("Error fetching player names:", error);
    return {};
  }
}

export default async function MatchPage({ params }: MatchPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/login");
  }

  const match = await getMatchData(params.id);
  if (!match) {
    notFound();
  }

  // Verificar permisos: admin o jugador participante
  const playerId = session.user.playerId;
  const isAdmin = session.user.isAdmin;
  const isPlayerInMatch = playerId && [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id
  ].includes(playerId);

  if (!isAdmin && !isPlayerInMatch) {
    redirect("/dashboard");
  }

  // Obtener nombres de todos los jugadores
  const playerIds = [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id,
    ...match.group.players.map(p => p.playerId)
  ];
  
  const playerNames = await getPlayerNames(playerIds);

  // Obtener información de quién reportó/confirmó
  let reportedByName = null;
  let confirmedByName = null;

  if (match.reportedById) {
    reportedByName = playerNames[match.reportedById] || 'Jugador desconocido';
  }
  
  if (match.confirmedById) {
    confirmedByName = playerNames[match.confirmedById] || 'Jugador desconocido';
  }

  const matchData = {
    id: match.id,
    setNumber: match.setNumber,
    team1Player1Id: match.team1Player1Id,
    team1Player1Name: playerNames[match.team1Player1Id] || 'Jugador desconocido',
    team1Player2Id: match.team1Player2Id,
    team1Player2Name: playerNames[match.team1Player2Id] || 'Jugador desconocido',
    team2Player1Id: match.team2Player1Id,
    team2Player1Name: playerNames[match.team2Player1Id] || 'Jugador desconocido',
    team2Player2Id: match.team2Player2Id,
    team2Player2Name: playerNames[match.team2Player2Id] || 'Jugador desconocido',
    team1Games: match.team1Games,
    team2Games: match.team2Games,
    tiebreakScore: match.tiebreakScore,
    isConfirmed: match.isConfirmed,
    reportedById: match.reportedById,
    reportedByName,
    confirmedById: match.confirmedById,
    confirmedByName,
    photoUrl: match.photoUrl,
    group: {
      id: match.group.id,
      number: match.group.number,
      level: match.group.level,
      players: match.group.players.map(gp => ({
        id: gp.playerId,
        name: playerNames[gp.playerId] || 'Jugador desconocido',
        position: gp.position,
        points: gp.points,
        streak: gp.streak,
        usedComodin: gp.usedComodin
      }))
    },
    round: {
      id: match.group.round.id,
      number: match.group.round.number,
      startDate: match.group.round.startDate.toISOString(),
      endDate: match.group.round.endDate.toISOString(),
      isClosed: match.group.round.isClosed
    },
    tournament: {
      id: match.group.round.tournament.id,
      title: match.group.round.tournament.title
    }
  };

  return (
    <MatchDetailClient 
      match={matchData}
      currentPlayerId={playerId}
      isAdmin={isAdmin}
    />
  );
}