// app/api/admin/players/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const players = await prisma.player.findMany({
      include: {
        user: {
          select: {
            email: true,
            isAdmin: true,
            createdAt: true
          }
        },
        tournaments: {
          include: {
            tournament: {
              select: {
                title: true,
                isActive: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const formattedPlayers = players.map(player => ({
      id: player.id,
      name: player.name,
      email: player.user.email,
      isAdmin: player.user.isAdmin,
      tournamentsCount: player.tournaments.length,
      activeTournaments: player.tournaments.filter(t => t.tournament.isActive).length,
      createdAt: player.user.createdAt
    }));

    return NextResponse.json({ players: formattedPlayers });

  } catch (error) {
    console.error("Error fetching players:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { name, email, password, isAdmin = false } = await request.json();

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

    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword, 
        isAdmin 
      }
    });

    const player = await prisma.player.create({
      data: { 
        userId: user.id, 
        name 
      }
    });

    return NextResponse.json({ 
      message: "Jugador creado exitosamente",
      player: {
        id: player.id,
        name: player.name,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });

  } catch (error) {
    console.error("Error creating player:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}