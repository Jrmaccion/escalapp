/* prisma/seed.ts */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---- Config ----
const TZ = "Europe/Madrid";
const USERS_COUNT = 40;      // jugadores
const GROUP_SIZE = 4;        // jugadores por grupo
const LEVELS_PER_ROUND = 5;  // nº grupos por ronda
const ROUNDS_T1 = 6;         // torneo activo
const ROUNDS_T2 = 4;         // torneo pasado

// Rotación fija por posición 1..4 en el grupo
const ROTATIONS = [
  (ids: string[]) => [ids[0], ids[3], ids[1], ids[2]], // set 1: #1 + #4 vs #2 + #3
  (ids: string[]) => [ids[0], ids[2], ids[1], ids[3]], // set 2: #1 + #3 vs #2 + #4
  (ids: string[]) => [ids[0], ids[1], ids[2], ids[3]], // set 3: #1 + #2 vs #3 + #4
];

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function today() {
  // Mantener coherencia visual — fecha actual
  return new Date();
}

async function createThreeSetMatches(groupId: string, orderedPlayerIds: string[], dayOffset: number) {
  // orderedPlayerIds = posiciones 1..4 dentro del grupo
  const base = today();
  const proposed = addDays(base, dayOffset);

  for (let setNumber = 1; setNumber <= 3; setNumber++) {
    const rotate = ROTATIONS[setNumber - 1];
    const [a, b, c, d] = rotate(orderedPlayerIds);

    // Sembrar variedad realista
    const acceptedDate = Math.random() < 0.55 ? addDays(proposed, 1) : null;
    const isConfirmed = Math.random() < 0.45;

    // Resultados demo (algunos 4–4 con TB)
    let games1 = Math.floor(Math.random() * 5); // 0..4
    let games2 = Math.floor(Math.random() * 5);
    let tiebreakScore: string | null = null;

    // Evitar 4-4 sin TB
    if (games1 === 4 && games2 === 4) {
      // Si ambos 4, forzamos un TB válido y computable como 5-4
      tiebreakScore = Math.random() < 0.5 ? "7-5" : "8-6";
      // Mantén 4-4 para que la UI/validators lo interpreten como TB presente
    } else if (games1 === games2) {
      // Evita demasiados empates no-TB
      if (games1 < 4) games1 = 4; // fuerza un ganador
    }

    await prisma.match.create({
      data: {
        groupId,
        setNumber,
        team1Player1Id: a,
        team1Player2Id: b,
        team2Player1Id: c,
        team2Player2Id: d,
        proposedDate: proposed,
        acceptedDate,
        isConfirmed,
        // Campos opcionales frecuentes en tu dominio:
        // status: omitimos (deja default del schema)
        // gamesTeam1: games1, gamesTeam2: games2,  <-- descomenta si existen en tu schema
        // tiebreakScore,
        // photoUrl: isConfirmed ? "https://picsum.photos/seed/escalapp/640/480" : null,
      },
    });
  }
}

async function createRoundWithGroups(
  tournamentId: string,
  roundNumber: number,
  enrolledPlayers: { id: string; name: string }[],
  startDayOffset: number,
  isClosed: boolean
) {
  const start = addDays(today(), startDayOffset);
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

  // Pool — garantizar múltiplos de 4
  const perLevel = GROUP_SIZE;
  const totalNeeded = LEVELS_PER_ROUND * perLevel;
  const pool = [...enrolledPlayers];

  if (pool.length < totalNeeded) {
    const extra = allPlayers
      .filter((p) => !enrolledPlayers.some((e) => e.id === p.id))
      .slice(0, totalNeeded - pool.length);
    pool.push(...extra);
  }
  // Orden determinista (para UI consistente)
  pool.sort((a, b) => a.name.localeCompare(b.name, "es"));

  for (let level = 1; level <= LEVELS_PER_ROUND; level++) {
    const startIdx = (level - 1) * perLevel;
    const groupPlayers = pool.slice(startIdx, startIdx + perLevel);
    if (groupPlayers.length < perLevel) break;

    const group = await prisma.group.create({
      data: {
        roundId: round.id,
        number: level,
        level, // 1 = superior
      },
      select: { id: true },
    });

    // Crear GroupPlayers (positions 1..4)
    const orderedIds: string[] = [];
    for (let i = 0; i < groupPlayers.length; i++) {
      const gp = groupPlayers[i];
      await prisma.groupPlayer.create({
        data: {
          groupId: group.id,
          playerId: gp.id,
          position: i + 1,
          points: isClosed ? Math.round(Math.random() * 12) : 0,
          usedComodin: false,
          comodinReason: null,
          comodinAt: null,
        },
      });
      orderedIds.push(gp.id);
    }

    // 3 partidos (sets) por grupo con la rotación fija
    await createThreeSetMatches(group.id, orderedIds, level);
  }
  return round.id;
}

// ---- Seed principal ----
let allPlayers: { id: string; name: string }[] = [];

async function main() {
  console.log("🧹 Cleaning DB…");
  await prisma.match.deleteMany({});
  await prisma.groupPlayer.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.round.deleteMany({});
  await prisma.tournamentPlayer.deleteMany({});
  await prisma.tournament.deleteMany({});
  await prisma.player.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("🔐 Creating users (bcrypt)…");
  const adminHash = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      email: "admin@test.com",
      name: "Administrador",
      password: adminHash,           // <-- HASH
      isAdmin: true,
    },
  });

  const users = await Promise.all(
    Array.from({ length: USERS_COUNT }).map(async (_v, i) => {
      const hash = await bcrypt.hash("password123", 10);
      return prisma.user.create({
        data: {
          email: `jugador${i + 1}@test.com`,
          name: `Jugador ${String(i + 1).padStart(2, "0")}`,
          password: hash,            // <-- HASH
          isAdmin: false,
        },
        select: { id: true, name: true },
      });
    })
  );

  console.log("🎾 Creating players…");
  allPlayers = await Promise.all(
    users.map((u) =>
      prisma.player.create({
        data: { name: u.name ?? "Sin nombre", userId: u.id },
        select: { id: true, name: true },
      })
    )
  );

  console.log("🏆 Creating tournaments with comodín settings…");
  const [t1, t2] = await Promise.all([
    prisma.tournament.create({
      data: {
        title: "Liga Primavera",
        isActive: true,
        isPublic: true,
        totalRounds: ROUNDS_T1,
        roundDurationDays: 7,
        startDate: today(),
        endDate: addDays(today(), 7 * ROUNDS_T1),
        // settings de comodín (ajusta a tu schema exacto)
        maxComodinesPerPlayer: 3,
        enableMeanComodin: true,
        enableSubstituteComodin: true,
        substituteCreditFactor: 0.5,
        substituteMaxAppearances: 3,
      },
      select: { id: true, totalRounds: true },
    }),
    prisma.tournament.create({
      data: {
        title: "Liga Otoño",
        isActive: false,
        isPublic: true,
        totalRounds: ROUNDS_T2,
        roundDurationDays: 7,
        startDate: addDays(today(), -7 * (ROUNDS_T2 + 2)),
        endDate: addDays(today(), -14),
        maxComodinesPerPlayer: 2,
        enableMeanComodin: true,
        enableSubstituteComodin: true,
        substituteCreditFactor: 0.4,
        substituteMaxAppearances: 2,
      },
      select: { id: true, totalRounds: true },
    }),
  ]);

  console.log("📝 Enrolling players (multiplo de 4)…");
  // Asegura múltiplos de 4 para no dejar grupos cojos
  const t1Players = allPlayers.slice(0, LEVELS_PER_ROUND * GROUP_SIZE); // 5*4 = 20
  const t2Players = allPlayers.slice(20, 20 + LEVELS_PER_ROUND * GROUP_SIZE); // otros 20

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

  console.log("📅 Creating rounds, groups and matches…");
  // Torneo 1 (activo): deja 2 cerradas para probar rankings/historial
  for (let n = 1; n <= (t1.totalRounds ?? ROUNDS_T1); n++) {
    const isClosed = n <= 2;
    await createRoundWithGroups(t1.id, n, t1Players, (n - 1) * 7, isClosed);
  }
  // Torneo 2 (cerrado): todas en el pasado y cerradas
  for (let n = 1; n <= (t2.totalRounds ?? ROUNDS_T2); n++) {
    await createRoundWithGroups(t2.id, n, t2Players, -7 * (t2.totalRounds - n + 2), true);
  }

  console.log("🪄 Marking sample comodines & points…");
  // Marca algunos comodines ‘media’ en grupos de T1 ronda 1
  const someGp = await prisma.groupPlayer.findMany({
    take: 6,
    include: { group: { include: { round: true } } },
  });

  for (const gp of someGp) {
    await prisma.groupPlayer.update({
      where: { id: gp.id },
      data: {
        usedComodin: true,
        comodinReason: "Comodín (media): 6.5 puntos",
        comodinAt: today(),
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
