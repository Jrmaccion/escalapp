// scripts/debug-login-issue.ts
// Ejecutar: npx tsx scripts/debug-login-issue.ts

import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function debugLoginIssue() {
  console.log('='.repeat(60));
  console.log('🔍 DIAGNÓSTICO COMPLETO DE LOGIN');
  console.log('='.repeat(60));
  
  // Paso 1: Verificar variables de entorno
  console.log('\n1. VARIABLES DE ENTORNO:');
  console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? 'PRESENTE' : '❌ FALTA');
  console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL || '❌ NO DEFINIDA');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'PRESENTE' : '❌ FALTA');
  
  if (!process.env.NEXTAUTH_SECRET) {
    console.log('❌ FALTA NEXTAUTH_SECRET - esto impide crear sesiones válidas');
  }

  // Paso 2: Listar todos los usuarios
  try {
    console.log('\n2. USUARIOS EN BASE DE DATOS:');
    const allUsers = await prisma.user.findMany({
      select: { 
        id: true, 
        email: true, 
        name: true, 
        password: true,
        isAdmin: true,
        createdAt: true 
      },
      orderBy: { createdAt: 'desc' },
      take: 10 // últimos 10
    });

    if (allUsers.length === 0) {
      console.log('❌ NO HAY USUARIOS EN LA BASE DE DATOS');
      return;
    }

    console.log(`📊 Total usuarios: ${allUsers.length}`);
    allUsers.forEach((user, index) => {
      console.log(`\n--- Usuario ${index + 1} ---`);
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Nombre: ${user.name}`);
      console.log(`Admin: ${user.isAdmin}`);
      console.log(`Creado: ${user.createdAt}`);
      console.log(`Tiene password: ${user.password ? 'SÍ' : '❌ NO'}`);
      
      if (user.password) {
        console.log(`Hash inicia con: ${user.password.substring(0, 10)}...`);
        console.log(`Longitud hash: ${user.password.length} caracteres`);
        
        // Verificar formato bcrypt
        const isBcryptFormat = user.password.match(/^\$2[aby]?\$\d{2}\$/);
        console.log(`Formato bcrypt válido: ${isBcryptFormat ? 'SÍ' : '❌ NO'}`);
      }
    });

    // Paso 3: Test de autenticación con el usuario más reciente
    const latestUser = allUsers[0];
    console.log('\n3. TEST DE AUTENTICACIÓN:');
    console.log(`Testeando con: ${latestUser.email}`);
    
    // Simular contraseñas comunes que podrían haber usado
    const testPasswords = [
      'password123',
      '12345678',
      'Password123',
      'test1234',
      'admin123',
      'password1',
      'qwerty123'
    ];

    console.log('\nProbando contraseñas comunes...');
    let passwordFound = false;

    for (const testPwd of testPasswords) {
      try {
        if (latestUser.password) {
          const isMatch = await bcrypt.compare(testPwd, latestUser.password);
          if (isMatch) {
            console.log(`✅ CONTRASEÑA ENCONTRADA: "${testPwd}"`);
            passwordFound = true;
            break;
          }
        }
      } catch (error) {
        console.log(`❌ Error probando "${testPwd}":`, error);
      }
    }

    if (!passwordFound) {
      console.log('❌ Ninguna contraseña común funcionó');
      
      // Generar nuevo hash de prueba
      console.log('\n4. GENERANDO NUEVO HASH DE PRUEBA:');
      const testPassword = 'test123456';
      const newHash = await bcrypt.hash(testPassword, 12);
      console.log(`Nuevo hash para "${testPassword}":`, newHash);
      
      // Verificar que el nuevo hash funciona
      const testNewHash = await bcrypt.compare(testPassword, newHash);
      console.log(`Test nuevo hash: ${testNewHash ? 'FUNCIONA' : 'FALLO'}`);
      
      console.log(`\n🔧 SOLUCIÓN RECOMENDADA:`);
      console.log(`Ejecuta esta query en tu base de datos:`);
      console.log(`UPDATE users SET password = '${newHash}' WHERE email = '${latestUser.email}';`);
      console.log(`Luego intenta login con email: ${latestUser.email} y password: ${testPassword}`);
    }

    // Paso 4: Verificar encoding
    console.log('\n5. VERIFICACIÓN DE ENCODING:');
    const hasEncodingIssues = latestUser.email.includes('Ã') || 
                             latestUser.name?.includes('Ã') ||
                             false;
    console.log(`Problemas de encoding detectados: ${hasEncodingIssues ? 'SÍ ❌' : 'NO ✅'}`);

    // Paso 5: Test de creación de usuario
    console.log('\n6. TEST DE CREACIÓN DE USUARIO:');
    const testEmail = 'debug-test@example.com';
    const testPassword = 'DebugTest123';
    
    try {
      // Eliminar si existe
      await prisma.user.deleteMany({ where: { email: testEmail } });
      
      // Crear nuevo usuario de prueba
      const hashedPassword = await bcrypt.hash(testPassword, 12);
      const testUser = await prisma.user.create({
        data: {
          name: 'Usuario de Prueba',
          email: testEmail,
          password: hashedPassword,
          isAdmin: false,
        }
      });
      
      console.log(`✅ Usuario de prueba creado: ${testUser.id}`);
      
      // Test inmediato de login
      const loginTest = await bcrypt.compare(testPassword, testUser.password);
      console.log(`✅ Login test inmediato: ${loginTest ? 'FUNCIONA' : 'FALLA'}`);
      
      if (loginTest) {
        console.log(`\n🎉 SOLUCIÓN ENCONTRADA:`);
        console.log(`El sistema funciona correctamente.`);
        console.log(`Intenta login con:`);
        console.log(`Email: ${testEmail}`);
        console.log(`Password: ${testPassword}`);
      }
      
      // Limpiar usuario de prueba
      await prisma.user.delete({ where: { id: testUser.id } });
      console.log('🧹 Usuario de prueba eliminado');
      
    } catch (error) {
      console.log('❌ Error en test de creación:', error);
    }

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ DIAGNÓSTICO COMPLETADO');
  console.log('='.repeat(60));
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  debugLoginIssue()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}