// app/api/player/dashboard/route.ts - Selección de ronda por fecha + multi-torneo + PartyManager
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PartyManager } from "@/lib/party-manager";

export const dynamic = "force-dynamic";

function pickCurrentRound(rounds: Array<{
  id: string;
  number: number;
  startDate: Date | null;
  endDate: Date | null;
  isClosed: boolean;
}>) {
  if (!rounds || rounds.length === 0) return null;
  const now = new Date();

  // ordenar por fecha de inicio asc (si no hay fecha, al final)
  const byStartAsc = [...rounds].sort((a, b) => {
    const aT = a.startDate ? new Date(a.startDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bT = b.startDate ? new Date(b.startDate).getTime() : Number.MAX_SAFE_INTEGER;
    return aT - bT;
  });

  // 1) ACTIVA por fecha (now entre start y end) y no cerrada
  const active = byStartAsc.find(
    (r) =>
      !r.isClosed &&
      r.startDate &&
      r.endDate &&
      new Date(r.startDate) <= now &&
      now <= new Date(r.endDate)
  );
  if (active) return active;

  // 2) PRÓXIMA (no cerrada) con startDate futura más cercana
  const upcoming = byStartAsc.find(
    (r) => !r.isClosed && r.startDate && new Date(r.startDate) > now
  );
  if (upcoming) return upcoming;

  // 3) Si no hay fechas, la primera no cerrada
  const firstNotClosed = byStartAsc.find((r) => !r.isClosed);
  if (firstNotClosed) return firstNotClosed;

  // 4) Último recurso: la última por número
  return [...rounds].sort((a, b) => a.number - b.number).at(-1) ?? null;
}

function computeTournamentMeta(
  t: {
    id: string;
    title: string;
    totalRounds: number;
    rounds: { id: string; number: number; startDate: Date | null; endDate: Date | null; isClosed: boolean }[];
  }
) {
  const current = pickCurrentRound(t.rounds);
  const totalRounds = Number(t.totalRounds ?? t.rounds.length ?? 0);
  const currentRoundNumber = Number(current?.number ?? 0);

  const now = Date.now();
  const endMs = current?.endDate ? new Date(current.endDate).getTime() : now;
  const daysLeft = Math.max(0, Math.ceil((endMs - now) / (1000 * 60 * 60 * 24)));

  const progressPct =
    totalRounds > 0 ? Math.min(100, Math.max(0, Math.round((currentRoundNumber / totalRounds) * 100))) : 0;

  return { current, totalRounds, currentRoundNumber, daysLeft, progressPct };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.playerId) {
      return NextResponse.json({ error: "No autorizado o no es un jugador" }, { status: 401 });
    }

    const playerId = session.user.playerId;
    const url = new URL(request.url);
    const tournamentIdParam = url.searchParams.get("tournamentId");

    // Traer TODOS los torneos activos donde participa el jugador
    const tournaments = await prisma.tournament.findMany({
      where: {
        isActive: true,
        players: { some: { playerId } },
      },
      include: {
        rounds: {
          orderBy: { number: "asc" }, // orden natural
          select: { id: true, number: true, startDate: true, endDate: true, isClosed: true },
        },
      },
    });

    if (!tournaments.length) {
      return NextResponse.json({
        activeTournament: null,
        currentGroup: null,
        myMatches: [],
        party: null,
        ranking: null,
        stats: {
          matchesPlayed: 0,
          matchesPending: 0,
          winRate: 0,
          currentStreak: 0,
          partiesPlayed: 0,
          partiesPending: 0,
          partyWinRate: 0,
          totalPartiesInTournament: 0,
        },
      });
    }

    // Elegir torneo:
    let activeTournament =
      (tournamentIdParam && tournaments.find((t) => t.id === tournamentIdParam)) ||
      // Preferimos el que tenga una ronda "activa por fecha"
      tournaments.find((t) => {
        const meta = computeTournamentMeta(t);
        const r = meta.current;
        if (!r?.startDate || !r?.endDate) return false;
        const now = new Date();
        return !r.isClosed && r.startDate <= now && now <= r.endDate;
      }) ||
      // Si ninguno activo ahora, el que tenga la PRÓXIMA ronda más cercana
      (() => {
        const scored = tournaments
          .map((t) => {
            const upc = [...t.rounds]
              .filter((r) => !r.isClosed && r.startDate && new Date(r.startDate) > new Date())
              .sort((a, b) => (a.startDate!.getTime() - b.startDate!.getTime()));
            return { t, nextStart: upc[0]?.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER };
          })
          .sort((a, b) => a.nextStart - b.nextStart);
        return scored[0]?.t;
      })() ||
      tournaments[0];

    const meta = computeTournamentMeta(activeTournament);
    const currentRound = meta.current;

    // Grupo actual del jugador en la ronda seleccionada
    const currentGroup = currentRound
      ? await prisma.group.findFirst({
          where: {
            roundId: currentRound.id,
            players: { some: { playerId } },
          },
          include: {
            players: {
              include: { player: true },
              orderBy: { points: "desc" },
            },
          },
        })
      : null;

    const playerInGroup = currentGroup?.players.find((p) => p.playerId === playerId) ?? null;

    // Party actual (si existe)
    const currentParty = currentGroup ? await PartyManager.getParty(currentGroup.id, playerId) : null;

    // Sets del jugador en la ronda (compatibilidad legacy)
    const myMatches = await prisma.match.findMany({
      where: {
        groupId: currentGroup?.id,
        OR: [
          { team1Player1Id: playerId },
          { team1Player2Id: playerId },
          { team2Player1Id: playerId },
          { team2Player2Id: playerId },
        ],
      },
      include: { group: true },
      orderBy: { setNumber: "asc" },
    });

    // Mapa de nombres para los matches
    const allIds = [
      ...new Set(
        myMatches.flatMap((m) => [m.team1Player1Id, m.team1Player2Id, m.team2Player1Id, m.team2Player2Id])
      ),
    ];
    const players = await prisma.player.findMany({ where: { id: { in: allIds } } });
    const nameById = players.reduce<Record<string, string>>((acc, p) => {
      acc[p.id] = p.name;
      return acc;
    }, {});
    const formattedMatches = myMatches.map((m) => ({
      id: m.id,
      setNumber: m.setNumber,
      team1Player1Name: nameById[m.team1Player1Id] || "Jugador desconocido",
      team1Player2Name: nameById[m.team1Player2Id] || "Jugador desconocido",
      team2Player1Name: nameById[m.team2Player1Id] || "Jugador desconocido",
      team2Player2Name: nameById[m.team2Player2Id] || "Jugador desconocido",
      team1Games: m.team1Games,
      team2Games: m.team2Games,
      tiebreakScore: m.tiebreakScore,
      isConfirmed: m.isConfirmed,
      reportedById: m.reportedById,
      groupNumber: m.group.number,
    }));

    // Estadísticas por partidos (PartyManager)
    const allPlayerGroups = await prisma.group.findMany({
      where: {
        round: { tournamentId: activeTournament.id },
        players: { some: { playerId } },
      },
      include: { round: true },
    });

    let partiesPlayed = 0;
    let partiesWon = 0;
    let partiesPending = 0;

    for (const g of allPlayerGroups) {
      try {
        const party = await PartyManager.getParty(g.id, playerId);
        if (!party) continue;
        if (party.status === "COMPLETED") {
          partiesPlayed++;
          let setsWon = 0;
          for (const s of party.sets) {
            if (s.isConfirmed && s.team1Games !== null && s.team2Games !== null) {
              const isTeam1 = s.team1Player1Id === playerId || s.team1Player2Id === playerId;
              const team1Won = s.team1Games > s.team2Games;
              if ((isTeam1 && team1Won) || (!isTeam1 && !team1Won)) setsWon++;
            }
          }
          if (setsWon >= 2) partiesWon++;
        } else if (["PENDING", "DATE_PROPOSED", "SCHEDULED"].includes(party.status)) {
          partiesPending++;
        }
      } catch {
        // ignorar errores de party individuales
      }
    }

    const partyWinRate = partiesPlayed > 0 ? Math.round((partiesWon / partiesPlayed) * 100) : 0;

    // Ranking (último calculado para este torneo)
    const latestRanking = await prisma.ranking.findFirst({
      where: { tournamentId: activeTournament.id, playerId },
      orderBy: { roundNumber: "desc" },
    });

    const response = {
      activeTournament: currentRound
        ? {
            id: activeTournament.id,
            title: activeTournament.title,
            currentRound: currentRound.number,
            totalRounds: activeTournament.totalRounds,
            roundEndDate: currentRound.endDate ? currentRound.endDate.toISOString() : new Date().toISOString(),
          }
        : null,
      currentGroup: currentGroup
        ? {
            id: currentGroup.id,
            number: currentGroup.number,
            level: currentGroup.level,
            position: playerInGroup?.position || 0,
            points: playerInGroup?.points || 0,
            streak: playerInGroup?.streak || 0,
            players: currentGroup.players.map((p) => ({
              id: p.playerId,
              name: p.player.name,
              position: p.position,
              points: p.points,
            })),
          }
        : null,
      myMatches: formattedMatches,
      party: currentParty
        ? {
            id: `party-${currentGroup?.id}`,
            groupId: currentGroup?.id,
            groupNumber: currentGroup?.number,
            status: currentParty.status,
            proposedDate: currentParty.proposedDate,
            acceptedDate: currentParty.acceptedDate,
            needsAction: currentParty.status === "DATE_PROPOSED" && !currentParty.acceptedDate,
            needsScheduling: currentParty.status === "PENDING",
            canPlay: currentParty.status === "SCHEDULED",
            completedSets: currentParty.completedSets,
            totalSets: 3,
            progress: Math.round((currentParty.completedSets / 3) * 100),
            sets: currentParty.sets.map((set: any) => ({
              setNumber: set.setNumber,
              isConfirmed: set.isConfirmed,
              hasResult: set.team1Games !== null && set.team2Games !== null,
            })),
          }
        : null,
      ranking: latestRanking
        ? {
            position: latestRanking.position,
            averagePoints: latestRanking.averagePoints,
            totalPoints: latestRanking.totalPoints,
            roundsPlayed: latestRanking.roundsPlayed,
            ironmanPosition: latestRanking.ironmanPosition,
          }
        : null,
      stats: {
        matchesPlayed: formattedMatches.filter((m) => m.isConfirmed).length,
        matchesPending: formattedMatches.filter((m) => !m.isConfirmed).length,
        winRate:
          formattedMatches.filter((m) => m.isConfirmed).length > 0
            ? Math.round(
                (formattedMatches.filter((m) => {
                  const isTeam1 =
                    nameById[m.team1Player1Name] === nameById[playerId] ||
                    nameById[m.team1Player2Name] === nameById[playerId];
                  const team1Won = (m.team1Games || 0) > (m.team2Games || 0);
                  return (isTeam1 && team1Won) || (!isTeam1 && !team1Won);
                }).length /
                  formattedMatches.filter((m) => m.isConfirmed).length) *
                  100
              )
            : 0,
        currentStreak: playerInGroup?.streak || 0,
        partiesPlayed,
        partiesPending,
        partyWinRate,
        totalPartiesInTournament: allPlayerGroups.length,
      },
      _metadata: {
        partyApiVersion: "1.0",
        selectedTournamentId: activeTournament.id,
        hasMultipleTournaments: tournaments.length > 1,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching player dashboard:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
