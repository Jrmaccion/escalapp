import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Payload = { force?: boolean };

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const roundId = params.id;
  const { force = false } = (await req.json().catch(() => ({}))) as Payload;

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      groups: {
        include: {
          players: { orderBy: { position: "asc" } }, // posiciones 1..N
          matches: true,
        },
        orderBy: { number: "asc" },
      },
    },
  });

  if (!round) {
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  }
  if (round.isClosed) {
    return NextResponse.json({ error: "La ronda está cerrada" }, { status: 400 });
  }

  let groupsProcessed = 0;
  let matchesCreated = 0;
  let groupsSkipped = 0;

  for (const group of round.groups) {
    const n = group.players.length;
    if (n < 4 || n % 4 !== 0) {
      groupsSkipped++;
      continue;
    }

    // Si force=true, borrar todos los partidos del grupo antes de crear
    if (force && group.matches.length) {
      await prisma.match.deleteMany({ where: { groupId: group.id } });
    }

    // Calculamos qué sets existen ya (si no es force)
    const existing = new Set(group.matches.map((m) => m.setNumber));

    // Si hay 8, 12, ... jugadores, dividimos en bloques de 4 por posición:
    // [1..4], [5..8], ...
    const blocks = Math.floor(n / 4);
    for (let b = 0; b < blocks; b++) {
      const base = b * 4; // índice 0-based
      const p1 = group.players[base + 0].playerId;
      const p2 = group.players[base + 1].playerId;
      const p3 = group.players[base + 2].playerId;
      const p4 = group.players[base + 3].playerId;

      // setNumber global dentro del grupo: usamos correlativo por bloque
      // Para mantener el orden 1..3 para cada bloque:
      const blockOffset = b * 3;

      // Set 1 → #1 + #4 vs #2 + #3
      const s1 = 1 + blockOffset;
      // Set 2 → #1 + #3 vs #2 + #4
      const s2 = 2 + blockOffset;
      // Set 3 → #1 + #2 vs #3 + #4
      const s3 = 3 + blockOffset;

      const data: any[] = [];
      // Si no es force, evitamos duplicar sets ya existentes
      if (force || !existing.has(s1)) {
        data.push({
          groupId: group.id,
          setNumber: s1,
          team1Player1Id: p1,
          team1Player2Id: p4,
          team2Player1Id: p2,
          team2Player2Id: p3,
          status: "PENDING" as const,
        });
      }
      if (force || !existing.has(s2)) {
        data.push({
          groupId: group.id,
          setNumber: s2,
          team1Player1Id: p1,
          team1Player2Id: p3,
          team2Player1Id: p2,
          team2Player2Id: p4,
          status: "PENDING" as const,
        });
      }
      if (force || !existing.has(s3)) {
        data.push({
          groupId: group.id,
          setNumber: s3,
          team1Player1Id: p1,
          team1Player2Id: p2,
          team2Player1Id: p3,
          team2Player2Id: p4,
          status: "PENDING" as const,
        });
      }

      if (data.length) {
        const res = await prisma.match.createMany({ data });
        matchesCreated += res.count;
      }
    }

    groupsProcessed++;
  }

  return NextResponse.json({
    ok: true,
    message: `Partidos generados: ${matchesCreated}. Grupos procesados: ${groupsProcessed}. Omitidos: ${groupsSkipped}.`,
    matchesCreated,
    groupsProcessed,
    groupsSkipped,
  });
}
