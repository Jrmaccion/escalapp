// app/api/player/group/route.ts - MEJORADO CON SELECTOR DE TORNEO Y MEJOR DEBUGGING

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PartyManager } from "@/lib/party-manager";

// --- Utils de fecha (día completo) ---
function inDayRange(date: Date, start: Date, end: Date) {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
  return date >= s && date <= e;
}

// --- Selección de ronda "actual" con fallbacks mejorada ---
function pickCurrentRound(
  rounds: Array<{ id: string; number: number; startDate: Date; endDate: Date; isClosed: boolean }>
) {
  const now = new Date();
  const byNumberAsc = rounds.slice().sort((a, b) => a.number - b.number);

  // 1. Buscar ronda en ventana de tiempo actual (no cerrada)
  const inWindow = byNumberAsc.find((r) => !r.isClosed && inDayRange(now, r.startDate, r.endDate));
  if (inWindow) {
    console.log(`[pickCurrentRound] Encontrada ronda en ventana: ${inWindow.number}`);
    return inWindow;
  }

  // 2. Buscar cualquier ronda abierta
  const anyOpen = byNumberAsc.find((r) => !r.isClosed);
  if (anyOpen) {
    console.log(`[pickCurrentRound] Encontrada ronda abierta: ${anyOpen.number}`);
    return anyOpen;
  }

  // 3. Última ronda como fallback
  const last = byNumberAsc[byNumberAsc.length - 1];
  console.log(`[pickCurrentRound] Usando última ronda como fallback: ${last?.number || 'ninguna'}`);
  return last;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ hasGroup: false, message: "No autenticado" }, { status: 401 });
    }

    // Parámetro opcional para seleccionar torneo específico
    const { searchParams } = new URL(request.url);
    const requestedTournamentId = searchParams.get('tournamentId');

    console.log(`[/api/player/group] Iniciando para usuario: ${session.user.email}`);
    console.log(`[/api/player/group] Torneo solicitado: ${requestedTournamentId || 'automático'}`);

    // 1) Resolver playerId de forma robusta
    let playerId: string | null = (session.user as any).playerId ?? null;

    if (!playerId) {
      const userId = (session.user as any).id ?? null;
      const email = session.user.email ?? null;

      console.log(`[/api/player/group] Resolviendo playerId. UserId: ${userId}, Email: ${email}`);

      const byUser =
        userId
          ? await prisma.player.findUnique({
              where: { userId },
              select: { id: true },
            })
          : null;

      const byEmail =
        !byUser && email
          ? await prisma.player.findFirst({
              where: { user: { email } },
              select: { id: true },
            })
          : null;

      const resolved = byUser ?? byEmail;
      if (!resolved) {
        console.log(`[/api/player/group] No se encontró jugador para el usuario`);
        return NextResponse.json(
          { hasGroup: false, message: "No hay jugador asociado al usuario actual" },
          { status: 200 }
        );
      }
      playerId = resolved.id;
    }

    console.log(`[/api/player/group] PlayerId resuelto: ${playerId}`);

    // 2) Torneos del jugador vía TournamentPlayer
    const tps = await prisma.tournamentPlayer.findMany({
      where: { playerId },
      include: {
        tournament: {
          select: { 
            id: true, 
            title: true, 
            isActive: true, 
            startDate: true, 
            endDate: true,
            totalRounds: true 
          },
        },
      },
    });

    console.log(`[/api/player/group] Encontrados ${tps.length} torneos para el jugador`);

    if (tps.length === 0) {
      return NextResponse.json(
        { 
          hasGroup: false, 
          message: "No estás inscrito en ningún torneo",
          availableTournaments: []
        },
        { status: 200 }
      );
    }

    // 3) Selección de torneo (permitir selección manual o automática)
    let selectedTournament;
    
    if (requestedTournamentId) {
      // Torneo específico solicitado
      selectedTournament = tps.find(tp => tp.tournament?.id === requestedTournamentId)?.tournament;
      if (!selectedTournament) {
        console.log(`[/api/player/group] Torneo solicitado ${requestedTournamentId} no encontrado`);
        return NextResponse.json(
          { 
            hasGroup: false, 
            message: `No tienes acceso al torneo solicitado`,
            availableTournaments: tps.map(tp => ({
              id: tp.tournament?.id,
              title: tp.tournament?.title,
              isActive: tp.tournament?.isActive
            }))
          },
          { status: 200 }
        );
      }
    } else {
      // Selección automática: torneo activo más reciente
      const activeTp = tps
        .filter((tp) => tp.tournament?.isActive)
        .sort((a, b) => {
          const da = a.tournament?.startDate ? new Date(a.tournament.startDate).getTime() : 0;
          const db = b.tournament?.startDate ? new Date(b.tournament.startDate).getTime() : 0;
          return db - da;
        })[0];

      const recentTp =
        activeTp ??
        tps
          .slice()
          .sort((a, b) => {
            const da = a.tournament?.startDate ? new Date(a.tournament.startDate).getTime() : 0;
            const db = b.tournament?.startDate ? new Date(b.tournament.startDate).getTime() : 0;
            return db - da;
          })[0];

      selectedTournament = recentTp.tournament!;
    }

    const tournamentId = selectedTournament.id;
    console.log(`[/api/player/group] Torneo seleccionado: ${selectedTournament.title} (${tournamentId})`);

    // 4) Rondas del torneo
    const rounds = await prisma.round.findMany({
      where: { tournamentId },
      orderBy: { number: "asc" },
      select: { id: true, number: true, startDate: true, endDate: true, isClosed: true },
    });

    console.log(`[/api/player/group] Encontradas ${rounds.length} rondas. Estados:`, 
      rounds.map(r => `R${r.number}:${r.isClosed ? 'cerrada' : 'abierta'}`).join(', '));

    if (rounds.length === 0) {
      return NextResponse.json(
        {
          hasGroup: false,
          tournament: { 
            id: tournamentId,
            title: selectedTournament.title, 
            currentRound: 0 
          },
          availableTournaments: tps.map(tp => ({
            id: tp.tournament?.id,
            title: tp.tournament?.title,
            isActive: tp.tournament?.isActive
          })),
          message: "El torneo aún no tiene rondas",
        },
        { status: 200 }
      );
    }

    const current = pickCurrentRound(rounds);
    console.log(`[/api/player/group] Ronda actual seleccionada: ${current.number} (${current.id})`);

    // 5) Grupo del jugador en la ronda "current"
    let group = await prisma.group.findFirst({
      where: { roundId: current.id, players: { some: { playerId } } },
      include: {
        round: { include: { tournament: { select: { title: true } } } },
        players: { 
          include: { player: true }, 
          orderBy: { points: 'desc' }
        },
        matches: {
          orderBy: { setNumber: 'asc' }
        },
      },
    });

    // Fallback: buscar último grupo dentro del torneo
    if (!group) {
      console.log(`[/api/player/group] No encontrado grupo en ronda ${current.number}, buscando en todo el torneo`);
      
      group = await prisma.group.findFirst({
        where: { round: { tournamentId }, players: { some: { playerId } } },
        include: {
          round: { include: { tournament: { select: { title: true } } } },
          players: { 
            include: { player: true }, 
            orderBy: { points: 'desc' }
          },
          matches: {
            orderBy: { setNumber: 'asc' }
          },
        },
        orderBy: { round: { number: 'desc' } },
      });

      if (!group) {
        console.log(`[/api/player/group] No se encontró grupo en ninguna ronda del torneo`);
        return NextResponse.json(
          {
            hasGroup: false,
            tournament: { 
              id: tournamentId,
              title: selectedTournament.title, 
              currentRound: current.number 
            },
            availableTournaments: tps.map(tp => ({
              id: tp.tournament?.id,
              title: tp.tournament?.title,
              isActive: tp.tournament?.isActive
            })),
            message: "No estás asignado a ningún grupo en este torneo",
          },
          { status: 200 }
        );
      }
    }

    console.log(`[/api/player/group] Grupo encontrado: ${group.number} en ronda ${group.round.number}`);

    // 6) NUEVO: Usar PartyManager para obtener datos unificados de partido
    const partyData = await PartyManager.getParty(group.id, playerId);

    if (!partyData) {
      console.log(`[/api/player/group] Error obteniendo datos del partido via PartyManager`);
      // Continuar sin party data (fallback a legacy)
    } else {
      console.log(`[/api/player/group] Party data obtenido exitosamente. Status: ${partyData.status}`);
    }

    // 7) Map de nombres por playerId
    const nameById = new Map<string, string>();
    group.players.forEach((gp) => nameById.set(gp.playerId, gp.player?.name ?? "Jugador"));

    // 8) Puntos reales de la base de datos
    const pointsMap = new Map<string, number>();
    group.players.forEach((gp) => pointsMap.set(gp.playerId, gp.points || 0));

    const currentGp = group.players.find((gp) => gp.playerId === playerId);

    // 9) Calcular posiciones dinámicamente basadas en puntos reales
    const sortedByPoints = group.players
      .slice()
      .sort((a, b) => (b.points || 0) - (a.points || 0));

    // 10) NUEVO: Formatear datos del partido para compatibilidad con UI existente
    const partyForUI = partyData ? {
      id: `party-${group.id}`,
      groupId: group.id,
      status: partyData.status,
      proposedDate: partyData.proposedDate?.toISOString() || null,
      acceptedDate: partyData.acceptedDate?.toISOString() || null,
      acceptedCount: partyData.acceptedCount,
      needsScheduling: partyData.status === 'PENDING',
      canSchedule: partyData.canSchedule,
      allSetsCompleted: partyData.status === 'COMPLETED',
      completedSets: partyData.completedSets,
      totalSets: 3,
      sets: partyData.sets.map(set => ({
        id: set.id,
        setNumber: set.setNumber,
        team1Player1Name: nameById.get(set.team1Player1Id) || "Jugador",
        team1Player2Name: nameById.get(set.team1Player2Id) || "Jugador", 
        team2Player1Name: nameById.get(set.team2Player1Id) || "Jugador",
        team2Player2Name: nameById.get(set.team2Player2Id) || "Jugador",
        team1Games: set.team1Games,
        team2Games: set.team2Games,
        tiebreakScore: set.tiebreakScore,
        isConfirmed: set.isConfirmed,
        hasResult: set.team1Games !== null && set.team2Games !== null,
        isPending: !set.isConfirmed && (set.team1Games === null || set.team2Games === null)
      }))
    } : null;

    // 11) Legacy fallback data para compatibilidad
    const legacyMatches = group.matches.map(match => ({
      id: match.id,
      setNumber: match.setNumber,
      team1Player1Name: nameById.get(match.team1Player1Id) || "Jugador",
      team1Player2Name: nameById.get(match.team1Player2Id) || "Jugador",
      team2Player1Name: nameById.get(match.team2Player1Id) || "Jugador",
      team2Player2Name: nameById.get(match.team2Player2Id) || "Jugador",
      team1Games: match.team1Games,
      team2Games: match.team2Games,
      tiebreakScore: match.tiebreakScore,
      isConfirmed: match.isConfirmed,
      hasResult: match.team1Games !== null && match.team2Games !== null,
      isPending: !match.isConfirmed && (match.team1Games === null || match.team2Games === null),
      status: match.status,
      proposedDate: match.proposedDate?.toISOString() || null,
      acceptedDate: match.acceptedDate?.toISOString() || null,
      acceptedCount: (match.acceptedBy || []).length
    }));

    console.log(`[/api/player/group] Preparando respuesta. Party data: ${partyForUI ? 'disponible' : 'no disponible'}`);

    // 12) Respuesta final
    const response = {
      hasGroup: true,
      roundId: group.round.id,
      tournament: {
        id: tournamentId,
        title: group.round.tournament.title,
        currentRound: group.round.number,
        totalRounds: selectedTournament.totalRounds || 0,
      },
      group: {
        id: group.id, // ✅ NUEVO: ID real del grupo
        number: group.number,
        level: `Nivel ${group.level}`,
        totalPlayers: group.players.length,
      },
      myStatus: {
        position: sortedByPoints.findIndex(gp => gp.playerId === playerId) + 1,
        points: pointsMap.get(playerId!) ?? 0,
        streak: currentGp?.streak || 0,
      },
      players: sortedByPoints.map((gp, index) => ({
        id: gp.playerId,
        name: gp.player?.name ?? "Jugador",
        points: gp.points || 0,
        position: index + 1,
        isCurrentUser: gp.playerId === playerId,
      })),
      
      // ✅ NUEVO: Datos unificados de partido (si disponible)
      ...(partyForUI && { party: partyForUI }),
      
      // ✅ NUEVO: Lista de torneos disponibles para selector
      availableTournaments: tps.map(tp => ({
        id: tp.tournament?.id,
        title: tp.tournament?.title,
        isActive: tp.tournament?.isActive,
        isCurrent: tp.tournament?.id === tournamentId
      })),
      
      // LEGACY: Mantenemos compatibilidad
      allMatches: partyForUI?.sets || legacyMatches,
      nextMatches: (partyForUI?.sets || legacyMatches).filter(s => !s.isConfirmed),
      
      // ✅ NUEVO: Metadatos útiles
      _metadata: {
        usePartyData: !!partyForUI,
        partyApiVersion: "1.0",
        hasPartyScheduling: !!partyForUI,
        tournamentSelectionEnabled: tps.length > 1,
        roundSelectionMethod: group.round.id === current.id ? 'current' : 'fallback',
        debug: process.env.NODE_ENV === 'development' ? {
          playerId,
          tournamentId,
          groupId: group.id,
          roundId: group.round.id,
          roundNumber: group.round.number,
          currentRoundId: current.id,
          currentRoundNumber: current.number,
          availableTournamentCount: tps.length
        } : undefined
      }
    };

    console.log(`[/api/player/group] Respuesta preparada exitosamente`);
    return NextResponse.json(response);

  } catch (error: any) {
    console.error("[/api/player/group] Error completo:", error);
    return NextResponse.json(
      { 
        hasGroup: false, 
        message: error?.message ?? "Error interno del servidor",
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}