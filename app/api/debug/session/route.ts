// app/api/debug/session/route.ts
// 🔒 Solo accesible en desarrollo y para administradores
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Bloquear por defecto en producción
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const session = await getServerSession(authOptions);
    const isAdmin = !!(session?.user as any)?.isAdmin;

    if (!isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Información básica útil para debug (evitar volcado masivo)
    return NextResponse.json({
      ok: true,
      nodeEnv: process.env.NODE_ENV,
      nextUrl: request.nextUrl.toString(),
      userEmail: session?.user?.email || null,
      isAdmin,
      playerId: (session?.user as any)?.playerId || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[DEBUG] Error getting session:", error);
    return NextResponse.json(
      {
        error: "Session error",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
