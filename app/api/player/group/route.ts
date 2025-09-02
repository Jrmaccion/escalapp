// app/api/player/group/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

// --- Puntuación por jugador en un set (juegos +1 por set ganado) ---
function pointsForPlayerInMatch(m: any, playerId: string) {
  const t1 = typeof m.team1Games === "number" ? m.team1Games : null;
  const t2 = typeof m.team2Games === "number" ? m.team2Games : null;
  if (t1 == null || t2 == null) return 0;

  const inT1 = [m.team1Player1Id, m.team1Player2Id].includes(playerId);
  const inT2 = [m.team2Player1Id, m.team2Player2Id].includes(playerId);
  if (!inT1 && !inT2) return 0;

  let pts = inT1 ? t1 : t2; // juegos ganados
  const won = (inT1 && t1 > t2) || (inT2 && t2 > t1);
  if (won) pts += 1; // bonus set ganado
  return pts;
}

// --- Vista de partido (set) para la UI ---
function buildMatchView(m: any, nameById: Map<string, string>) {
  const hasResult = m.team1Games != null && m.team2Games != null;
  const acceptedCount = Array.isArray(m.acceptedBy) ? m.acceptedBy.length : 0;

  return {
    id: m.id,
    setNumber: m.setNumber ?? 0,
    partner: "", // si quieres mostrar compañero/oponentes, puedes derivarlo en client con los ids
    opponents: [],

    hasResult,
    isPending: !hasResult && !m.isConfirmed,
    isConfirmed: !!m.isConfirmed,

    status: m.status ?? (m.acceptedDate ? "SCHEDULED" : m.proposedDate ? "DATE_PROPOSED" : "PENDING"),
    proposedDate: m.proposedDate ? new Date(m.proposedDate).toISOString() : null,
    acceptedDate: m.acceptedDate ? new Date(m.acceptedDate).toISOString() : null,
    acceptedCount,

    team1Player1Name: nameById.get(m.team1Player1Id ?? "") ?? "Jugador 1",
    team1Player2Name: nameById.get(m.team1Player2Id ?? "") ?? "Jugador 2",
    team2Player1Name: nameById.get(m.team2Player1Id ?? "") ?? "Jugador 3",
    team2Player2Name: nameById.get(m.team2Player2Id ?? "") ?? "Jugador 4",

    team1Games: m.team1Games ?? null,
    team2Games: m.team2Games ?? null,
  };
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
      // Fallback por userId o email -> Player se vincula por relación 'user'
      const userId = (session.user as any).id ?? null;
      const email = session.user.email ?? null;

      // Primero por userId (rápido)
      const byUser =
        userId
          ? await prisma.player.findUnique({
              where: { userId }, // Player tiene userId (relación con User)
              select: { id: true },
            })
          : null;

      // Si no está por userId, buscamos por la relación con User.email
      const byEmail =
        !byUser && email
          ? await prisma.player.findFirst({
              where: { user: { email } }, // <- NO usamos Player.email (no existe), usamos la relación
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

    // 2) Torneos del jugador vía TournamentPlayer (incluimos tournament para decidir)
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

    // Elegimos torneo activo (si hay); si no, el más reciente por startDate
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
        players: { include: { player: true }, orderBy: { position: "asc" } },
        matches: true,
      },
    });

    // Fallback: si aún no lo han asignado en la ronda actual, buscar su último grupo dentro del torneo
    if (!group) {
      group = await prisma.group.findFirst({
        where: { round: { tournamentId }, players: { some: { playerId } } },
        include: {
          round: { include: { tournament: { select: { title: true } } } },
          players: { include: { player: true }, orderBy: { position: "asc" } },
          matches: true,
        },
        orderBy: { id: "desc" }, // último grupo que lo contenga
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

    // 5) Map de nombres por playerId
    const nameById = new Map<string, string>();
    group.players.forEach((gp) => nameById.set(gp.playerId, gp.player?.name ?? "Jugador"));

    // 6) Puntos por jugador (sumando sets del grupo)
    const pointsMap = new Map<string, number>();
    group.players.forEach((gp) => pointsMap.set(gp.playerId, 0));
    (group.matches ?? []).forEach((m) => {
      group.players.forEach((gp) => {
        pointsMap.set(
          gp.playerId,
          (pointsMap.get(gp.playerId) || 0) + pointsForPlayerInMatch(m, gp.playerId)
        );
      });
    });

    // 7) Sets en los que participa el jugador (para allMatches/nextMatches)
    const myMatches = (group.matches ?? []).filter((m) =>
      [m.team1Player1Id, m.team1Player2Id, m.team2Player1Id, m.team2Player2Id].includes(playerId!)
    );

    // Completar nombres de jugadores externos (por seguridad)
    const extIds = new Set<string>();
    myMatches.forEach((m) => {
      [m.team1Player1Id, m.team1Player2Id, m.team2Player1Id, m.team2Player2Id].forEach((pid) => {
        if (pid && !nameById.has(pid)) extIds.add(pid);
      });
    });
    if (extIds.size > 0) {
      const extra = await prisma.player.findMany({
        where: { id: { in: Array.from(extIds) } },
        select: { id: true, name: true },
      });
      extra.forEach((p) => nameById.set(p.id, p.name));
    }

    const allMatches = myMatches
      .slice()
      .sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0))
      .map((m) => buildMatchView(m, nameById));

    const currentGp = group.players.find((gp) => gp.playerId === playerId);

    return NextResponse.json({
      hasGroup: true,
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
        position: currentGp?.position ?? 0,
        points: pointsMap.get(playerId!) ?? 0,
        streak: 0, // si luego quieres racha real, la sacamos de ranking.ts
      },
      players: group.players.map((gp) => ({
        id: gp.playerId,
        name: gp.player?.name ?? "Jugador",
        points: pointsMap.get(gp.playerId) ?? 0,
        position: gp.position,
        isCurrentUser: gp.playerId === playerId,
      })),
      allMatches,
      nextMatches: allMatches.filter((m) => !m.isConfirmed),
    });
  } catch (error: any) {
    console.error("[/api/player/group] error:", error);
    return NextResponse.json(
      { hasGroup: false, message: error?.message ?? "Error interno del servidor" },
      { status: 500 }
    );
  }
}
