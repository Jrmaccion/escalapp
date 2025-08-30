// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({ 
      where: { email } 
    });
    
    if (existingUser) {
      return NextResponse.json({ error: "El email ya está registrado" }, { status: 400 });
    }

    // Crear usuario y jugador
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword, 
        isAdmin: false 
      }
    });

    const player = await prisma.player.create({
      data: { 
        userId: user.id, 
        name 
      }
    });

    return NextResponse.json({ 
      message: "Usuario registrado exitosamente",
      userId: user.id,
      playerId: player.id
    });

  } catch (error) {
    console.error("Error registering user:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}