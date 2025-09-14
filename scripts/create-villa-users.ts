// scripts/create-villa-users.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Usuarios de Villa extraídos de tu CSV
const villaUsers = [
  { name: "Cesar Veci", email: "Veci@villa.com", password: "Veci1234" },
  { name: "Jaime", email: "Jaime@villa.com", password: "Jaime123" },
  { name: "Adrian Ares", email: "AdrianAres@villa.com", password: "AAres123" },
  { name: "Chadri", email: "Chadri@villa.com", password: "Chadri12" },
  { name: "Alejandro Arce", email: "AlejandroArce@villa.com", password: "Arce1234" },
  { name: "Alonso", email: "Alonso@villa.com", password: "Alonso12" },
  { name: "Alvaro Solana", email: "AlvaroSolana@villa.com", password: "Solana12" },
  { name: "Bertucu", email: "Bertucu@villa.com", password: "Bertucu1" },
  { name: "K-Style", email: "K-Style@villa.com", password: "K-Style1" },
  { name: "Chemi", email: "Chemi@villa.com", password: "Chemi123" },
  { name: "Dani", email: "Dani@villa.com", password: "Dani1234" },
  { name: "Eric", email: "Eric@villa.com", password: "Eric1234" },
  { name: "Ethan", email: "Ethan@villa.com", password: "Ethan123" },
  { name: "Iñigo", email: "Iñigo@villa.com", password: "Iñigo123" },
  { name: "Javi Ostolaza", email: "JaviOstolaza@villa.com", password: "Ostolaza1" },
  { name: "Pekas", email: "Pekas@villa.com", password: "Pekas123" },
  { name: "Jose", email: "Jose@villa.com", password: "Jose1234" },
  { name: "Josu", email: "Josu@villa.com", password: "Josu1234" },
  { name: "Manu F.", email: "ManuF.@villa.com", password: "Manuf123" },
  { name: "Pablo Palacios", email: "PabloPalacios@villa.com", password: "Palacios1" },
  { name: "David Rubio", email: "DavidRubio@villa.com", password: "Rubio123" },
  { name: "Sendoa", email: "Sendoa@villa.com", password: "Sendoa12" },
  { name: "Sergio Lopez", email: "SergioLopez@villa.com", password: "Lopez134" },
  { name: "Tojel", email: "Tojel@villa.com", password: "Tojel123" },
];

async function createVillaUsers() {
  console.log('🏆 Creando usuarios del Villa Club...');
  console.log(`📊 Total de usuarios a crear: ${villaUsers.length}`);
  console.log('🔍 DATABASE_URL actual:', process.env.DATABASE_URL);
  console.log('🔍 Archivo .env.production.local está siendo usado');

  try {
    // Verificar conexión
    await prisma.$connect();
    console.log('✅ Conectado a la base de datos');

    let usersCreated = 0;
    let playersCreated = 0;
    let skipped = 0;
    const errors = [];

    for (const userData of villaUsers) {
      try {
        console.log(`\n🔄 Procesando: ${userData.name} (${userData.email})`);

        // Verificar si el usuario ya existe por email
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email },
          include: { player: true }
        });

        if (existingUser) {
          console.log(`   ⚠️  Usuario ya existe: ${userData.email}`);
          skipped++;
          continue;
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(userData.password, 12);

        // Crear usuario y player en una transacción
        const result = await prisma.$transaction(async (tx) => {
          // 1. Crear User
          const newUser = await tx.user.create({
            data: {
              name: userData.name,
              email: userData.email,
              password: hashedPassword,
              isAdmin: false,
            }
          });

          // 2. Crear Player asociado
          const newPlayer = await tx.player.create({
            data: {
              userId: newUser.id,
              name: userData.name, // Usar el mismo nombre
            }
          });

          return { user: newUser, player: newPlayer };
        });

        console.log(`   ✅ Usuario creado: ${result.user.name} (ID: ${result.user.id})`);
        console.log(`   ✅ Player creado: ${result.player.name} (ID: ${result.player.id})`);
        
        usersCreated++;
        playersCreated++;

      } catch (error: any) {
        console.error(`   ❌ Error procesando ${userData.email}:`, error.message);
        errors.push({
          email: userData.email,
          name: userData.name,
          error: error.message
        });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN FINAL:');
    console.log('='.repeat(60));
    console.log(`✅ Usuarios creados: ${usersCreated}`);
    console.log(`✅ Players creados: ${playersCreated}`);
    console.log(`⚠️  Usuarios omitidos (ya existían): ${skipped}`);
    console.log(`❌ Errores: ${errors.length}`);
    console.log(`📝 Total procesados: ${villaUsers.length}`);

    if (errors.length > 0) {
      console.log('\n🚨 ERRORES DETALLADOS:');
      errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.name} (${err.email}): ${err.error}`);
      });
    }

    // Verificación final
    const totalUsers = await prisma.user.count();
    const totalPlayers = await prisma.player.count();
    console.log(`\n📈 ESTADO ACTUAL DE LA BASE DE DATOS:`);
    console.log(`👥 Total usuarios en BD: ${totalUsers}`);
    console.log(`🎾 Total players en BD: ${totalPlayers}`);

  } catch (error) {
    console.error('💥 Error general del script:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Desconectado de la base de datos');
  }
}

// Ejecutar el script
createVillaUsers()
  .then(() => {
    console.log('\n🎉 ¡Script completado exitosamente!');
    console.log('👍 Todos los usuarios del Villa están listos para usar Escalapp');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 El script falló:', error);
    console.log('\n🔧 Posibles soluciones:');
    console.log('1. Verificar que DATABASE_URL esté configurada correctamente');
    console.log('2. Comprobar que la base de datos esté accesible');
    console.log('3. Ejecutar: npx prisma migrate deploy');
    console.log('4. Verificar permisos de escritura en la base de datos');
    process.exit(1);
  });