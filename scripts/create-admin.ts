// scripts/create-admin.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type Args = {
  email?: string;
  password?: string;
  name?: string;
};

// Parseo muy simple de argumentos --email= --password= --name=
function parseArgs(): Args {
  const args: Args = {};
  for (const part of process.argv.slice(2)) {
    const [key, value] = part.split("=");
    if (key === "--email") args.email = value;
    if (key === "--password") args.password = value;
    if (key === "--name") args.name = value;
  }
  return args;
}

async function main() {
  // Permite ENV o argumentos; si nada, usa defaults cómodos para pruebas
  const {
    email = process.env.ADMIN_EMAIL || "admin@escalapp.com",
    password = process.env.ADMIN_PASSWORD || "password123",
    name = process.env.ADMIN_NAME || "Administrador",
  } = parseArgs();

  if (!process.env.DATABASE_URL) {
    console.error("❌ Falta DATABASE_URL en el entorno. Asegúrate de tener .env/.env.local configurado.");
    process.exit(1);
  }

  console.log("🔐 Creando/actualizando usuario admin…");
  console.log(`📧 Email: ${email}`);
  console.log(`👤 Nombre: ${name}`);

  const hashed = await bcrypt.hash(password, 10);

  // Crea si no existe; si existe, lo convierte en admin y actualiza password/name
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      isAdmin: true,
      password: hashed,
    },
    create: {
      email,
      name,
      isAdmin: true,
      password: hashed,
    },
  });

  console.log("✅ Admin listo:");
  console.log({ id: admin.id, email: admin.email, isAdmin: admin.isAdmin });
}

main()
  .catch((e) => {
    console.error("❌ Error creando admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
