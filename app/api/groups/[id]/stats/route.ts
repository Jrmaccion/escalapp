// app/api/groups/[id]/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroupQuickStats } from "@/lib/points-calculator";

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ 
        success: false,
        error: "No autorizado" 
      }, { status: 401 });
    }

    const groupId = params.id;
    
    console.log(`[group-stats API] Obteniendo estadísticas rápidas para grupo ${groupId}`);
    
    const stats = await getGroupQuickStats(groupId);
    
    if (!stats) {
      return NextResponse.json({ 
        success: false,
        error: "Grupo no encontrado" 
      }, { status: 404 });
    }

    console.log(`[group-stats API] Stats obtenidas: ${stats.completionRate}% completo`);
    
    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        hasRecentChanges: stats.hasChanges // Renombrar para compatibilidad
      },
      metadata: {
        calculatedAt: new Date().toISOString(),
        version: "1.0"
      }
    });

  } catch (error: any) {
    console.error("[group-stats API] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Error interno del servidor",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}