// app/api/player/dashboard/route.ts - MODIFICADO PARA INCLUIR GRUPO COMPLETO
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PartyManager } from "@/lib/party-manager";
import { logger } from "@/lib/logger";
import {
  withErrorHandling,
  requireAuth,
  createSuccessResponse,
  ApiErrorCode,
  throwApiError
} from "@/lib/api-errors";

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

  // Ordenar por fecha de inicio asc (si no hay fecha, al final)
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
  return withErrorHandling(async () => {
    logger.apiRequest("GET", "/api/player/dashboard");

    const session = await getServerSession(authOptions);
    requireAuth(session);

    logger.debug("Usuario autenticado", { email: session.user.email });

    // CRÍTICO: Obtener el playerId desde la tabla Player
    const player = await prisma.player.findUnique({
      where: { userId: session.user.id },
      select: { id: true, name: true }
    });

    if (!player) {
      logger.debug("No se encontró perfil de jugador", { userId: session.user.id });
      throwApiError(
        ApiErrorCode.NOT_FOUND,
        "No se encontró perfil de jugador asociado a tu cuenta"
      );
    }

    const playerId = player.id;
    logger.debug("Jugador encontrado", { playerId, name: player.name });

    const url = new URL(request.url);
    const tournamentIdParam = url.searchParams.get("tournamentId");
    logger.debug("Torneo solicitado via parámetro", { tournamentId: tournamentIdParam || "ninguno" });

    // Traer TODOS los torneos activos donde participa el jugador
    const tournaments = await prisma.tournament.findMany({
      where: {
        isActive: true,
        players: { some: { playerId } },
      },
      include: {
        rounds: {
          orderBy: { number: "asc" },
          select: { id: true, number: true, startDate: true, endDate: true, isClosed: true },
        },
      },
      orderBy: { startDate: "desc" } // Más recientes primero
    });

    logger.debug("Torneos encontrados", {
      count: tournaments.length,
      tournaments: tournaments.map(t => ({ id: t.id, title: t.title }))
    });

    // Preparar lista de torneos disponibles para el frontend
    const availableTournaments = tournaments.map(t => {
      const meta = computeTournamentMeta(t);
      const isCurrent = !!meta.current && !meta.current.isClosed;
      
      return {
        id: t.id,
        title: t.title,
        isActive: t.isActive,
        isCurrent: isCurrent
      };
    });

    logger.debug("Torneos disponibles preparados", { count: availableTournaments.length });

    if (!tournaments.length) {
      logger.debug("Usuario no participa en ningún torneo activo");
      return NextResponse.json({
        activeTournament: null,
        availableTournaments: [],
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

    // Elegir torneo específico o determinar automáticamente
    let activeTournament: typeof tournaments[0];

    if (tournamentIdParam) {
      // Buscar el torneo específico solicitado
      const requestedTournament = tournaments.find(t => t.id === tournamentIdParam);
      if (requestedTournament) {
        logger.debug("Usando torneo específico solicitado", { title: requestedTournament.title });
        activeTournament = requestedTournament;
      } else {
        logger.debug("Torneo solicitado no encontrado, usando lógica automática");
        activeTournament = tournaments[0]; // Fallback
      }
    } else {
      // Lógica automática para elegir torneo
      logger.debug("Aplicando lógica automática para seleccionar torneo");
      
      activeTournament =
        // Preferir el que tenga una ronda "activa por fecha"
        tournaments.find((t) => {
          const meta = computeTournamentMeta(t);
          const r = meta.current;
          if (!r?.startDate || !r?.endDate) return false;
          const now = new Date();
          const isActiveByDate = !r.isClosed && r.startDate <= now && now <= r.endDate;
          if (isActiveByDate) {
            logger.debug("Torneo con ronda activa por fecha", { title: t.title });
          }
          return isActiveByDate;
        }) ||
        // Si ninguno activo ahora, el que tenga la PRÓXIMA ronda más cercana
        (() => {
          logger.debug("Buscando torneo con próxima ronda más cercana");
          const scored = tournaments
            .map((t) => {
              const upcoming = [...t.rounds]
                .filter((r) => !r.isClosed && r.startDate && new Date(r.startDate) > new Date())
                .sort((a, b) => (a.startDate!.getTime() - b.startDate!.getTime()));
              return { t, nextStart: upcoming[0]?.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER };
            })
            .sort((a, b) => a.nextStart - b.nextStart);

          if (scored[0]?.nextStart !== Number.MAX_SAFE_INTEGER) {
            logger.debug("Torneo con próxima ronda más cercana", { title: scored[0].t.title });
          }
          return scored[0]?.t;
        })() ||
        // Último recurso: el primero de la lista
        tournaments[0];
    }

    logger.debug("Torneo seleccionado final", { title: activeTournament.title });

    const meta = computeTournamentMeta(activeTournament);
    const currentRound = meta.current;

    logger.debug("Ronda actual", { roundNumber: currentRound?.number || "ninguna" });

    // ✅ GRUPO ACTUAL AMPLIADO - Incluir información completa del grupo
    const currentGroup = currentRound
      ? await prisma.group.findFirst({
          where: {
            roundId: currentRound.id,
            players: { some: { playerId } },
          },
          include: {
            players: {
              include: { player: true },
              orderBy: { points: "desc" }, // Ordenar por puntos para calcular posiciones reales
            },
            round: true, // Para obtener el número de ronda
          },
        })
      : null;

    logger.debug("Grupo actual", { groupNumber: currentGroup?.number || "ninguno" });

    const playerInGroup = currentGroup?.players.find((p) => p.playerId === playerId) ?? null;
    logger.debug("Posición en grupo", { position: playerInGroup?.position || "sin posición" });

    // ✅ CALCULAR POSICIONES REALES basadas en puntos
    const sortedByPoints = currentGroup?.players
      .slice()
      .sort((a, b) => (b.points || 0) - (a.points || 0)) || [];

    const realPosition = sortedByPoints.findIndex(p => p.playerId === playerId) + 1;

    // Party actual (si existe)
    let currentParty = null;
    if (currentGroup) {
      try {
        currentParty = await PartyManager.getParty(currentGroup.id, playerId);
        logger.debug("Party encontrado", { status: currentParty?.status || "ninguno" });
      } catch (error) {
        logger.debug("Error obteniendo party", { error });
      }
    }

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

    logger.debug("Matches encontrados", { count: myMatches.length });

    // ✅ OPTIMIZACIÓN: Reutilizar nombres de jugadores del grupo ya cargado
    // Esto elimina una consulta N+1 adicional
    const nameById = currentGroup
      ? currentGroup.players.reduce<Record<string, string>>((acc, gp) => {
          acc[gp.playerId] = gp.player.name;
          return acc;
        }, {})
      : {};

    // Si faltan jugadores (caso edge), cargar solo los faltantes
    const knownPlayerIds = new Set(Object.keys(nameById));
    const allPlayerIds = new Set(
      myMatches.flatMap((m) => [m.team1Player1Id, m.team1Player2Id, m.team2Player1Id, m.team2Player2Id])
    );
    const missingPlayerIds = Array.from(allPlayerIds).filter(id => !knownPlayerIds.has(id));

    if (missingPlayerIds.length > 0) {
      logger.debug("Cargando jugadores faltantes", { count: missingPlayerIds.length });
      const additionalPlayers = await prisma.player.findMany({
        where: { id: { in: missingPlayerIds } },
        select: { id: true, name: true }
      });
      additionalPlayers.forEach(p => {
        nameById[p.id] = p.name;
      });
    }

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
        // Ignorar errores de party individuales
      }
    }

    const partyWinRate = partiesPlayed > 0 ? Math.round((partiesWon / partiesPlayed) * 100) : 0;

    // Ranking (último calculado para este torneo)
    const latestRanking = await prisma.ranking.findFirst({
      where: { tournamentId: activeTournament.id, playerId },
      orderBy: { roundNumber: "desc" },
    });

    logger.debug("Ranking encontrado", { position: latestRanking?.position || "sin ranking" });

    // Calcular matches pendientes
    const matchesPending = formattedMatches.filter(m => 
      m.team1Games === null && m.team2Games === null
    ).length;

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
      
      // CRÍTICO: Incluir availableTournaments para el selector
      availableTournaments,
      
      // ✅ GRUPO ACTUAL AMPLIADO con información completa
      currentGroup: currentGroup
        ? {
            id: currentGroup.id,
            number: currentGroup.number,
            level: currentGroup.level,
            position: realPosition || playerInGroup?.position || 0,
            points: playerInGroup?.points || 0,
            streak: playerInGroup?.streak || 0,
            // ✅ NUEVOS CAMPOS PARA EL DASHBOARD
            roundNumber: currentGroup.round.number,
            members: sortedByPoints.map((gp, index) => ({
              playerId: gp.playerId,
              name: gp.player.name,
              position: index + 1, // Posición real basada en puntos
              points: gp.points || 0,
              streak: gp.streak || 0,
              isCurrentUser: gp.playerId === playerId,
            })),
            // Mantener compatibilidad con el formato anterior
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
        matchesPending: matchesPending,
        winRate: formattedMatches.filter((m) => m.isConfirmed).length > 0
          ? Math.round(
              (formattedMatches.filter((m) => {
                if (!m.isConfirmed || m.team1Games === null || m.team2Games === null) return false;
                
                const isTeam1 = nameById[m.team1Player1Name] === player.name || 
                               nameById[m.team1Player2Name] === player.name;
                const team1Won = m.team1Games > m.team2Games;
                return (isTeam1 && team1Won) || (!isTeam1 && !team1Won);
              }).length / formattedMatches.filter((m) => m.isConfirmed).length) * 100
            )
          : 0,
        currentStreak: playerInGroup?.streak || 0,
        partiesPlayed,
        partiesPending,
        partyWinRate,
        totalPartiesInTournament: allPlayerGroups.length,
      },
      
      _metadata: {
        partyApiVersion: "1.1",
        selectedTournamentId: activeTournament.id,
        hasMultipleTournaments: tournaments.length > 1,
        requestedTournamentId: tournamentIdParam,
        totalTournamentsAvailable: tournaments.length,
        groupInfoIncluded: !!currentGroup, // Nuevo flag para indicar si se incluye info del grupo
      },
    };

    logger.debug("Respuesta preparada exitosamente", { metadata: response._metadata });

    return createSuccessResponse(response);
  });
}