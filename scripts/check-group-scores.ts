import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGroup() {
  const rounds = await prisma.round.findMany({
    where: {
      tournament: { title: 'Torneo Escalera Villa 2025' },
      number: 1
    },
    include: {
      groups: {
        include: {
          players: {
            include: { player: true },
            orderBy: { position: 'asc' }
          },
          matches: {
            orderBy: { setNumber: 'asc' }
          }
        }
      }
    }
  });

  if (rounds.length === 0) {
    console.log('No se encontró la ronda 1');
    await prisma.$disconnect();
    return;
  }

  const round = rounds[0];
  console.log('=== RONDA 1 - GRUPOS ===\n');

  // Get all player IDs from matches
  const playerIds = new Set<string>();
  for (const group of round.groups) {
    for (const match of group.matches) {
      playerIds.add(match.team1Player1Id);
      playerIds.add(match.team1Player2Id);
      playerIds.add(match.team2Player1Id);
      playerIds.add(match.team2Player2Id);
    }
  }

  // Fetch all players
  const players = await prisma.player.findMany({
    where: { id: { in: Array.from(playerIds) } },
    select: { id: true, name: true }
  });

  const playerMap = new Map(players.map(p => [p.id, p.name]));

  for (const group of round.groups) {
    console.log(`Grupo ${group.number}:`);
    console.log('Jugadores y posiciones:');
    for (const gp of group.players) {
      console.log(`  Pos ${gp.position}: ${gp.player.name} - ${gp.points} puntos`);
    }
    console.log('\nPartidos:');
    for (const match of group.matches) {
      const t1p1 = playerMap.get(match.team1Player1Id) || 'Unknown';
      const t1p2 = playerMap.get(match.team1Player2Id) || 'Unknown';
      const t2p1 = playerMap.get(match.team2Player1Id) || 'Unknown';
      const t2p2 = playerMap.get(match.team2Player2Id) || 'Unknown';
      console.log(`  Set ${match.setNumber}: ${t1p1}+${t1p2} (${match.team1Games}) vs ${t2p1}+${t2p2} (${match.team2Games})`);
    }
    console.log('\n---\n');
  }

  await prisma.$disconnect();
}

checkGroup().catch(console.error);
