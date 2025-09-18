// app/api/debug/session/route.ts - DEBUG TEMPORAL
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log("[DEBUG] Headers recibidos:", Object.fromEntries(request.headers.entries()));
    
    const session = await getServerSession(authOptions);
    
    console.log("[DEBUG] Session completa:", JSON.stringify(session, null, 2));
    
    return NextResponse.json({
      success: true,
      sessionExists: !!session,
      userId: session?.user?.id || null,
      userEmail: session?.user?.email || null,
      isAdmin: session?.user?.isAdmin || false,
      playerId: (session?.user as any)?.playerId || null,
      cookies: request.headers.get('cookie') || 'No cookies',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("[DEBUG] Error getting session:", error);
    return NextResponse.json({
      error: "Session error",
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}