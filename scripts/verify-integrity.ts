// scripts/verify-integrity-fixed.ts - VERSIÓN CORREGIDA PARA BIGINT
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

// Cargar variables de entorno
const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
  try {
    const result = config({ path: resolve(process.cwd(), envFile) });
    if (result.parsed && result.parsed.DATABASE_URL) {
      console.log(`Variables de entorno cargadas desde ${envFile}`);
      break;
    }
  } catch (error) {
    console.log(`No se pudo cargar ${envFile}`);
  }
}

// Verificar que DATABASE_URL existe
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no encontrada en variables de entorno');
  console.log('Asegúrate de tener un archivo .env.local con DATABASE_URL configurada');
  process.exit(1);
}

const prisma = new PrismaClient();

// Helper para convertir BigInt a number de forma segura
function bigIntToNumber(value: bigint | number): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return value;
}

async function verifySystemIntegrity() {
  console.log('Verificando integridad del sistema...');

  try {
    // 1. Verificar conexión a la base de datos
    try {
      await prisma.$connect();
      console.log('Conexión a base de datos establecida');
    } catch (error) {
      console.error('No se puede conectar a la base de datos:', error);
      return false;
    }

    // 2. Verificar duplicados en posiciones (CORREGIDO PARA BIGINT)
    console.log('Verificando posiciones duplicadas...');
    const duplicatePositions = await prisma.$queryRaw<Array<{
      groupId: string;
      position: number;
      count: bigint;
    }>>`
      SELECT "groupId", position, COUNT(*) as count
      FROM group_players
      GROUP BY "groupId", position
      HAVING COUNT(*) > 1
    `;

    if (duplicatePositions.length > 0) {
      console.log('CRÍTICO: Posiciones duplicadas encontradas:');
      duplicatePositions.forEach(dup => {
        const count = bigIntToNumber(dup.count);
        console.log(`  Grupo ${dup.groupId}, posición ${dup.position}: ${count} duplicados`);
      });
      return false;
    }
    console.log('No hay posiciones duplicadas');

    // 3. Verificar jugadores duplicados en el mismo grupo (CORREGIDO PARA BIGINT)
    console.log('Verificando jugadores duplicados en grupos...');
    const duplicatePlayers = await prisma.$queryRaw<Array<{
      groupId: string;
      playerId: string;
      count: bigint;
    }>>`
      SELECT "groupId", "playerId", COUNT(*) as count
      FROM group_players
      GROUP BY "groupId", "playerId"
      HAVING COUNT(*) > 1
    `;

    if (duplicatePlayers.length > 0) {
      console.log('CRÍTICO: Jugadores duplicados en grupos:');
      duplicatePlayers.forEach(dup => {
        const count = bigIntToNumber(dup.count);
        console.log(`  Grupo ${dup.groupId}, jugador ${dup.playerId}: ${count} duplicados`);
      });
      return false;
    }
    console.log('No hay jugadores duplicados en grupos');

    // 4. Verificar posiciones secuenciales por grupo (USANDO PRISMA DIRECTO)
    console.log('Verificando secuencia de posiciones...');
    const groups = await prisma.group.findMany({
      include: {
        players: {
          orderBy: { position: 'asc' },
          select: { position: true, playerId: true }
        }
      }
    });

    let positionErrors = 0;
    for (const group of groups) {
      if (group.players.length === 0) continue;
      
      const positions = group.players.map(p => p.position);
      const expectedPositions = Array.from({length: group.players.length}, (_, i) => i + 1);
      
      if (JSON.stringify(positions) !== JSON.stringify(expectedPositions)) {
        console.log(`Posiciones no secuenciales en grupo ${group.id}:`);
        console.log(`  Actual: [${positions.join(', ')}]`);
        console.log(`  Esperado: [${expectedPositions.join(', ')}]`);
        positionErrors++;
      }
    }

    if (positionErrors > 0) {
      console.log(`CRÍTICO: ${positionErrors} grupos con posiciones no secuenciales`);
      return false;
    }
    console.log('Todas las posiciones son secuenciales');

    // 5. Verificar integridad de matches usando Prisma (EVITAR BIGINT)
    console.log('Verificando integridad de matches...');
    const totalMatches = await prisma.match.count();
    
    if (totalMatches > 0) {
      // Verificar matches con jugadores que no existen
      const matchesWithInvalidPlayers = [];
      const matches = await prisma.match.findMany({
        select: {
          id: true,
          team1Player1Id: true,
          team1Player2Id: true,
          team2Player1Id: true,
          team2Player2Id: true
        }
      });

      for (const match of matches) {
        const playerIds = [
          match.team1Player1Id,
          match.team1Player2Id,
          match.team2Player1Id,
          match.team2Player2Id
        ];

        const existingPlayers = await prisma.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true }
        });

        if (existingPlayers.length !== 4) {
          matchesWithInvalidPlayers.push({
            matchId: match.id,
            expectedPlayers: 4,
            foundPlayers: existingPlayers.length
          });
        }
      }

      if (matchesWithInvalidPlayers.length > 0) {
        console.log('ADVERTENCIA: Matches con jugadores inválidos:');
        matchesWithInvalidPlayers.slice(0, 5).forEach(match => {
          console.log(`  Match ${match.matchId}: ${match.foundPlayers}/${match.expectedPlayers} jugadores válidos`);
        });
        if (matchesWithInvalidPlayers.length > 5) {
          console.log(`  ... y ${matchesWithInvalidPlayers.length - 5} más`);
        }
      } else {
        console.log('Todos los matches tienen jugadores válidos');
      }
    }

    // 6. Verificar rondas cerradas vs abiertas
    console.log('Verificando estado de rondas...');
    const tournaments = await prisma.tournament.findMany({
      include: {
        rounds: {
          orderBy: { number: 'asc' }
        }
      }
    });

    for (const tournament of tournaments) {
      const closedRounds = tournament.rounds.filter(r => r.isClosed);
      const openRounds = tournament.rounds.filter(r => !r.isClosed);
      
      console.log(`  Torneo "${tournament.title}": ${closedRounds.length} cerradas, ${openRounds.length} abiertas`);
      
      // Verificar si hay gaps en rondas
      const sortedRounds = tournament.rounds.sort((a, b) => a.number - b.number);
      for (let i = 0; i < sortedRounds.length - 1; i++) {
        const current = sortedRounds[i];
        const next = sortedRounds[i + 1];
        
        if (next.number !== current.number + 1) {
          console.log(`  ADVERTENCIA: Gap entre ronda ${current.number} y ${next.number}`);
        }
        
        if (current.isClosed && next.number === current.number + 1 && next.isClosed && openRounds.length === 0) {
          // Esto está bien - rondas secuenciales cerradas
        }
      }
    }

    // 7. Resumen de estadísticas (USANDO PRISMA PARA EVITAR BIGINT)
    console.log('\nResumen del sistema:');
    const stats = {
      tournaments: await prisma.tournament.count(),
      rounds: await prisma.round.count(),
      groups: await prisma.group.count(),
      players: await prisma.player.count(),
      groupPlayers: await prisma.groupPlayer.count(),
      matches: await prisma.match.count(),
      confirmedMatches: await prisma.match.count({ where: { isConfirmed: true } })
    };

    Object.entries(stats).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    // 8. Verificar grupos sin jugadores o con pocos jugadores
    console.log('\nVerificando distribución de jugadores...');
    const groupSizes = await prisma.group.findMany({
      include: {
        _count: {
          select: { players: true }
        }
      }
    });

    const sizeCounts = new Map();
    groupSizes.forEach(group => {
      const size = group._count.players;
      sizeCounts.set(size, (sizeCounts.get(size) || 0) + 1);
    });

    Array.from(sizeCounts.entries()).sort(([a], [b]) => a - b).forEach(([size, count]) => {
      console.log(`  Grupos con ${size} jugadores: ${count}`);
    });

    console.log('\nVerificación de integridad completada - Sistema saludable');
    return true;

  } catch (error) {
    console.error('Error durante verificación:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar verificación
if (require.main === module) {
  verifySystemIntegrity()
    .then((success) => {
      console.log(success ? '\nVerificación exitosa' : '\nVerificación falló');
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Error fatal:', error);
      process.exit(1);
    });
}

export { verifySystemIntegrity };