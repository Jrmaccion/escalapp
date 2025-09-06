// /app/api/matches/party/respond-date/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Body = {
  groupId: string;
  action: "accept" | "reject";
};

type MatchRow = {
  id: string;
  proposedDate: Date | null;
  acceptedBy: string[] | null;
  team1Player1Id: string;
  team1Player2Id: string;
  team2Player1Id: string;
  team2Player2Id: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { groupId, action }: Body = await req.json();
    if (!groupId || (action !== "accept" && action !== "reject")) {
      return NextResponse.json(
        { error: "Parámetros inválidos (groupId, action)" },
        { status: 400 }
      );
    }

    const matches: MatchRow[] = await prisma.match.findMany({
      where: { groupId },
      select: {
        id: true,
        proposedDate: true,
        acceptedBy: true,
        team1Player1Id: true,
        team1Player2Id: true,
        team2Player1Id: true,
        team2Player2Id: true,
      },
      orderBy: { setNumber: "asc" },
    });

    if (matches.length === 0) {
      return NextResponse.json({ error: "No hay sets para este grupo" }, { status: 404 });
    }

    // Verificar participación del usuario en el grupo
    const allPlayers = new Set<string>();
    matches.forEach((m: MatchRow) => {
      allPlayers.add(m.team1Player1Id);
      allPlayers.add(m.team1Player2Id);
      allPlayers.add(m.team2Player1Id);
      allPlayers.add(m.team2Player2Id);
    });

    if (!allPlayers.has(userId)) {
      return NextResponse.json(
        { error: "No autorizado: no perteneces a este grupo" },
        { status: 403 }
      );
    }

    if (action === "reject") {
      // Anular propuesta a nivel de partido
      await prisma.match.updateMany({
        where: { groupId },
        data: {
          proposedDate: null,
          proposedById: null,
          acceptedDate: null,
          acceptedBy: { set: [] },
          status: "PENDING",
        },
      });
      return NextResponse.json({ ok: true, status: "PENDING" });
    }

    // accept
    const head = matches[0];
    if (!head.proposedDate) {
      return NextResponse.json(
        { error: "No hay fecha propuesta que aceptar" },
        { status: 409 }
      );
    }

    const currentAccepted = new Set<string>(head.acceptedBy ?? []);
    currentAccepted.add(userId);

    const everyoneAccepted = Array.from(allPlayers).every((p) =>
      currentAccepted.has(p)
    );

    await prisma.match.updateMany({
      where: { groupId },
      data: {
        acceptedBy: { set: Array.from(currentAccepted) },
        ...(everyoneAccepted
          ? { acceptedDate: head.proposedDate, status: "SCHEDULED" }
          : { status: "DATE_PROPOSED" }),
      },
    });

    return NextResponse.json({
      ok: true,
      status: everyoneAccepted ? "SCHEDULED" : "DATE_PROPOSED",
      acceptedCount: currentAccepted.size,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}
