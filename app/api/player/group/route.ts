// app/api/player/group/route.ts - ACTUALIZADO PARA USAR PARTYMANAGER

import { NextResponse } from "next/server";
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

// --- Selección de ronda "actual" con fallbacks: en fecha, si no abierta, si no la última ---
function pickCurrentRound(
  rounds: Array<{ id: string; number: number; startDate: Date; endDate: Date; isClosed: boolean }>
) {
  const now = new Date();
  const byNumberAsc = rounds.slice().sort((a, b) => a.number - b.number);

  const inWindow = byNumberAsc.find((r) => !r.isClosed && inDayRange(now, r.startDate, r.endDate));
  if (inWindow) return inWindow;

  const anyOpen = byNumberAsc.find((r) => !r.isClosed);
  if (anyOpen) return anyOpen;

  return byNumberAsc[byNumberAsc.length - 1]; // última como fallback
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ hasGroup: false, message: "No autenticado" }, { status: 401 });
    }

    // 1) Resolver playerId de forma robusta
    let playerId: string | null = (session.user as any).playerId ?? null;

    if (!playerId) {
      const userId = (session.user as any).id ?? null;
      const email = session.user.email ?? null;

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
        return NextResponse.json(
          { hasGroup: false, message: "No hay jugador asociado al usuario actual" },
          { status: 200 }
        );
      }
      playerId = resolved.id;
    }

    // 2) Torneos del jugador vía TournamentPlayer
    const tps = await prisma.tournamentPlayer.findMany({
      where: { playerId },
      include: {
        tournament: {
          select: { id: true, title: true, isActive: true, startDate: true },
        },
      },
    });

    if (tps.length === 0) {
      return NextResponse.json(
        { hasGroup: false, message: "No estás inscrito en ningún torneo" },
        { status: 200 }
      );
    }

    // Elegimos torneo activo
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

    const tournament = recentTp.tournament!;
    const tournamentId = tournament.id;

    // 3) Rondas del torneo
    const rounds = await prisma.round.findMany({
      where: { tournamentId },
      orderBy: { number: "asc" },
      select: { id: true, number: true, startDate: true, endDate: true, isClosed: true },
    });

    if (rounds.length === 0) {
      return NextResponse.json(
        {
          hasGroup: false,
          tournament: { title: tournament.title, currentRound: 0 },
          message: "El torneo aún no tiene rondas",
        },
        { status: 200 }
      );
    }

    const current = pickCurrentRound(rounds);

    // 4) Grupo del jugador en la ronda "current"
    let group = await prisma.group.findFirst({
      where: { roundId: current.id, players: { some: { playerId } } },
      include: {
        round: { include: { tournament: { select: { title: true } } } },
        players: { 
          include: { player: true }, 
          orderBy: { points: 'desc' }
        },
        matches: true,
      },
    });

    // Fallback: buscar último grupo dentro del torneo
    if (!group) {
      group = await prisma.group.findFirst({
        where: { round: { tournamentId }, players: { some: { playerId } } },
        include: {
          round: { include: { tournament: { select: { title: true } } } },
          players: { 
            include: { player: true }, 
            orderBy: { points: 'desc' }
          },
          matches: true,
        },
        orderBy: { id: "desc" },
      });

      if (!group) {
        return NextResponse.json(
          {
            hasGroup: false,
            tournament: { title: tournament.title, currentRound: current.number },
            message: "No estás asignado a ningún grupo en este torneo",
          },
          { status: 200 }
        );
      }
    }

    // 5) NUEVO: Usar PartyManager para obtener datos unificados de partido
    const partyData = await PartyManager.getParty(group.id, playerId);

    if (!partyData) {
      return NextResponse.json(
        {
          hasGroup: false,
          tournament: { title: tournament.title, currentRound: current.number },
          message: "No se pudo obtener información del partido",
        },
        { status: 200 }
      );
    }

    // 6) Map de nombres por playerId
    const nameById = new Map<string, string>();
    group.players.forEach((gp) => nameById.set(gp.playerId, gp.player?.name ?? "Jugador"));

    // 7) Puntos reales de la base de datos
    const pointsMap = new Map<string, number>();
    group.players.forEach((gp) => pointsMap.set(gp.playerId, gp.points || 0));

    const currentGp = group.players.find((gp) => gp.playerId === playerId);

    // 8) Calcular posiciones dinámicamente basadas en puntos reales
    const sortedByPoints = group.players
      .slice()
      .sort((a, b) => (b.points || 0) - (a.points || 0));

    // 9) NUEVO: Formatear datos del partido para compatibilidad con UI existente
    const partyForUI = {
      id: `party-${group.id}`,
      groupId: group.id,
      status: partyData.status,
      proposedDate: partyData.proposedDate,
      acceptedDate: partyData.acceptedDate,
      acceptedCount: partyData.acceptedCount,
      needsScheduling: partyData.status === 'PENDING' || partyData.status === 'DATE_PROPOSED',
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
    };

    return NextResponse.json({
      hasGroup: true,
      roundId: group.round.id,
      tournament: {
        title: group.round.tournament.title,
        currentRound: group.round.number,
      },
      group: {
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
      
      // NUEVO: Datos unificados de partido (reemplaza allMatches/nextMatches)
      party: partyForUI,
      
      // LEGACY: Mantenemos compatibilidad pero marcamos como deprecated
      allMatches: partyForUI.sets, // Para compatibilidad temporal
      nextMatches: partyForUI.sets.filter(s => !s.isConfirmed), // Para compatibilidad temporal
      
      // NUEVO: Metadatos útiles
      _metadata: {
        usePartyData: true, // Indica al cliente que use party en lugar de allMatches
        partyApiVersion: "1.0",
        hasPartyScheduling: true
      }
    });

  } catch (error: any) {
    console.error("[/api/player/group] error:", error);
    return NextResponse.json(
      { hasGroup: false, message: error?.message ?? "Error interno del servidor" },
      { status: 500 }
    );
  }
}