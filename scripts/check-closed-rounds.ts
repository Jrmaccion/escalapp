// Script to check closed rounds in database
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const rounds = await prisma.round.findMany({
      select: {
        id: true,
        number: true,
        isClosed: true,
        tournament: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [
        { tournament: { title: 'asc' } },
        { number: 'asc' },
      ],
    });

    console.log('\n=== ALL ROUNDS IN DATABASE ===\n');

    const byTournament = rounds.reduce((acc, round) => {
      const tournamentTitle = round.tournament.title;
      if (!acc[tournamentTitle]) {
        acc[tournamentTitle] = [];
      }
      acc[tournamentTitle].push(round);
      return acc;
    }, {} as Record<string, typeof rounds>);

    Object.entries(byTournament).forEach(([title, tournamentRounds]) => {
      console.log(`Tournament: ${title}`);
      tournamentRounds.forEach(r => {
        console.log(`  - Round ${r.number}: isClosed = ${r.isClosed} (ID: ${r.id})`);
      });
      console.log('');
    });

    const closedCount = rounds.filter(r => r.isClosed).length;
    console.log(`Total rounds: ${rounds.length}`);
    console.log(`Closed rounds: ${closedCount}`);
    console.log(`Open rounds: ${rounds.length - closedCount}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
