// scripts/diagnose-round.ts - Diagnosticar estado de una ronda
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function diagnoseRound() {
  try {
    console.log('\n🔍 DIAGNÓSTICO DE RONDA\n');

    const roundId = await question('ID de la ronda a diagnosticar: ');

    if (!roundId.trim()) {
      console.log('❌ ID de ronda requerido');
      process.exit(1);
    }

    console.log('\n📊 Obteniendo datos de la ronda...\n');

    const round = await prisma.round.findUnique({
      where: { id: roundId.trim() },
      include: {
        tournament: {
          select: {
            id: true,
            title: true,
            totalRounds: true,
          },
        },
        groups: {
          include: {
            players: {
              include: {
                player: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: {
                position: 'asc',
              },
            },
            matches: {
              select: {
                id: true,
                setNumber: true,
                team1Games: true,
                team2Games: true,
                isConfirmed: true,
                status: true,
              },
            },
          },
          orderBy: {
            number: 'asc',
          },
        },
      },
    });

    if (!round) {
      console.log('❌ Ronda no encontrada');
      process.exit(1);
    }

    console.log(`\n📌 RONDA #${round.number} - ${round.tournament.title}`);
    console.log(`   Estado: ${round.isClosed ? '🔒 CERRADA' : '🔓 ABIERTA'}`);
    console.log(`   Inicio: ${round.startDate.toLocaleDateString()}`);
    console.log(`   Fin: ${round.endDate.toLocaleDateString()}`);

    console.log(`\n👥 GRUPOS (${round.groups.length} total):\n`);

    let allMatchesComplete = true;
    let hasInconsistencies = false;

    for (const group of round.groups) {
      const allMatches = group.matches;
      const confirmedMatches = allMatches.filter((m) => m.isConfirmed);
      const matchesWithResults = allMatches.filter(
        (m) => m.team1Games !== null && m.team2Games !== null
      );

      const isComplete = confirmedMatches.length === 3;
      const hasResults = matchesWithResults.length > 0;
      const hasUnconfirmedResults =
        matchesWithResults.length > confirmedMatches.length;

      if (!isComplete) allMatchesComplete = false;
      if (hasUnconfirmedResults) hasInconsistencies = true;

      const status = group.status || 'PENDING';
      const statusIcon =
        status === 'PLAYED'
          ? '✅'
          : status === 'SKIPPED'
          ? '⏭️'
          : status === 'POSTPONED'
          ? '⏸️'
          : '⏳';

      console.log(
        `   ${statusIcon} Grupo ${group.number} (Nivel ${group.level}) - Estado: ${status}`
      );
      console.log(`      Partidos: ${confirmedMatches.length}/3 confirmados`);

      if (hasUnconfirmedResults) {
        console.log(
          `      ⚠️  ${matchesWithResults.length - confirmedMatches.length} partido(s) con resultado sin confirmar`
        );
      }

      // Mostrar jugadores
      console.log(`      Jugadores:`);
      for (const gp of group.players) {
        console.log(
          `         Pos ${gp.position}: ${gp.player.name} - ${gp.points} pts (streak: ${gp.streak})`
        );
        if (gp.usedComodin) {
          console.log(`            🎫 Comodín usado: ${gp.comodinReason || 'N/A'}`);
        }
      }

      // Mostrar partidos
      console.log(`      Partidos:`);
      for (const match of allMatches) {
        const confirmIcon = match.isConfirmed ? '✅' : '⏳';
        const score =
          match.team1Games !== null && match.team2Games !== null
            ? `${match.team1Games}-${match.team2Games}`
            : 'Sin resultado';
        console.log(
          `         ${confirmIcon} Set ${match.setNumber}: ${score} (${match.status})`
        );
      }

      console.log('');
    }

    console.log(`\n📋 RESUMEN:\n`);
    console.log(`   ✓ Ronda ${round.isClosed ? 'CERRADA' : 'ABIERTA'}`);
    console.log(
      `   ${allMatchesComplete ? '✓' : '✗'} Todos los partidos completos: ${allMatchesComplete ? 'SÍ' : 'NO'}`
    );
    console.log(
      `   ${hasInconsistencies ? '⚠️' : '✓'} Inconsistencias detectadas: ${hasInconsistencies ? 'SÍ' : 'NO'}`
    );

    // Verificar si hay siguiente ronda
    const nextRound = await prisma.round.findFirst({
      where: {
        tournamentId: round.tournament.id,
        number: round.number + 1,
      },
    });

    if (nextRound) {
      console.log(`   ℹ️  Existe ronda siguiente (Ronda #${nextRound.number})`);
    } else {
      console.log(
        `   ℹ️  No existe ronda siguiente ${round.number >= round.tournament.totalRounds ? '(es la última ronda)' : ''}`
      );
    }

    console.log('\n');

    // Sugerencias
    if (!round.isClosed && !allMatchesComplete) {
      console.log('💡 SUGERENCIAS:');
      console.log(
        '   1. Completa todos los partidos pendientes antes de cerrar la ronda'
      );
      console.log('   2. O usa forceClose=true para forzar el cierre (marcará grupos como SKIPPED)');
      console.log('\n');
    }

    if (!round.isClosed && allMatchesComplete) {
      console.log('💡 SUGERENCIAS:');
      console.log('   ✅ La ronda está lista para ser cerrada');
      console.log('   Puedes ejecutar el cierre desde el panel de administración');
      console.log('\n');
    }

    if (round.isClosed && hasInconsistencies) {
      console.log('⚠️  ADVERTENCIAS:');
      console.log('   La ronda está cerrada pero tiene inconsistencias');
      console.log('   Considera revisar los datos o contactar soporte');
      console.log('\n');
    }

    if (!round.isClosed && hasInconsistencies) {
      console.log('⚠️  ADVERTENCIAS:');
      console.log('   Hay partidos con resultados sin confirmar');
      console.log(
        '   Esto puede causar problemas al cerrar la ronda. Confirma o elimina esos resultados.'
      );
      console.log('\n');
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

diagnoseRound();
