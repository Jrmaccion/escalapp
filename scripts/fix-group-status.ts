// scripts/fix-group-status.ts - Corregir estado de un grupo específico
import { PrismaClient, GroupStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function fixGroupStatus() {
  try {
    const roundId = 'cmfbpafow0006c0qrs8bwl6k1';
    const groupNumber = 3;

    console.log('\n🔧 Corrigiendo estado del Grupo 3...\n');

    // Buscar el grupo
    const group = await prisma.group.findFirst({
      where: {
        roundId,
        number: groupNumber,
      },
      include: {
        matches: {
          select: {
            id: true,
            isConfirmed: true,
          },
        },
      },
    });

    if (!group) {
      console.log('❌ Grupo no encontrado');
      process.exit(1);
    }

    console.log(`📌 Grupo ${groupNumber} encontrado (ID: ${group.id})`);
    console.log(`   Estado actual: ${group.status}`);
    console.log(`   Partidos confirmados: ${group.matches.filter(m => m.isConfirmed).length}/3\n`);

    if (group.status === GroupStatus.PLAYED) {
      console.log('✅ El grupo ya está marcado como PLAYED. No se requiere acción.');
      process.exit(0);
    }

    const confirmedMatches = group.matches.filter(m => m.isConfirmed).length;

    if (confirmedMatches === 3) {
      console.log('✅ El grupo tiene 3 partidos confirmados. Actualizando a PLAYED...\n');

      await prisma.group.update({
        where: { id: group.id },
        data: {
          status: GroupStatus.PLAYED,
          skippedReason: null,
        },
      });

      console.log('✅ Grupo actualizado correctamente a PLAYED\n');
    } else {
      console.log(`⚠️  El grupo solo tiene ${confirmedMatches}/3 partidos confirmados.`);
      console.log('   No se actualizará el estado por seguridad.\n');
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixGroupStatus();
