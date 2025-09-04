/* prisma/seed.ts */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Cleaning DB…");
  // Orden de borrado por FK
  await prisma.match.deleteMany({});
  await prisma.groupPlayer.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.round.deleteMany({});
  await prisma.tournamentPlayer.deleteMany({});
  await prisma.tournament.deleteMany({});
  await prisma.player.deleteMany({});
  await prisma.user.deleteMany({});

  // -------- Config de volumen --------
  const USERS_COUNT = 40;          // usuarios/jugadores
  const GROUP_SIZE = 4;            // jugadores por grupo
  const LEVELS_PER_ROUND = 5;      // nº de grupos por ronda (niveles 1..N)
  const ROUNDS_T1 = 6;             // rondas torneo 1 (activo)
  const ROUNDS_T2 = 4;             // rondas torneo 2 (finalizado)

  // -------- Helpers --------
  const chunk = <T,>(arr: T[], size: number) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

  function addDays(base: Date, days: number) {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  }

  // Crea 1 partido por grupo (4 jugadores -> (p1,p2) vs (p3,p4))
  async function createGroupMatches(
    groupId: string,
    playerIds: string[],    // IDs de Player (no GroupPlayer)
    dayOffset: number
  ) {
    if (playerIds.length < 4) return;
    const [p1, p2, p3, p4] = playerIds;

    const today = new Date();
    const proposedDate = addDays(today, dayOffset);
    const acceptedDate = Math.random() < 0.6 ? addDays(today, dayOffset + 1) : null;
    const isConfirmed = Math.random() < 0.35;

    await prisma.match.create({
      data: {
        groupId,
        proposedDate,
        acceptedDate,
        isConfirmed,
        setNumber: 1, // ← requerido por tu schema
        // status:  (no lo ponemos: usa el default del schema)
        team1Player1Id: p1,
        team1Player2Id: p2,
        team2Player1Id: p3,
        team2Player2Id: p4,
      },
    });
  }

  async function createRoundWithGroups(
    tournamentId: string,
    roundNumber: number,
    enrolledPlayers: { id: string; name: string }[],
    startDayOffset: number,
    isClosed: boolean
  ) {
    const start = addDays(new Date(), startDayOffset);
    const end = addDays(start, 6);

    const round = await prisma.round.create({
      data: {
        tournamentId,
        number: roundNumber,
        startDate: start,
        endDate: end,
        isClosed,
      },
      select: { id: true },
    });

    // pool de jugadores (rellena si faltan para completar grupos)
    const perLevel = GROUP_SIZE;
    const totalNeeded = LEVELS_PER_ROUND * perLevel;
    const pool = [...enrolledPlayers];

    if (pool.length < totalNeeded) {
      const extra = allPlayers
        .filter((p) => !enrolledPlayers.some((e) => e.id === p.id))
        .slice(0, totalNeeded - pool.length);
      pool.push(...extra);
    }

    pool.sort((a, b) => a.name.localeCompare(b.name));

    for (let level = 1; level <= LEVELS_PER_ROUND; level++) {
      const groupPlayers = pool.slice((level - 1) * perLevel, level * perLevel);
      if (groupPlayers.length === 0) break;

      const group = await prisma.group.create({
        data: {
          roundId: round.id,
          number: level, // misma numeración que el nivel
          level,         // 1 es superior, mayor = inferior
        },
        select: { id: true },
      });

      // Crear GroupPlayers (con position obligatorio)
      await Promise.all(
        groupPlayers.map((p, idx) =>
          prisma.groupPlayer.create({
            data: {
              groupId: group.id,
              playerId: p.id,
              position: idx + 1,
              points: isClosed ? Math.round(Math.random() * 12) : 0,
              usedComodin: false,
              comodinReason: null,
              comodinAt: null,
            },
          })
        )
      );

      // Crear un partido del grupo (usa IDs de Player)
      await createGroupMatches(
        group.id,
        groupPlayers.map((gp) => gp.id),
        level // offset para variar fechas entre grupos
      );
    }

    return round.id;
  }

  // -------- 1) Users + Players --------
  console.log("👤 Creating users & players…");
  const allUsers = await Promise.all(
    Array.from({ length: USERS_COUNT }).map((_, i) =>
      prisma.user.create({
        data: {
          email: `jugador${i + 1}@test.com`,
          name: `Jugador ${String(i + 1).padStart(2, "0")}`,
          password: "password123", // ← requerido por tu schema
        },
        select: { id: true, name: true },
      })
    )
  );

  // si tu Player NO tiene userId en el schema, elimina userId: ...
  const allPlayers = await Promise.all(
    allUsers.map((u) =>
      prisma.player.create({
        data: {
          name: u.name ?? "Sin nombre",
          userId: u.id,
        },
        select: { id: true, name: true },
      })
    )
  );

  // -------- 2) Tournaments (con config comodines) --------
  console.log("🏆 Creating tournaments…");
  const [t1, t2] = await Promise.all([
    prisma.tournament.create({
      data: {
        title: "Liga Primavera",
        isActive: true,
        isPublic: true,
        totalRounds: ROUNDS_T1,
        roundDurationDays: 7,
        startDate: new Date(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7 * ROUNDS_T1),

        // Config de comodines
        maxComodinesPerPlayer: 3,
        enableMeanComodin: true,
        enableSubstituteComodin: true,
        substituteCreditFactor: 0.5,
        substituteMaxAppearances: 3,
      },
      select: { id: true, totalRounds: true, roundDurationDays: true },
    }),
    prisma.tournament.create({
      data: {
        title: "Liga Otoño",
        isActive: false,
        isPublic: true,
        totalRounds: ROUNDS_T2,
        roundDurationDays: 7,
        startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 * (ROUNDS_T2 + 2)),
        endDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 * 2),

        maxComodinesPerPlayer: 2,
        enableMeanComodin: true,
        enableSubstituteComodin: true,
        substituteCreditFactor: 0.4,
        substituteMaxAppearances: 2,
      },
      select: { id: true, totalRounds: true, roundDurationDays: true },
    }),
  ]);

  // -------- 3) TournamentPlayer (inscripciones) --------
  console.log("📝 Enrolling players…");
  const t1Players = allPlayers.slice(0, 28);
  const t2Players = allPlayers.slice(0, 20);

  await prisma.$transaction([
    ...t1Players.map((p) =>
      prisma.tournamentPlayer.create({
        data: {
          tournamentId: t1.id,
          playerId: p.id,
          comodinesUsed: 0,
          substituteAppearances: 0,
        },
      })
    ),
    ...t2Players.map((p) =>
      prisma.tournamentPlayer.create({
        data: {
          tournamentId: t2.id,
          playerId: p.id,
          comodinesUsed: 0,
          substituteAppearances: 0,
        },
      })
    ),
  ]);

  // -------- 4) Rounds + Groups + Matches --------
  console.log("📅 Creating rounds, groups and matches…");
  // Torneo 1 (activo): primeras 2 cerradas, resto abiertas
  for (let n = 1; n <= t1.totalRounds; n++) {
    const isClosed = n <= 2;
    await createRoundWithGroups(t1.id, n, t1Players, (n - 1) * 7, isClosed);
  }
  // Torneo 2 (finalizado): todas cerradas en el pasado
  for (let n = 1; n <= t2.totalRounds; n++) {
    await createRoundWithGroups(t2.id, n, t2Players, -7 * (t2.totalRounds - n + 2), true);
  }

  // -------- 5) Marcar algunos comodines usados --------
  console.log("🪄 Marking sample comodines…");
  const someGp = await prisma.groupPlayer.findMany({
    take: 5,
    include: { group: { include: { round: true } } },
  });

  for (const gp of someGp) {
    await prisma.groupPlayer.update({
      where: { id: gp.id },
      data: {
        usedComodin: true,
        comodinReason: "Comodín (media): 6.5 puntos",
        comodinAt: new Date(),
        points: 6.5,
      },
    });

    await prisma.tournamentPlayer.updateMany({
      where: { playerId: gp.playerId, tournamentId: gp.group.round.tournamentId },
      data: { comodinesUsed: { increment: 1 } },
    });
  }

  console.log("✅ Seed completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
