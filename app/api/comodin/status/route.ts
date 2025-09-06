import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string; email?: string | null } | undefined;
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const url = new URL(req.url);
    const roundId = url.searchParams.get("roundId");
    if (!roundId) return NextResponse.json({ error: "Falta roundId" }, { status: 400 });

    // TODO: Implementar con tu schema. Stub seguro:
    return NextResponse.json({
      used: false,
      mode: null,
      canUseMean: true,
      canUseSubstitute: false,
      message: "Estado simulado. Envíame tu schema para persistencia real.",
      tournamentInfo: { maxComodines: 1, comodinesUsed: 0, comodinesRemaining: 1 },
      substitutePlayerId: null,
      substitutePlayerName: null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error inesperado" }, { status: 500 });
  }
}
