import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const search = searchParams.get('search') || '';
    const tournamentId = searchParams.get('tournamentId');
    const roundId = searchParams.get('roundId');

    // Construir filtros dinámicos
    const whereClause: any = {};

    // Filtro por torneo específico
    if (tournamentId) {
      whereClause.group = {
        round: {
          tournamentId
        }
      };
    }

    // Filtro por ronda específica
    if (roundId) {
      whereClause.group = {
        ...whereClause.group,
        roundId
      };
    }

    // Obtener todos los matches con información completa
    const matches = await prisma.match.findMany({
      where: whereClause,
      include: {
        group: {
          include: {
            round: {
              include: {
                tournament: true
              }
            }
          }
        }
      },
      orderBy: [
        { group: { round: { tournament: { title: 'asc' } } } },
        { group: { round: { number: 'desc' } } },
        { group: { number: 'asc' } },
        { setNumber: 'asc' }
      ]
    });

    // Obtener nombres de jugadores
    const playerIds = new Set<string>();
    matches.forEach(match => {
      playerIds.add(match.team1Player1Id);
      playerIds.add(match.team1Player2Id);
      playerIds.add(match.team2Player1Id);
      playerIds.add(match.team2Player2Id);
      if (match.reportedById) playerIds.add(match.reportedById);
      if (match.confirmedById) playerIds.add(match.confirmedById);
    });

    const players = await prisma.player.findMany({
      where: { id: { in: Array.from(playerIds) } }
    });

    const playerMap = players.reduce((acc, player) => {
      acc[player.id] = player.name;
      return acc;
    }, {} as Record<string, string>);

    // Formatear matches para el frontend
    let formattedMatches = matches.map(match => ({
      id: match.id,
      setNumber: match.setNumber,
      team1Player1Name: playerMap[match.team1Player1Id] || 'Jugador desconocido',
      team1Player2Name: playerMap[match.team1Player2Id] || 'Jugador desconocido',
      team2Player1Name: playerMap[match.team2Player1Id] || 'Jugador desconocido',
      team2Player2Name: playerMap[match.team2Player2Id] || 'Jugador desconocido',
      team1Games: match.team1Games,
      team2Games: match.team2Games,
      tiebreakScore: match.tiebreakScore,
      isConfirmed: match.isConfirmed,
      reportedById: match.reportedById,
      reportedByName: match.reportedById ? (playerMap[match.reportedById] || 'Desconocido') : null,
      confirmedById: match.confirmedById,
      confirmedByName: match.confirmedById ? (playerMap[match.confirmedById] || 'Desconocido') : null,
      photoUrl: match.photoUrl,
      groupNumber: match.group.number,
      groupLevel: match.group.level,
      roundNumber: match.group.round.number,
      tournamentId: match.group.round.tournament.id,
      tournamentTitle: match.group.round.tournament.title,
      isRoundClosed: match.group.round.isClosed,
      roundEndDate: match.group.round.endDate.toISOString(),
      createdAt: match.group.round.createdAt?.toISOString() || new Date().toISOString()
    }));

    // Aplicar filtros
    if (filter !== 'all') {
      formattedMatches = formattedMatches.filter(match => {
        switch (filter) {
          case 'pending':
            return match.reportedById && !match.isConfirmed;
          case 'confirmed':
            return match.isConfirmed;
          case 'unplayed':
            return !match.reportedById && match.team1Games === null;
          case 'conflicts':
            // Matches reportados hace más de 24h sin confirmar
            const reportDate = new Date(match.createdAt);
            const now = new Date();
            const hoursDiff = (now.getTime() - reportDate.getTime()) / (1000 * 60 * 60);
            return match.reportedById && !match.isConfirmed && hoursDiff > 24;
          case 'active_rounds':
            return !match.isRoundClosed;
          case 'needs_review':
            // Matches que pueden necesitar revisión admin
            return (match.reportedById && !match.isConfirmed) || 
                   (!match.reportedById && !match.isRoundClosed);
          default:
            return true;
        }
      });
    }

    // Aplicar búsqueda por texto
    if (search) {
      const searchTerm = search.toLowerCase();
      formattedMatches = formattedMatches.filter(match =>
        match.team1Player1Name.toLowerCase().includes(searchTerm) ||
        match.team1Player2Name.toLowerCase().includes(searchTerm) ||
        match.team2Player1Name.toLowerCase().includes(searchTerm) ||
        match.team2Player2Name.toLowerCase().includes(searchTerm) ||
        match.tournamentTitle.toLowerCase().includes(searchTerm) ||
        match.reportedByName?.toLowerCase().includes(searchTerm) ||
        match.confirmedByName?.toLowerCase().includes(searchTerm)
      );
    }

    // Calcular estadísticas
    const stats = {
      totalMatches: matches.length,
      confirmedMatches: matches.filter(m => m.isConfirmed).length,
      pendingMatches: matches.filter(m => m.reportedById && !m.isConfirmed).length,
      reportedMatches: matches.filter(m => m.reportedById).length,
      unplayedMatches: matches.filter(m => !m.reportedById && m.team1Games === null).length,
      conflictMatches: matches.filter(m => {
        if (!m.reportedById || m.isConfirmed) return false;
        const reportDate = new Date();
        const now = new Date();
        const hoursDiff = (now.getTime() - reportDate.getTime()) / (1000 * 60 * 60);
        return hoursDiff > 24;
      }).length,
      activeRounds: matches.filter(m => !m.group.round.isClosed).length,
      completionRate: matches.length > 0 ? Math.round((matches.filter(m => m.isConfirmed).length / matches.length) * 100) : 0
    };

    // Obtener lista de torneos para filtros
    const tournaments = await prisma.tournament.findMany({
      select: {
        id: true,
        title: true,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      matches: formattedMatches,
      stats,
      tournaments,
      appliedFilter: filter,
      appliedSearch: search,
      totalFound: formattedMatches.length
    });

  } catch (error) {
    console.error("Error fetching admin results:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { matchIds, action, resultData } = body;

    if (!Array.isArray(matchIds) || matchIds.length === 0) {
      return NextResponse.json({ error: "IDs de matches requeridos" }, { status: 400 });
    }

    let updatedCount = 0;

    switch (action) {
      case 'validate_pending':
        // Validar matches pendientes (forzar confirmación)
        const validateResult = await prisma.match.updateMany({
          where: {
            id: { in: matchIds },
            reportedById: { not: null },
            isConfirmed: false
          },
          data: {
            isConfirmed: true,
            confirmedById: session.user.id
          }
        });
        updatedCount = validateResult.count;
        break;

      case 'force_result':
        // Forzar resultado específico
        if (!resultData) {
          return NextResponse.json({ error: "Datos de resultado requeridos" }, { status: 400 });
        }

        for (const matchId of matchIds) {
          await prisma.match.update({
            where: { id: matchId },
            data: {
              team1Games: resultData.team1Games,
              team2Games: resultData.team2Games,
              tiebreakScore: resultData.tiebreakScore || null,
              isConfirmed: true,
              reportedById: session.user.id,
              confirmedById: session.user.id
            }
          });
          updatedCount++;
        }
        break;

      case 'clear_results':
        // Limpiar resultados
        const clearResult = await prisma.match.updateMany({
          where: { id: { in: matchIds } },
          data: {
            team1Games: null,
            team2Games: null,
            tiebreakScore: null,
            isConfirmed: false,
            reportedById: null,
            confirmedById: null,
            photoUrl: null
          }
        });
        updatedCount = clearResult.count;
        break;

      case 'mark_confirmed':
        // Marcar como confirmados sin cambiar resultados
        const confirmResult = await prisma.match.updateMany({
          where: {
            id: { in: matchIds },
            team1Games: { not: null },
            team2Games: { not: null }
          },
          data: {
            isConfirmed: true,
            confirmedById: session.user.id
          }
        });
        updatedCount = confirmResult.count;
        break;

      default:
        return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    }

    // Recalcular puntos para los grupos afectados si es necesario
    if (action === 'validate_pending' || action === 'force_result' || action === 'mark_confirmed') {
      const affectedMatches = await prisma.match.findMany({
        where: { id: { in: matchIds } },
        select: { group: { select: { id: true } } },
        distinct: ['groupId']
      });

      for (const match of affectedMatches) {
        try {
          // Usar la función de recálculo si está disponible
          await fetch(`${process.env.NEXTAUTH_URL}/api/admin/recalculate-group`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId: match.group.id })
          });
        } catch (recalcError) {
          console.warn(`Error recalculando grupo ${match.group.id}:`, recalcError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      message: `${updatedCount} matches actualizados correctamente`
    });

  } catch (error) {
    console.error("Error in batch update:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}