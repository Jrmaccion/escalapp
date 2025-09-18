// app/api/groups/[id]/points-preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateGroupPointsPreview, getGroupQuickStats } from "@/lib/points-calculator";

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
    const { searchParams } = new URL(request.url);
    const quickMode = searchParams.get('quick') === 'true';
    
    console.log(`[points-preview API] ${quickMode ? 'Quick stats' : 'Full preview'} para grupo ${groupId}`);
    
    // Modo rápido: solo estadísticas básicas
    if (quickMode) {
      const stats = await getGroupQuickStats(groupId);
      
      if (!stats) {
        return NextResponse.json({ 
          success: false,
          error: "Grupo no encontrado" 
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: stats,
        metadata: {
          mode: 'quick',
          calculatedAt: new Date().toISOString(),
          version: "1.0"
        }
      });
    }
    
    // Modo completo: preview completo
    const preview = await calculateGroupPointsPreview(groupId);
    
    if (!preview) {
      return NextResponse.json({ 
        success: false,
        error: "Grupo no encontrado o error al calcular preview" 
      }, { status: 404 });
    }

    console.log(`[points-preview API] Preview calculado: ${preview.completionRate}% completo, ${preview.players.length} jugadores`);
    
    return NextResponse.json({
      success: true,
      data: preview,
      metadata: {
        mode: 'full',
        calculatedAt: new Date().toISOString(),
        version: "1.0",
        hasChanges: preview.completionRate > 0,
        performanceMs: Date.now() - Date.now() // placeholder para futuro
      }
    });

  } catch (error: any) {
    console.error("[points-preview API] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Error interno del servidor",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}