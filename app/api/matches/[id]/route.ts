// app/api/matches/[id]/route.ts - VERSIÓN ROBUSTA CON VALIDACIONES ATÓMICAS
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// ✅ Enum para errores específicos de matches
enum MatchError {
  UNAUTHORIZED = "UNAUTHORIZED",
  MATCH_NOT_FOUND = "MATCH_NOT_FOUND",
  INVALID_DATA = "INVALID_DATA",
  INVALID_SCORE = "INVALID_SCORE",
  INVALID_TIEBREAK = "INVALID_TIEBREAK",
  ROUND_CLOSED = "ROUND_CLOSED",
  NO_PERMISSION = "NO_PERMISSION",
  ALREADY_REPORTED = "ALREADY_REPORTED",
  NO_RESULT_TO_CONFIRM = "NO_RESULT_TO_CONFIRM",
  CANNOT_CONFIRM_OWN = "CANNOT_CONFIRM_OWN",
  ALREADY_CONFIRMED = "ALREADY_CONFIRMED",
  CONCURRENT_MODIFICATION = "CONCURRENT_MODIFICATION",
  POINTS_CALCULATION_FAILED = "POINTS_CALCULATION_FAILED"
}

const MATCH_ERROR_MESSAGES = {
  [MatchError.UNAUTHORIZED]: "No autorizado",
  [MatchError.MATCH_NOT_FOUND]: "Partido no encontrado",
  [MatchError.INVALID_DATA]: "Datos inválidos",
  [MatchError.INVALID_SCORE]: "Marcador inválido",
  [MatchError.INVALID_TIEBREAK]: "Formato de tie-break inválido",
  [MatchError.ROUND_CLOSED]: "No se pueden modificar partidos de rondas cerradas",
  [MatchError.NO_PERMISSION]: "Sin permisos para modificar este partido",
  [MatchError.ALREADY_REPORTED]: "Ya hay un resultado reportado",
  [MatchError.NO_RESULT_TO_CONFIRM]: "No hay resultado para confirmar",
  [MatchError.CANNOT_CONFIRM_OWN]: "No puedes confirmar tu propio resultado",
  [MatchError.ALREADY_CONFIRMED]: "El resultado ya está confirmado",
  [MatchError.CONCURRENT_MODIFICATION]: "El partido ha sido modificado por otro usuario",
  [MatchError.POINTS_CALCULATION_FAILED]: "Error calculando puntos del grupo"
} as const;

// ✅ Tipo para validación de match
interface MatchValidationData {
  matchId: string;
  isConfirmed: boolean;
  reportedById: string | null;
  confirmedById: string | null;
  team1Games: number | null;
  team2Games: number | null;
  tiebreakScore: string | null;
  groupId: string;
  roundClosed: boolean;
  lastModified: Date;
}

// ✅ Validación robusta de marcador según reglas de pádel
function validatePadelScore(team1Games: number, team2Games: number, tiebreakScore?: string | null): void {
  console.log(`🔍 Validando: ${team1Games}-${team2Games}, tie-break: "${tiebreakScore}"`);
  
  // Validación básica
  if (team1Games < 0 || team1Games > 10 || team2Games < 0 || team2Games > 10) {
    console.log('❌ Error: Juegos fuera de rango');
    throw new Error(MatchError.INVALID_SCORE);
  }

  const maxGames = Math.max(team1Games, team2Games);
  const minGames = Math.min(team1Games, team2Games);
  const diff = Math.abs(team1Games - team2Games);

  console.log(`📊 Max: ${maxGames}, Min: ${minGames}, Diff: ${diff}`);

  // Al menos un equipo debe llegar a 4
  if (maxGames < 4) {
    console.log('❌ Error: Ningún equipo llegó a 4');
    throw new Error(MatchError.INVALID_SCORE);
  }

  // REGLAS DEL PÁDEL:
  
  // 1. Resultados directos a 4 con diferencia ≥ 2
  if (maxGames === 4) {
    console.log('🎯 Caso: Resultado directo a 4');
    if (diff < 2) {
      console.log('❌ Error: Diferencia < 2 en resultado a 4');
      throw new Error(MatchError.INVALID_SCORE); // 4-3 no válido
    }
    // 4-0, 4-1, 4-2 son válidos
    if (tiebreakScore) {
      console.log('❌ Error: Tie-break no permitido en resultado directo a 4');
      throw new Error(MatchError.INVALID_TIEBREAK);
    }
    console.log('✅ Resultado directo a 4 válido');
  }
  
  // 2. Resultados extendidos (5-3, 6-4, etc.)
  else if (maxGames >= 5) {
    console.log('🎯 Caso: Resultado extendido (≥5)');
    
    // Caso especial: 5-4 con tie-break (vino de 4-4)
    if (maxGames === 5 && minGames === 4) {
      console.log('🎯 Subcaso: 5-4 (debe tener tie-break)');
      if (!tiebreakScore) {
        console.log('❌ Error: 5-4 sin tie-break');
        throw new Error(MatchError.INVALID_TIEBREAK);
      }
      
      // Validar formato tie-break
      if (!/^\d+-\d+$/.test(tiebreakScore)) {
        console.log('❌ Error: Formato tie-break inválido');
        throw new Error(MatchError.INVALID_TIEBREAK);
      }
      
      const [tb1, tb2] = tiebreakScore.split('-').map(Number);
      console.log(`🏓 Tie-break: ${tb1}-${tb2}`);
      
      if (tb1 < 0 || tb2 < 0) {
        console.log('❌ Error: Puntos tie-break negativos');
        throw new Error(MatchError.INVALID_TIEBREAK);
      }
      
      if (Math.abs(tb1 - tb2) < 2) {
        console.log('❌ Error: Diferencia tie-break < 2');
        throw new Error(MatchError.INVALID_TIEBREAK);
      }
      
      if (Math.max(tb1, tb2) < 7) {
        console.log('❌ Error: Ganador tie-break < 7');
        throw new Error(MatchError.INVALID_TIEBREAK);
      }
      
      console.log('✅ Resultado 5-4 con tie-break válido');
    }
    // Otros casos: 5-3, 6-4, 7-5, etc. (diferencia de 2)
    else {
      console.log('🎯 Subcaso: Resultado extendido normal (diferencia 2)');
      if (diff !== 2) {
        console.log('❌ Error: Diferencia != 2 en resultado extendido');
        throw new Error(MatchError.INVALID_SCORE);
      }
      if (tiebreakScore) {
        console.log('❌ Error: Tie-break no permitido en resultado extendido normal');
        throw new Error(MatchError.INVALID_TIEBREAK);
      }
      console.log('✅ Resultado extendido normal válido');
    }
  }

  // 3. Casos inválidos específicos
  if (team1Games === team2Games && team1Games >= 4) {
    console.log('❌ Error: Resultado en empate no permitido');
    throw new Error(MatchError.INVALID_SCORE);
  }
  
  console.log('✅ Validación completa exitosa');
}

// ✅ Obtener datos del match con validación
async function getMatchValidationData(matchId: string): Promise<MatchValidationData> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      group: {
        include: {
          round: { select: { isClosed: true } }
        }
      }
    }
  });

  if (!match) {
    throw new Error(MatchError.MATCH_NOT_FOUND);
  }

  return {
    matchId: match.id,
    isConfirmed: match.isConfirmed,
    reportedById: match.reportedById,
    confirmedById: match.confirmedById,
    team1Games: match.team1Games,
    team2Games: match.team2Games,
    tiebreakScore: match.tiebreakScore,
    groupId: match.groupId,
    roundClosed: match.group.round.isClosed,
    lastModified: match.updatedAt
  };
}

// ✅ Verificar permisos del usuario
function validateUserPermissions(
  validationData: MatchValidationData,
  match: any,
  playerId: string | null,
  isAdmin: boolean
): void {
  if (!isAdmin && !playerId) {
    throw new Error(MatchError.UNAUTHORIZED);
  }

  if (validationData.roundClosed) {
    throw new Error(MatchError.ROUND_CLOSED);
  }

  if (!isAdmin) {
    const isPlayerInMatch = playerId && [
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id
    ].includes(playerId);

    if (!isPlayerInMatch) {
      throw new Error(MatchError.NO_PERMISSION);
    }
  }
}

// ✅ Recálculo de puntos con validación de integridad
async function recalculateGroupPointsAtomic(groupId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Obtener todos los matches confirmados del grupo
    const matches = await tx.match.findMany({
      where: { groupId, isConfirmed: true },
      orderBy: { setNumber: 'asc' }
    });

    // Obtener jugadores del grupo
    const groupPlayers = await tx.groupPlayer.findMany({
      where: { groupId },
      include: {
        player: true,
        group: {
          include: {
            round: {
              include: { tournament: true }
            }
          }
        }
      }
    });

    if (groupPlayers.length === 0) {
      throw new Error(MatchError.POINTS_CALCULATION_FAILED);
    }

    // Crear mapa de sustitutos
    const substituteMap = new Map<string, string>();
    for (const gp of groupPlayers) {
      if (gp.substitutePlayerId) {
        substituteMap.set(gp.substitutePlayerId, gp.playerId);
      }
    }

    // Calcular rachas consecutivas
    const playerStreaks = await calculateConsecutiveStreaks(groupId, tx);

    // Recalcular puntos para cada jugador
    for (const groupPlayer of groupPlayers) {
      let totalPoints = 0;

      // Si usó comodín de media, mantener esos puntos
      if (groupPlayer.usedComodin && !groupPlayer.substitutePlayerId) {
        totalPoints = groupPlayer.points || 0;
      } else {
        // Calcular puntos desde matches
        for (const match of matches) {
          const pointRecipientId = getPointRecipientForMatch(
            match, 
            groupPlayer.playerId, 
            substituteMap
          );
          if (pointRecipientId) {
            const playerPoints = calculatePlayerPointsInMatch(match, pointRecipientId);
            totalPoints += playerPoints;
          }
        }
      }

      // Aplicar bonus de racha (+2 puntos por match si racha >= 1)
      const playerStreak = playerStreaks[groupPlayer.playerId] || 0;
      if (playerStreak >= 1 && !groupPlayer.usedComodin) {
        const matchesPlayedByThisPlayer = matches.filter(match => {
          const physicalPlayerId = groupPlayer.substitutePlayerId || groupPlayer.playerId;
          return [
            match.team1Player1Id,
            match.team1Player2Id,
            match.team2Player1Id,
            match.team2Player2Id
          ].includes(physicalPlayerId);
        }).length;
        
        totalPoints += matchesPlayedByThisPlayer * 2;
      }

      // Actualizar puntos y racha atómicamente
      await tx.groupPlayer.update({
        where: { id: groupPlayer.id },
        data: { 
          points: totalPoints,
          streak: playerStreak
        }
      });
    }

    // Actualizar posiciones basadas en puntos
    await updateGroupPositionsAtomic(groupId, tx);
  }, {
    timeout: 20000 // 20 segundos timeout
  });
}

// ✅ Actualizar posiciones de forma atómica
async function updateGroupPositionsAtomic(groupId: string, tx: any): Promise<void> {
  const groupPlayers = await tx.groupPlayer.findMany({
    where: { groupId },
    orderBy: [
      { points: 'desc' },
      { streak: 'desc' }
    ]
  });

  for (let i = 0; i < groupPlayers.length; i++) {
    await tx.groupPlayer.update({
      where: { id: groupPlayers[i].id },
      data: { position: i + 1 }
    });
  }
}

// ✅ Funciones auxiliares existentes con mejores validaciones
function getPointRecipientForMatch(
  match: any, 
  groupPlayerId: string, 
  substituteMap: Map<string, string>
): string | null {
  const matchPlayerIds = [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id
  ];

  if (matchPlayerIds.includes(groupPlayerId)) {
    return groupPlayerId;
  }

  const substituteId = Array.from(substituteMap.keys()).find(
    subId => substituteMap.get(subId) === groupPlayerId
  );
  
  if (substituteId && matchPlayerIds.includes(substituteId)) {
    return substituteId;
  }

  return null;
}

function calculatePlayerPointsInMatch(match: any, playerId: string): number {
  let points = 0;
  const isTeam1 = match.team1Player1Id === playerId || match.team1Player2Id === playerId;
  const isTeam2 = match.team2Player1Id === playerId || match.team2Player2Id === playerId;

  if (!isTeam1 && !isTeam2) return 0;

  // +1 punto por cada juego ganado
  if (isTeam1) {
    points += match.team1Games || 0;
  } else {
    points += match.team2Games || 0;
  }

  // +1 punto extra si ganó el set
  let team1Won = false;
  
  // Caso especial: 5-4 con tie-break (vino de 4-4)
  if ((match.team1Games === 5 && match.team2Games === 4) || 
      (match.team2Games === 5 && match.team1Games === 4)) {
    if (match.tiebreakScore) {
      const [tb1, tb2] = match.tiebreakScore.split('-').map(Number);
      team1Won = tb1 > tb2;
    } else {
      // Sin tie-break, gana quien tiene más juegos
      team1Won = (match.team1Games || 0) > (match.team2Games || 0);
    }
  } else {
    // Casos normales: comparar juegos directamente
    team1Won = (match.team1Games || 0) > (match.team2Games || 0);
  }
  
  if ((isTeam1 && team1Won) || (isTeam2 && !team1Won)) {
    points += 1;
  }

  return points;
}

async function calculateConsecutiveStreaks(groupId: string, tx: any): Promise<Record<string, number>> {
  const group = await tx.group.findUnique({
    where: { id: groupId },
    include: {
      round: {
        include: { tournament: true }
      },
      players: true
    }
  });

  if (!group) return {};

  const streaks: Record<string, number> = {};
  
  for (const groupPlayer of group.players) {
    const playerId = groupPlayer.playerId;
    
    const playerRounds = await tx.groupPlayer.findMany({
      where: {
        playerId,
        group: {
          round: {
            tournamentId: group.round.tournament.id,
            number: { lte: group.round.number },
            isClosed: true
          }
        }
      },
      include: {
        group: {
          include: { round: true }
        }
      },
      orderBy: {
        group: {
          round: { number: 'desc' }
        }
      }
    });

    let consecutiveRounds = 0;
    let expectedRound = group.round.number - 1;

    for (const playerRound of playerRounds) {
      if (playerRound.group.round.number === expectedRound && !playerRound.usedComodin) {
        consecutiveRounds++;
        expectedRound--;
      } else {
        break;
      }
    }

    streaks[playerId] = Math.max(0, consecutiveRounds - 1);
  }

  return streaks;
}

// ✅ PATCH endpoint con validaciones robustas
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: MATCH_ERROR_MESSAGES[MatchError.UNAUTHORIZED] }, { status: 401 });
    }

    const body = await request.json();
    const { team1Games, team2Games, tiebreakScore, action, photoUrl } = body;

    // Validación de datos básica
    if (typeof team1Games !== 'number' || typeof team2Games !== 'number') {
      return NextResponse.json({ error: MATCH_ERROR_MESSAGES[MatchError.INVALID_DATA] }, { status: 400 });
    }

    // Validación de marcador
    try {
      validatePadelScore(team1Games, team2Games, tiebreakScore);
    } catch (error: any) {
      if (Object.values(MatchError).includes(error.message)) {
        return NextResponse.json({ error: MATCH_ERROR_MESSAGES[error.message as MatchError] }, { status: 400 });
      }
      throw error;
    }

    // Obtener datos de validación del match
    const validationData = await getMatchValidationData(params.id);

    // Obtener match completo para permisos
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        group: {
          include: {
            round: { select: { isClosed: true } }
          }
        }
      }
    });

    if (!match) {
      return NextResponse.json({ error: MATCH_ERROR_MESSAGES[MatchError.MATCH_NOT_FOUND] }, { status: 404 });
    }

    // ✅ Normalizar tipos: evitamos pasar undefined donde se espera string | null
    const playerId: string | null = (session.user as any).playerId ?? null;
    const isAdmin: boolean = Boolean((session.user as any).isAdmin);

    // Validar permisos
    try {
      validateUserPermissions(validationData, match, playerId, isAdmin);
    } catch (error: any) {
      if (Object.values(MatchError).includes(error.message)) {
        return NextResponse.json({ error: MATCH_ERROR_MESSAGES[error.message as MatchError] }, { status: 403 });
      }
      throw error;
    }

    // Preparar datos de actualización
    let updateData: any = {
      team1Games,
      team2Games,
      tiebreakScore: tiebreakScore || null,
      updatedAt: new Date()
    };

    if (photoUrl) {
      updateData.photoUrl = photoUrl;
    }

    // Lógica de acción con validaciones atómicas
    const result = await prisma.$transaction(async (tx) => {
      // Revalidar estado actual dentro de transacción
      const currentMatch = await tx.match.findUnique({
        where: { id: params.id },
        select: {
          isConfirmed: true,
          reportedById: true,
          confirmedById: true,
          updatedAt: true
        }
      });

      if (!currentMatch) {
        throw new Error(MatchError.CONCURRENT_MODIFICATION);
      }

      // Verificar que no hubo cambios concurrentes
      if (currentMatch.updatedAt > validationData.lastModified) {
        throw new Error(MatchError.CONCURRENT_MODIFICATION);
      }

      // Aplicar lógica según acción
      if (action === 'report' && !isAdmin) {
        if (currentMatch.reportedById) {
          throw new Error(MatchError.ALREADY_REPORTED);
        }
        updateData.reportedById = playerId ?? null;
        updateData.isConfirmed = false;
        
      } else if (action === 'confirm' && !isAdmin) {
        if (!currentMatch.reportedById) {
          throw new Error(MatchError.NO_RESULT_TO_CONFIRM);
        }
        if (currentMatch.reportedById === playerId) {
          throw new Error(MatchError.CANNOT_CONFIRM_OWN);
        }
        if (currentMatch.confirmedById) {
          throw new Error(MatchError.ALREADY_CONFIRMED);
        }
        updateData.confirmedById = playerId;
        updateData.isConfirmed = true;
        
      } else if (isAdmin) {
        updateData.isConfirmed = true;
        updateData.reportedById = updateData.reportedById || playerId;
        updateData.confirmedById = updateData.confirmedById || playerId;
      } else {
        throw new Error(MatchError.INVALID_DATA);
      }

      // Actualizar match
      const updatedMatch = await tx.match.update({
        where: { id: params.id },
        data: updateData
      });

      return updatedMatch;
    });

    // Recalcular puntos si el resultado está confirmado
    if (result.isConfirmed) {
      try {
        await recalculateGroupPointsAtomic(match.groupId);
      } catch (error) {
        console.error("Error recalculando puntos:", error);
        // No fallar la operación principal, pero loggar el error
      }
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error updating match:", error);
    
    // Manejo específico de errores conocidos
    if (Object.values(MatchError).includes(error.message)) {
      const errorMsg = MATCH_ERROR_MESSAGES[error.message as MatchError];
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.json({ 
      error: "Error interno del servidor" 
    }, { status: 500 });
  }
}

// ✅ GET y DELETE endpoints con las mismas mejoras...
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: MATCH_ERROR_MESSAGES[MatchError.UNAUTHORIZED] }, { status: 401 });
    }

    const validationData = await getMatchValidationData(params.id);
    
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        group: {
          include: {
            round: {
              include: { tournament: true }
            },
            players: {
              include: { player: true }
            }
          }
        }
      }
    });

    if (!match) {
      return NextResponse.json({ error: MATCH_ERROR_MESSAGES[MatchError.MATCH_NOT_FOUND] }, { status: 404 });
    }

    // Verificar permisos de lectura
    const playerId: string | null = (session.user as any).playerId ?? null;
    const isAdmin: boolean = Boolean((session.user as any).isAdmin);
    const isPlayerInMatch = playerId && [
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id
    ].includes(playerId);

    if (!isAdmin && !isPlayerInMatch) {
      return NextResponse.json({ error: MATCH_ERROR_MESSAGES[MatchError.NO_PERMISSION] }, { status: 403 });
    }

    return NextResponse.json(match);
  } catch (error: any) {
    console.error("Error fetching match:", error);
    
    if (Object.values(MatchError).includes(error.message)) {
      const errorMsg = MATCH_ERROR_MESSAGES[error.message as MatchError];
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Solo admins pueden eliminar resultados" }, { status: 401 });
    }

    const validationData = await getMatchValidationData(params.id);

    if (validationData.roundClosed) {
      return NextResponse.json({ error: MATCH_ERROR_MESSAGES[MatchError.ROUND_CLOSED] }, { status: 400 });
    }

    // Limpiar resultado en transacción atómica
    const updatedMatch = await prisma.$transaction(async (tx) => {
      const match = await tx.match.update({
        where: { id: params.id },
        data: {
          team1Games: null,
          team2Games: null,
          tiebreakScore: null,
          isConfirmed: false,
          reportedById: null,
          confirmedById: null,
          photoUrl: null,
          updatedAt: new Date()
        }
      });

      return match;
    });

    // Recalcular puntos del grupo
    try {
      await recalculateGroupPointsAtomic(validationData.groupId);
    } catch (error) {
      console.error("Error recalculando puntos tras eliminación:", error);
    }

    return NextResponse.json(updatedMatch);
  } catch (error: any) {
    console.error("Error deleting match result:", error);
    
    if (Object.values(MatchError).includes(error.message)) {
      const errorMsg = MATCH_ERROR_MESSAGES[error.message as MatchError];
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
