// app/api/admin/results/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Filter =
  | "all"
  | "needs_review"
  | "pending"
  | "unplayed"
  | "confirmed"
  | "conflicts"
  | "active_rounds";

function toISO(d: Date | string) {
  return (d instanceof Date ? d : new Date(d)).toISOString();
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filter = (searchParams.get("filter") || "needs_review") as Filter;
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const tournamentId = searchParams.get("tournamentId") || undefined;

  // Traer torneos para el filtro del cliente
  const tournaments = await prisma.tournament.findMany({
    select: { id: true, title: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { title: "asc" }],
  });

  // Traer matches con datos de grupo/ronda/torneo
  const matches = await prisma.match.findMany({
    where: tournamentId
      ? { group: { round: { tournamentId } } }
      : undefined,
    include: {
      group: {
        include: {
          round: { include: { tournament: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  // Recopilar todos los playerIds para resolver nombres en un solo query
  const playerIds = new Set<string>();
  for (const m of matches) {
    if (m.team1Player1Id) playerIds.add(m.team1Player1Id);
    if (m.team1Player2Id) playerIds.add(m.team1Player2Id);
    if (m.team2Player1Id) playerIds.add(m.team2Player1Id);
    if (m.team2Player2Id) playerIds.add(m.team2Player2Id);
    if (m.reportedById) playerIds.add(m.reportedById);
    if (m.confirmedById) playerIds.add(m.confirmedById);
  }

  const players = await prisma.player.findMany({
    where: { id: { in: Array.from(playerIds) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  // Adaptar al formato que espera el cliente AdminResultsClient
  let adapted = matches.map((m) => {
    const round = m.group.round;
    const tournament = round.tournament;

    const reportedByName = m.reportedById ? nameById.get(m.reportedById) || null : null;
    const confirmedByName = m.confirmedById ? nameById.get(m.confirmedById) || null : null;

    return {
      id: m.id,
      setNumber: m.setNumber,
      team1Player1Name: nameById.get(m.team1Player1Id) || "—",
      team1Player2Name: nameById.get(m.team1Player2Id) || "—",
      team2Player1Name: nameById.get(m.team2Player1Id) || "—",
      team2Player2Name: nameById.get(m.team2Player2Id) || "—",
      team1Games: m.team1Games,
      team2Games: m.team2Games,
      tiebreakScore: m.tiebreakScore,
      isConfirmed: m.isConfirmed,
      reportedById: m.reportedById || null,
      reportedByName,
      confirmedById: m.confirmedById || null,
      confirmedByName,
      photoUrl: m.photoUrl || null,
      groupNumber: m.group.number,
      groupLevel: m.group.level,
      roundNumber: round.number,
      tournamentId: round.tournamentId,
      tournamentTitle: tournament.title,
      isRoundClosed: round.isClosed,
      roundEndDate: toISO(round.endDate),
      createdAt: toISO(m.createdAt),
    };
  });

  // Filtros del lado servidor (coinciden con el cliente)
  const now = Date.now();
  if (filter === "confirmed") {
    adapted = adapted.filter((m) => m.isConfirmed);
  } else if (filter === "pending") {
    adapted = adapted.filter(
      (m) => !m.isConfirmed && m.reportedById && m.team1Games !== null
    );
  } else if (filter === "unplayed") {
    adapted = adapted.filter(
      (m) => m.team1Games === null && m.team2Games === null
    );
  } else if (filter === "conflicts") {
    adapted = adapted.filter(
      (m) =>
        !m.isConfirmed &&
        m.reportedById &&
        m.team1Games !== null &&
        now - new Date(m.createdAt).getTime() > 24 * 60 * 60 * 1000
    );
  } else if (filter === "active_rounds") {
    adapted = adapted.filter((m) => !m.isRoundClosed);
  } else if (filter === "needs_review") {
    adapted = adapted.filter(
      (m) => !m.isConfirmed && m.reportedById && m.team1Games !== null
    );
  }

  // Búsqueda por nombre de jugador o título de torneo
  if (search) {
    adapted = adapted.filter((m) => {
      const haystack = [
        m.tournamentTitle,
        m.team1Player1Name,
        m.team1Player2Name,
        m.team2Player1Name,
        m.team2Player2Name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  // Estadísticas
  const totalMatches = adapted.length;
  const confirmedMatches = adapted.filter((m) => m.isConfirmed).length;
  const pendingMatches = adapted.filter(
    (m) => !m.isConfirmed && m.reportedById && m.team1Games !== null
  ).length;
  const unplayedMatches = adapted.filter(
    (m) => m.team1Games === null && m.team2Games === null
  ).length;
  const conflictMatches = adapted.filter(
    (m) =>
      !m.isConfirmed &&
      m.reportedById &&
      m.team1Games !== null &&
      now - new Date(m.createdAt).getTime() > 24 * 60 * 60 * 1000
  ).length;
  const activeRounds = new Set(
    adapted.filter((m) => !m.isRoundClosed).map((m) => `${m.tournamentId}-${m.roundNumber}`)
  ).size;
  const completionRate =
    totalMatches > 0 ? Math.round((confirmedMatches / totalMatches) * 100) : 0;

  const stats = {
    totalMatches,
    confirmedMatches,
    pendingMatches,
    unplayedMatches,
    conflictMatches,
    activeRounds,
    completionRate,
  };

  return NextResponse.json({ matches: adapted, stats, tournaments });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const matchIds: string[] = Array.isArray(body.matchIds) ? body.matchIds : [];
  const action: string = body.action || "";
  if (matchIds.length === 0) {
    return NextResponse.json({ error: "Sin sets seleccionados" }, { status: 400 });
  }

  const adminPlayerId = session.user.playerId ?? null;

  try {
    if (action === "clear_results") {
      await prisma.match.updateMany({
        where: { id: { in: matchIds } },
        data: {
          team1Games: null,
          team2Games: null,
          tiebreakScore: null,
          isConfirmed: false,
          reportedById: null,
          confirmedById: null,
          photoUrl: null,
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ message: "Resultados limpiados" });
    }

    if (action === "mark_confirmed") {
      await prisma.match.updateMany({
        where: { id: { in: matchIds } },
        data: {
          isConfirmed: true,
          confirmedById: adminPlayerId, // si existe, lo asigna
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ message: "Sets marcados como confirmados" });
    }

    if (action === "validate_pending") {
      await prisma.match.updateMany({
        where: {
          id: { in: matchIds },
          isConfirmed: false,
          NOT: { reportedById: null },
        },
        data: {
          isConfirmed: true,
          confirmedById: adminPlayerId,
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ message: "Pendientes validados" });
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (e) {
    console.error("Admin results PATCH error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
