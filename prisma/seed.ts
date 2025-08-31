// prisma/seed.ts
import { PrismaClient, MatchStatus } from "@prisma/client";
import { addDays } from "date-fns";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Rotación fija (por posición 1..4 en el grupo)
const ROTATIONS = [
  (ids: string[]) => [ids[0], ids[3], ids[1], ids[2]], // set 1: #1 + #4 vs #2 + #3
  (ids: string[]) => [ids[0], ids[2], ids[1], ids[3]], // set 2: #1 + #3 vs #2 + #4
  (ids: string[]) => [ids[0], ids[1], ids[2], ids[3]], // set 3: #1 + #2 vs #3 + #4
];

const SET_BONUS = 1;
const pointsForSet = (gamesWon: number, wonSet: boolean) =>
  gamesWon + (wonSet ? SET_BONUS : 0);

type SetScore = { t1: number; t2: number; tb?: string };
const setScore = (t1: number, t2: number, tb?: string): SetScore => ({ t1, t2, tb });

const movementSymbol = (prevLevel: number, nextLevel: number) => {
  if (nextLevel < prevLevel) return "↑";
  if (nextLevel > prevLevel) return "↓";
  return "→";
};

async function main() {
  console.log("🧹 Reseteando tablas...");
  await prisma.matchResult.deleteMany();
  await prisma.match.deleteMany();
  await prisma.groupPlayer.deleteMany();
  await prisma.group.deleteMany();
  await prisma.round.deleteMany();
  await prisma.ranking.deleteMany();
  await prisma.tournamentPlayer.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.player.deleteMany();
  await prisma.user.deleteMany();

  console.log("🔐 Creando usuarios (1 admin + 12 jugadores)...");
  const hash = await bcrypt.hash("demo1234", 10);
  const admin = await prisma.user.create({
    data: {
      name: "Admin Demo",
      email: "admin@demo.local",
      password: await bcrypt.hash("admin1234", 10),
      isAdmin: true,
    },
  });

  const NAMES = [
    "Lucía","Marcos","Sofía","Diego",
    "Paula","Álvaro","Marta","Javier",
    "Nuria","Hugo","Elena","Pablo",
  ];
  const users = await Promise.all(
    NAMES.map((name, i) =>
      prisma.user.create({
        data: {
          name,
          email: `${name.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"")}${i+1}@demo.local`,
          password: hash,
          isAdmin: false,
        },
      })
    )
  );

  console.log("🎾 Creando players (1-1 con users)...");
  const players = await Promise.all(
    users.map((u) =>
      prisma.player.create({
        data: { userId: u.id, name: u.name },
      })
    )
  );

  console.log("🏆 Creando torneo + inscripción...");
  const roundDurationDays = 14;
  const totalRounds = 2;
  const startDate = addDays(new Date(), -28); // hace 4 semanas
  const tournament = await prisma.tournament.create({
    data: {
      title: "Liga Escalera – Temporada Demo",
      startDate,
      endDate: addDays(startDate, totalRounds * roundDurationDays),
      totalRounds,
      roundDurationDays,
      isActive: true,
      isPublic: true,
    },
  });

  await prisma.tournamentPlayer.createMany({
    data: players.map((p) => ({
      tournamentId: tournament.id,
      playerId: p.id,
      joinedRound: 1,
      comodinesUsed: 0,
    })),
  });

  console.log("📅 Ronda 1 (cerrada) + grupos iniciales...");
  const round1 = await prisma.round.create({
    data: {
      tournamentId: tournament.id,
      number: 1,
      startDate,
      endDate: addDays(startDate, roundDurationDays - 1),
      isClosed: true,
    },
  });

  // 3 grupos de 4 (niveles 1..3)
  const group1Players = [players[0], players[1], players[2], players[3]];
  const group2Players = [players[4], players[5], players[6], players[7]];
  const group3Players = [players[8], players[9], players[10], players[11]];

  const group1 = await prisma.group.create({ data: { roundId: round1.id, number: 1, level: 1 } });
  const group2 = await prisma.group.create({ data: { roundId: round1.id, number: 2, level: 2 } });
  const group3 = await prisma.group.create({ data: { roundId: round1.id, number: 3, level: 3 } });

  await prisma.groupPlayer.createMany({
    data: [
      ...group1Players.map((p, i) => ({ groupId: group1.id, playerId: p.id, position: i + 1, points: 0, streak: i % 2 === 0 ? 2 : 1, usedComodin: false })),
      ...group2Players.map((p, i) => ({ groupId: group2.id, playerId: p.id, position: i + 1, points: 0, streak: 1, usedComodin: i === 3 })),
      ...group3Players.map((p, i) => ({ groupId: group3.id, playerId: p.id, position: i + 1, points: 0, streak: i === 0 ? 3 : 0, usedComodin: false })),
    ],
  });

  // Crea 3 sets por grupo con resultados y MatchResult
  async function createGroupMatchesWithResults(groupId: string, orderedPlayers: { id: string }[], demo: "A" | "B" | "C") {
    const ids = orderedPlayers.map((p) => p.id);
    const SCORES: SetScore[] =
      demo === "A"
        ? [setScore(4, 2), setScore(2, 4), setScore(5, 4, "7-5")] // incluye TB
        : demo === "B"
        ? [setScore(4, 0), setScore(4, 1), setScore(4, 2)]
        : [setScore(2, 4), setScore(1, 4), setScore(0, 4)];

    for (let s = 0; s < 3; s++) {
      const [t1p1, t1p2, t2p1, t2p2] = ROTATIONS[s](ids);
      const score = SCORES[s];

      const match = await prisma.match.create({
        data: {
          groupId,
          setNumber: s + 1,
          team1Player1Id: t1p1,
          team1Player2Id: t1p2,
          team2Player1Id: t2p1,
          team2Player2Id: t2p2,
          team1Games: score.t1,
          team2Games: score.t2,
          tiebreakScore: score.tb ?? null, // si hubo TB, guardamos “7-5”
          isConfirmed: true,
          status: MatchStatus.COMPLETED,
        },
      });

      const team1Won = score.t1 > score.t2;
      const results = [
        { playerId: t1p1, games: score.t1, isWinner: team1Won },
        { playerId: t1p2, games: score.t1, isWinner: team1Won },
        { playerId: t2p1, games: score.t2, isWinner: !team1Won },
        { playerId: t2p2, games: score.t2, isWinner: !team1Won },
      ].map((r) => ({
        matchId: match.id,
        playerId: r.playerId,
        games: r.games,
        sets: r.isWinner ? 1 : 0,
        points: pointsForSet(r.games, r.isWinner),
        isWinner: r.isWinner,
      }));

      await prisma.matchResult.createMany({ data: results });
    }
  }

  console.log("🎯 Partidos + resultados de Ronda 1...");
  await createGroupMatchesWithResults(group1.id, group1Players, "A");
  await createGroupMatchesWithResults(group2.id, group2Players, "B");
  await createGroupMatchesWithResults(group3.id, group3Players, "C");

  // Suma de puntos por jugador en R1
  const round1Agg = await prisma.matchResult.groupBy({
    by: ["playerId"],
    _sum: { points: true },
  });
  const pointsByPlayerR1 = new Map<string, number>(
    round1Agg.map((r) => [r.playerId, Number(r._sum.points ?? 0)])
  );

  // Orden de cada grupo por puntos (para movimientos)
  async function orderByPoints(groupId: string) {
    const gps = await prisma.groupPlayer.findMany({ where: { groupId } });
    return gps
      .map((gp) => ({ playerId: gp.playerId, pts: pointsByPlayerR1.get(gp.playerId) ?? 0 }))
      .sort((a, b) => b.pts - a.pts)
      .map((x) => x.playerId);
  }

  const orderedG1 = await orderByPoints(group1.id); // [1º, 2º, 3º, 4º]
  const orderedG2 = await orderByPoints(group2.id);
  const orderedG3 = await orderByPoints(group3.id);

  console.log("🔁 Calculando movimientos hacia Ronda 2...");
  const round2Start = addDays(round1.endDate, 1);
  const round2 = await prisma.round.create({
    data: {
      tournamentId: tournament.id,
      number: 2,
      startDate: round2Start,
      endDate: addDays(round2Start, roundDurationDays - 1),
      isClosed: false,
    },
  });

  // Composición de grupos aplicando reglas (↑, ↓, →)
  const g1r2Players = [orderedG1[0], orderedG1[1], orderedG1[2], orderedG2[0]]; // 1º G2 sube
  const g2r2Players = [orderedG1[3], orderedG2[1], orderedG2[2], orderedG3[0]]; // 4º G1 baja, 1º G3 sube
  const g3r2Players = [orderedG2[3], orderedG3[1], orderedG3[2], orderedG3[3]]; // 4º G2 baja, resto mantienen

  const group1R2 = await prisma.group.create({ data: { roundId: round2.id, number: 1, level: 1 } });
  const group2R2 = await prisma.group.create({ data: { roundId: round2.id, number: 2, level: 2 } });
  const group3R2 = await prisma.group.create({ data: { roundId: round2.id, number: 3, level: 3 } });

  await prisma.groupPlayer.createMany({
    data: [
      ...g1r2Players.map((pid, i) => ({ groupId: group1R2.id, playerId: pid, position: i + 1, points: 0, streak: 2, usedComodin: false })),
      ...g2r2Players.map((pid, i) => ({ groupId: group2R2.id, playerId: pid, position: i + 1, points: 0, streak: 2, usedComodin: false })),
      ...g3r2Players.map((pid, i) => ({ groupId: group3R2.id, playerId: pid, position: i + 1, points: 0, streak: 1, usedComodin: false })),
    ],
  });

  console.log("📊 Rankings R1 y estado inicial R2...");
  // Mapas de nivel por jugador en R1 y R2 (para movimiento en ranking)
  const levelByPlayerR1 = new Map<string, number>();
  orderedG1.forEach((pid) => levelByPlayerR1.set(pid, 1));
  orderedG2.forEach((pid) => levelByPlayerR1.set(pid, 2));
  orderedG3.forEach((pid) => levelByPlayerR1.set(pid, 3));

  const levelByPlayerR2 = new Map<string, number>();
  g1r2Players.forEach((pid) => levelByPlayerR2.set(pid, 1));
  g2r2Players.forEach((pid) => levelByPlayerR2.set(pid, 2));
  g3r2Players.forEach((pid) => levelByPlayerR2.set(pid, 3));

  // Ranking R1 por puntos totales
  const allR1 = players.map((p) => ({
    playerId: p.id,
    totalPoints: pointsByPlayerR1.get(p.id) ?? 0,
  }));
  const sortedR1 = [...allR1].sort((a, b) => b.totalPoints - a.totalPoints);

  await prisma.ranking.createMany({
    data: sortedR1.map((row, i) => ({
      tournamentId: tournament.id,
      playerId: row.playerId,
      roundNumber: 1,
      totalPoints: row.totalPoints,
      roundsPlayed: 1,
      averagePoints: row.totalPoints,
      position: i + 1,
      ironmanPosition: i + 1,
      movement: movementSymbol(levelByPlayerR1.get(row.playerId)!, levelByPlayerR2.get(row.playerId)!),
    })),
  });

  // Ranking R2 inicial (0 puntos en la ronda 2, media acumulando R1)
  await prisma.ranking.createMany({
    data: [...g1r2Players, ...g2r2Players, ...g3r2Players].map((pid, i) => ({
      tournamentId: tournament.id,
      playerId: pid,
      roundNumber: 2,
      totalPoints: 0,
      roundsPlayed: 1, // jugó R1
      averagePoints: pointsByPlayerR1.get(pid) ?? 0,
      position: i + 1,
      ironmanPosition: i + 1,
      movement: "→",
    })),
  });

  console.log("📆 Un partido de R2 SCHEDULED (para probar fechas)...");
  // Creamos un set en G1 R2 con estado de fechas
  {
    const ids = g1r2Players;
    const [t1p1, t1p2, t2p1, t2p2] = ROTATIONS[0](ids);
    await prisma.match.create({
      data: {
        groupId: group1R2.id,
        setNumber: 1,
        team1Player1Id: t1p1,
        team1Player2Id: t1p2,
        team2Player1Id: t2p1,
        team2Player2Id: t2p2,
        status: MatchStatus.SCHEDULED,
        proposedDate: addDays(new Date(), 2),
        proposedById: admin.id,
        acceptedDate: addDays(new Date(), 3),
        acceptedBy: [users[0].id, users[1].id], // algunos han aceptado
        isConfirmed: false,
      },
    });
  }

  console.log("✅ Seed completado.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
