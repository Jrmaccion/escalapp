// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    // Validación de campos requeridos
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son obligatorios" }, 
        { status: 400 }
      );
    }

    // Validación de contraseña consistente (8+ caracteres, letras y números)
    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" }, 
        { status: 400 }
      );
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: "La contraseña debe incluir letras y números" }, 
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Verificar si el usuario ya existe (insensible a mayúsculas)
    const existingUser = await prisma.user.findFirst({
      where: { 
        email: { 
          equals: normalizedEmail, 
          mode: "insensitive" 
        } 
      },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" }, 
        { status: 409 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Crear usuario
    const newUser = await prisma.user.create({
      data: {
        name: name?.trim() || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        password: hashedPassword,
        isAdmin: false, // Usuarios normales por defecto
      },
      select: { 
        id: true, 
        name: true, 
        email: true 
      },
    });

    return NextResponse.json({ 
      ok: true, 
      message: "Usuario registrado exitosamente",
      user: newUser 
    });

  } catch (error) {
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" }, 
      { status: 500 }
    );
  }
}