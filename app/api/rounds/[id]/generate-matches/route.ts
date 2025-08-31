import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Genera los "partidos" (en el modelo actual, 1 Match = 1 set)
 * por cada grupo de la ronda. Para cada bloque de 4 jugadores
 * se crean 3 sets con rotación fija:
 *   Set 1 → #1 + #4 vs #2 + #3
 *   Set 2 → #1 + #3 vs #2 + #4
 *   Set 3 → #1 + #2 vs #3 + #4
 *
 * Idempotencia:
 *  - Si `force=false` (por defecto), solo crea los setNumber que falten.
 *  - Si `force=true`, borra todos los matches del grupo y recrea los 3.
 *
 * Devuelve resumen: matchesCreated, groupsProcessed, groupsSkipped.
 */
type Payload = { force?: boolean };

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { force = false } = (await req.json().catch(() => ({}))) as Payload;
  const roundId = params.id;

  // Verificar que la ronda existe y no está cerrada
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { id: true, isClosed: true }
  });

  if (!round) {
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  }
  
  if (round.isClosed) {
    return NextResponse.json({ error: "La ronda está cerrada" }, { status: 400 });
  }

  // Obtenemos la ronda con sus grupos, jugadores (ordenados) y matches existentes
  const roundWithGroups = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      groups: {
        include: {
          players: { 
            include: { player: { select: { id: true, name: true } } },
            orderBy: { position: "asc" } 
          },
          matches: { select: { setNumber: true } },
        },
        orderBy: { number: "asc" },
      },
    },
  });

  if (!roundWithGroups) {
    return NextResponse.json({ error: "Error cargando datos de la ronda" }, { status: 500 });
  }

  let groupsProcessed = 0;
  let groupsSkipped = 0;
  let matchesCreated = 0;
  const errors: string[] = [];

  // Transacción para asegurar atomicidad de la generación
  await prisma.$transaction(async (tx) => {
    for (const group of roundWithGroups.groups) {
      const n = group.players.length;

      // Requisito: trabajar con bloques exactos de 4
      if (n < 4) {
        groupsSkipped++;
        errors.push(`Grupo ${group.number}: Solo ${n} jugadores, se necesitan al menos 4`);
        continue;
      }

      if (n % 4 !== 0) {
        groupsSkipped++;
        errors.push(`Grupo ${group.number}: ${n} jugadores no es múltiplo de 4`);
        continue;
      }

      // Limpieza si se fuerza la regeneración
      if (force && group.matches.length) {
        await tx.match.deleteMany({ where: { groupId: group.id } });
      }

      // setNumbers ya existentes (si no es force)
      const existing = force ? new Set<number>() : new Set(group.matches.map((m) => m.setNumber));

      // Generar matches por bloques de 4 jugadores
      const blocks = Math.floor(n / 4);
      for (let b = 0; b < blocks; b++) {
        const base = b * 4; // índice base del bloque (0-based)
        
        // ✅ CORREGIDO: Acceso correcto al playerId
        const players = group.players.slice(base, base + 4);
        if (players.length !== 4) {
          errors.push(`Grupo ${group.number}, bloque ${b + 1}: Error en asignación de jugadores`);
          continue;
        }

        const p1 = players[0].player.id;  // Posición 1
        const p2 = players[1].player.id;  // Posición 2
        const p3 = players[2].player.id;  // Posición 3
        const p4 = players[3].player.id;  // Posición 4

        const blockOffset = b * 3;
        const s1 = 1 + blockOffset; // Set 1
        const s2 = 2 + blockOffset; // Set 2
        const s3 = 3 + blockOffset; // Set 3

        const data: Prisma.MatchCreateManyInput[] = [];

        // Set 1: 1+4 vs 2+3
        if (force || !existing.has(s1)) {
          data.push({
            groupId: group.id,
            setNumber: s1,
            team1Player1Id: p1,
            team1Player2Id: p4,
            team2Player1Id: p2,
            team2Player2Id: p3,
            status: "PENDING",
          });
        }

        // Set 2: 1+3 vs 2+4
        if (force || !existing.has(s2)) {
          data.push({
            groupId: group.id,
            setNumber: s2,
            team1Player1Id: p1,
            team1Player2Id: p3,
            team2Player1Id: p2,
            team2Player2Id: p4,
            status: "PENDING",
          });
        }

        // Set 3: 1+2 vs 3+4
        if (force || !existing.has(s3)) {
          data.push({
            groupId: group.id,
            setNumber: s3,
            team1Player1Id: p1,
            team1Player2Id: p2,
            team2Player1Id: p3,
            team2Player2Id: p4,
            status: "PENDING",
          });
        }

        if (data.length) {
          try {
            const res = await tx.match.createMany({
              data,
              skipDuplicates: true,
            });
            matchesCreated += res.count;
          } catch (error) {
            errors.push(`Grupo ${group.number}, bloque ${b + 1}: Error creando matches - ${error}`);
          }
        }
      }

      groupsProcessed++;
    }
  });

  // Preparar respuesta
  const response: any = {
    ok: true,
    message: `Partidos generados: ${matchesCreated}. Grupos procesados: ${groupsProcessed}. Omitidos: ${groupsSkipped}.`,
    matchesCreated,
    groupsProcessed,
    groupsSkipped,
  };

  if (errors.length > 0) {
    response.warnings = errors;
  }

  return NextResponse.json(response);
}