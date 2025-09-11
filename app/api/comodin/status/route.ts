// app/api/comodin/status/route.ts - IMPLEMENTACIÓN REAL
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
// ✅ CORREGIDO: Usar el archivo server que tiene las funciones de Prisma
import { getComodinStatus } from "@/lib/comodin.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string; email?: string | null; playerId?: string } | undefined;
    
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Obtener playerId desde la sesión
    const playerId = (user as any)?.playerId as string | undefined;
    if (!playerId) {
      return NextResponse.json({ error: "No se encontró información del jugador" }, { status: 400 });
    }

    const url = new URL(req.url);
    const roundId = url.searchParams.get("roundId");
    
    if (!roundId) {
      return NextResponse.json({ error: "Falta roundId" }, { status: 400 });
    }

    // ✅ CORREGIDO: Usar la función real del servidor
    const status = await getComodinStatus(playerId, roundId);
    
    if (!status) {
      return NextResponse.json({ 
        error: "No se encontró información del comodín para esta ronda" 
      }, { status: 404 });
    }

    return NextResponse.json(status);
    
  } catch (err: any) {
    console.error("[COMODIN STATUS] Error:", err);
    return NextResponse.json({ 
      error: err?.message ?? "Error inesperado al obtener estado del comodín" 
    }, { status: 500 });
  }
}