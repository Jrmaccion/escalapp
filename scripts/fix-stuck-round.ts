// scripts/fix-stuck-round.ts - Reparar ronda atascada
import { PrismaClient, GroupStatus } from '@prisma/client';
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

async function fixStuckRound() {
  try {
    console.log('\n🔧 REPARACIÓN DE RONDA ATASCADA\n');
    console.log('⚠️  Este script puede modificar datos de la base de datos');
    console.log('⚠️  Asegúrate de tener un backup antes de continuar\n');

    const roundId = await question('ID de la ronda a reparar: ');

    if (!roundId.trim()) {
      console.log('❌ ID de ronda requerido');
      process.exit(1);
    }

    console.log('\n📊 Verificando estado de la ronda...\n');

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
        },
      },
    });

    if (!round) {
      console.log('❌ Ronda no encontrada');
      process.exit(1);
    }

    console.log(`\n📌 Ronda #${round.number} - ${round.tournament.title}`);
    console.log(`   Estado actual: ${round.isClosed ? '🔒 CERRADA' : '🔓 ABIERTA'}\n`);

    if (round.isClosed) {
      console.log('ℹ️  La ronda ya está cerrada. No se requiere reparación.');
      const reopen = await question(
        '\n¿Deseas REABRIR la ronda para hacer cambios? (escribe "si" para confirmar): '
      );
      if (reopen.toLowerCase() !== 'si') {
        console.log('Operación cancelada');
        process.exit(0);
      }

      console.log('\n🔓 Reabriendo ronda...');
      await prisma.round.update({
        where: { id: roundId.trim() },
        data: { isClosed: false },
      });
      console.log('✅ Ronda reabierta. Ahora puedes hacer cambios y cerrarla de nuevo.\n');
      process.exit(0);
    }

    // Analizar estado de grupos
    let groupsWithInconsistencies = 0;
    let groupsComplete = 0;
    let groupsIncomplete = 0;

    for (const group of round.groups) {
      const allMatches = group.matches;
      const confirmedMatches = allMatches.filter((m) => m.isConfirmed);
      const matchesWithResults = allMatches.filter(
        (m) => m.team1Games !== null && m.team2Games !== null
      );

      const hasUnconfirmedResults =
        matchesWithResults.length > confirmedMatches.length;

      if (hasUnconfirmedResults) {
        groupsWithInconsistencies++;
      }

      if (confirmedMatches.length === 3) {
        groupsComplete++;
      } else {
        groupsIncomplete++;
      }
    }

    console.log(`\n📊 ESTADO ACTUAL:\n`);
    console.log(`   Grupos completos (3 sets): ${groupsComplete}`);
    console.log(`   Grupos incompletos: ${groupsIncomplete}`);
    console.log(`   Grupos con inconsistencias: ${groupsWithInconsistencies}\n`);

    console.log('🛠️  OPCIONES DE REPARACIÓN:\n');
    console.log('   1. Limpiar resultados sin confirmar (eliminar datos parciales)');
    console.log('   2. Marcar grupos incompletos como SKIPPED');
    console.log('   3. Resetear todos los estados de grupos a PENDING');
    console.log('   4. Salir sin hacer cambios\n');

    const option = await question('Selecciona una opción (1-4): ');

    switch (option.trim()) {
      case '1':
        await cleanUnconfirmedResults(roundId.trim());
        break;
      case '2':
        await markIncompleteGroupsAsSkipped(roundId.trim());
        break;
      case '3':
        await resetGroupStatuses(roundId.trim());
        break;
      case '4':
        console.log('Operación cancelada');
        break;
      default:
        console.log('Opción inválida');
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

async function cleanUnconfirmedResults(roundId: string) {
  console.log('\n🧹 Limpiando resultados sin confirmar...\n');

  const confirm = await question(
    '⚠️  Esto ELIMINARÁ todos los resultados que no estén confirmados. ¿Continuar? (escribe "si"): '
  );

  if (confirm.toLowerCase() !== 'si') {
    console.log('Operación cancelada');
    return;
  }

  const groups = await prisma.group.findMany({
    where: { roundId },
    include: {
      matches: {
        where: {
          isConfirmed: false,
          OR: [
            { team1Games: { not: null } },
            { team2Games: { not: null } },
          ],
        },
      },
    },
  });

  let cleanedMatches = 0;

  for (const group of groups) {
    for (const match of group.matches) {
      await prisma.match.update({
        where: { id: match.id },
        data: {
          team1Games: null,
          team2Games: null,
          tiebreakScore: null,
          reportedById: null,
          confirmedById: null,
          status: 'PENDING',
        },
      });
      cleanedMatches++;
    }
  }

  console.log(`\n✅ ${cleanedMatches} partido(s) limpiados`);
  console.log('ℹ️  Ahora puedes intentar cerrar la ronda de nuevo\n');
}

async function markIncompleteGroupsAsSkipped(roundId: string) {
  console.log('\n⏭️  Marcando grupos incompletos como SKIPPED...\n');

  const groups = await prisma.group.findMany({
    where: { roundId },
    include: {
      matches: true,
    },
  });

  let markedGroups = 0;

  for (const group of groups) {
    const confirmedMatches = group.matches.filter((m) => m.isConfirmed).length;

    if (confirmedMatches < 3) {
      await prisma.group.update({
        where: { id: group.id },
        data: {
          status: GroupStatus.SKIPPED,
          skippedReason: 'MANUAL_FIX',
        },
      });
      markedGroups++;
      console.log(
        `   ⏭️  Grupo ${group.number}: ${confirmedMatches}/3 sets → SKIPPED`
      );
    }
  }

  console.log(`\n✅ ${markedGroups} grupo(s) marcados como SKIPPED`);
  console.log('ℹ️  Ahora puedes intentar cerrar la ronda con forceClose=true\n');
}

async function resetGroupStatuses(roundId: string) {
  console.log('\n🔄 Reseteando estados de grupos...\n');

  const confirm = await question(
    '⚠️  Esto restablecerá TODOS los grupos a PENDING. ¿Continuar? (escribe "si"): '
  );

  if (confirm.toLowerCase() !== 'si') {
    console.log('Operación cancelada');
    return;
  }

  const result = await prisma.group.updateMany({
    where: { roundId },
    data: {
      status: GroupStatus.PENDING,
      skippedReason: null,
    },
  });

  console.log(`\n✅ ${result.count} grupo(s) reseteados a PENDING\n`);
}

fixStuckRound();
