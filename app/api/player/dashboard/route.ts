// app/api/player/dashboard/route.ts - CORREGIDO
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
  try {
    console.log("🏁 GET /api/player/dashboard - Iniciando...");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log("❌ Usuario no autenticado");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    console.log("👤 Usuario autenticado:", session.user.email);

    // CRÍTICO: Obtener el playerId desde la tabla Player
    const player = await prisma.player.findUnique({
      where: { userId: session.user.id },
      select: { id: true, name: true }
    });

    if (!player) {
      console.log("❌ No se encontró perfil de jugador para userId:", session.user.id);
      return NextResponse.json({ error: "No es un jugador registrado" }, { status: 401 });
    }

    const playerId = player.id;
    console.log("🎮 Jugador encontrado:", playerId, "-", player.name);

    const url = new URL(request.url);
    const tournamentIdParam = url.searchParams.get("tournamentId");
    console.log("🎯 Torneo solicitado via parámetro:", tournamentIdParam || "ninguno");

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

    console.log(`🏆 Torneos encontrados: ${tournaments.length}`);
    tournaments.forEach(t => {
      console.log(`  - ${t.title} (${t.id})`);
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

    console.log("📋 Torneos disponibles preparados:", availableTournaments.length);

    if (!tournaments.length) {
      console.log("⚠️ Usuario no participa en ningún torneo activo");
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
        console.log("✅ Usando torneo específico solicitado:", requestedTournament.title);
        activeTournament = requestedTournament;
      } else {
        console.log("⚠️ Torneo solicitado no encontrado, usando lógica automática");
        activeTournament = tournaments[0]; // Fallback
      }
    } else {
      // Lógica automática para elegir torneo
      console.log("🤖 Aplicando lógica automática para seleccionar torneo...");
      
      activeTournament =
        // Preferir el que tenga una ronda "activa por fecha"
        tournaments.find((t) => {
          const meta = computeTournamentMeta(t);
          const r = meta.current;
          if (!r?.startDate || !r?.endDate) return false;
          const now = new Date();
          const isActiveByDate = !r.isClosed && r.startDate <= now && now <= r.endDate;
          if (isActiveByDate) {
            console.log(`  ✅ Torneo ${t.title} tiene ronda activa por fecha`);
          }
          return isActiveByDate;
        }) ||
        // Si ninguno activo ahora, el que tenga la PRÓXIMA ronda más cercana
        (() => {
          console.log("🔍 Buscando torneo con próxima ronda más cercana...");
          const scored = tournaments
            .map((t) => {
              const upcoming = [...t.rounds]
                .filter((r) => !r.isClosed && r.startDate && new Date(r.startDate) > new Date())
                .sort((a, b) => (a.startDate!.getTime() - b.startDate!.getTime()));
              return { t, nextStart: upcoming[0]?.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER };
            })
            .sort((a, b) => a.nextStart - b.nextStart);
          
          if (scored[0]?.nextStart !== Number.MAX_SAFE_INTEGER) {
            console.log(`  ✅ Torneo ${scored[0].t.title} tiene la próxima ronda más cercana`);
          }
          return scored[0]?.t;
        })() ||
        // Último recurso: el primero de la lista
        tournaments[0];
    }

    console.log("🎯 Torneo seleccionado final:", activeTournament.title);

    const meta = computeTournamentMeta(activeTournament);
    const currentRound = meta.current;

    console.log("🔄 Ronda actual:", currentRound?.number || "ninguna");

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

    console.log("👥 Grupo actual:", currentGroup?.number || "ninguno");

    const playerInGroup = currentGroup?.players.find((p) => p.playerId === playerId) ?? null;
    console.log("📍 Posición en grupo:", playerInGroup?.position || "sin posición");

    // Party actual (si existe)
    let currentParty = null;
    if (currentGroup) {
      try {
        currentParty = await PartyManager.getParty(currentGroup.id, playerId);
        console.log("🎉 Party encontrado:", currentParty?.status || "ninguno");
      } catch (error) {
        console.log("⚠️ Error obteniendo party:", error);
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

    console.log("🏓 Matches encontrados:", myMatches.length);

    // Mapa de nombres para los matches
    const allPlayerIds = [
      ...new Set(
        myMatches.flatMap((m) => [m.team1Player1Id, m.team1Player2Id, m.team2Player1Id, m.team2Player2Id])
      ),
    ];
    
    const matchPlayers = await prisma.player.findMany({ 
      where: { id: { in: allPlayerIds } },
      select: { id: true, name: true }
    });
    
    const nameById = matchPlayers.reduce<Record<string, string>>((acc, p) => {
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
        // Ignorar errores de party individuales
      }
    }

    const partyWinRate = partiesPlayed > 0 ? Math.round((partiesWon / partiesPlayed) * 100) : 0;

    // Ranking (último calculado para este torneo)
    const latestRanking = await prisma.ranking.findFirst({
      where: { tournamentId: activeTournament.id, playerId },
      orderBy: { roundNumber: "desc" },
    });

    console.log("📊 Ranking encontrado:", latestRanking?.position || "sin ranking");

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
        partyApiVersion: "1.0",
        selectedTournamentId: activeTournament.id,
        hasMultipleTournaments: tournaments.length > 1,
        requestedTournamentId: tournamentIdParam,
        totalTournamentsAvailable: tournaments.length,
      },
    };

    console.log("✅ Respuesta preparada exitosamente");
    console.log("📋 Metadata:", response._metadata);
    
    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Error en GET /api/player/dashboard:", error);
    return NextResponse.json(
      { 
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    );
  }
}