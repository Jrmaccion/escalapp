// app/api/groups/[id]/skip/route.ts - VERSIÓN SIMPLIFICADA
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GroupStatus } from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      );
    }

    const groupId = decodeURIComponent(params.id);
    const body = await req.json();
    const { reason } = body;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        round: { select: { isClosed: true } },
        matches: { select: { isConfirmed: true } },
        players: { select: { playerId: true } }
      }
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    if (group.round.isClosed) {
      return NextResponse.json(
        { error: "No se puede modificar una ronda cerrada" },
        { status: 400 }
      );
    }

    const confirmedMatches = group.matches.filter(m => m.isConfirmed).length;

    await prisma.$transaction(async (tx) => {
      // Actualizar grupo (solo campos que existen)
      await tx.group.update({
        where: { id: groupId },
        data: {
          status: GroupStatus.SKIPPED,
          skippedReason: reason || 'NO_AGREEMENT'
        }
      });

      // Bloquear jugadores
      await tx.groupPlayer.updateMany({
        where: { groupId },
        data: { locked: true }
      });

      // Registrar ruptura de racha
      for (const gp of group.players) {
        await tx.streakHistory.create({
          data: {
            playerId: gp.playerId,
            roundId: group.roundId,
            groupId: group.id,
            streakType: 'BROKEN_NO_PLAY',
            streakCount: 0,
            bonusPoints: 0
          }
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Grupo marcado como no disputado",
      confirmedMatches,
      playersAffected: group.players.length
    });

  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Error interno", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = decodeURIComponent(params.id);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        matches: { select: { isConfirmed: true } },
        players: { select: { locked: true } },
        round: { select: { number: true, isClosed: true } }
      }
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    const confirmedMatches = group.matches.filter(m => m.isConfirmed).length;

    return NextResponse.json({
      group: {
        id: group.id,
        status: group.status,
        isSkipped: group.status === GroupStatus.SKIPPED,
        skippedReason: group.skippedReason
      },
      matches: {
        confirmed: confirmedMatches,
        total: group.matches.length
      },
      canBeMarkedSkipped: !group.round.isClosed
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: "Error interno", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const groupId = decodeURIComponent(params.id);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { round: true, players: true }
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    if (group.round.isClosed) {
      return NextResponse.json({ error: "Ronda cerrada" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.group.update({
        where: { id: groupId },
        data: {
          status: GroupStatus.PENDING,
          skippedReason: null
        }
      });

      await tx.groupPlayer.updateMany({
        where: { groupId },
        data: { locked: false }
      });
    });

    return NextResponse.json({
      success: true,
      message: "Grupo restaurado a estado PENDING"
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: "Error interno", details: error.message },
      { status: 500 }
    );
  }
}