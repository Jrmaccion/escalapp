import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { roundId } = await req.json();

  if (!roundId) {
    return NextResponse.json({ error: "roundId requerido" }, { status: 400 });
  }

  try {
    const groups = await prisma.group.findMany({
      where: { roundId },
      include: {
        players: true,
        matches: { where: { isConfirmed: true } },
      },
    });

    let totalUpdated = 0;

    for (const group of groups) {
      // [Mismo código de cálculo que arriba]
      // ...
      totalUpdated++;
    }

    return NextResponse.json({ 
      success: true, 
      groupsUpdated: totalUpdated,
      message: `${totalUpdated} grupos recalculados correctamente`
    });
  } catch (error: any) {
    console.error("Error recalculando:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}