import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
  POINTS_CALCULATION_FAILED = "POINTS_CALCULATION_FAILED",
  FECHA_NO_CONFIRMADA = "FECHA_NO_CONFIRMADA",
  CONFIRMACION_MISMO_EQUIPO = "CONFIRMACION_MISMO_EQUIPO",
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
  [MatchError.POINTS_CALCULATION_FAILED]: "Error calculando puntos del grupo",
  [MatchError.FECHA_NO_CONFIRMADA]:
    "Solo puedes reportar resultados cuando la fecha esté confirmada por todos los jugadores",
  [MatchError.CONFIRMACION_MISMO_EQUIPO]: "Debe confirmar un jugador del equipo contrario",
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
  // Validación básica
  if (team1Games < 0 || team1Games > 10 || team2Games < 0 || team2Games > 10) {
    throw new Error(MatchError.INVALID_SCORE);
  }

  const maxGames = Math.max(team1Games, team2Games);
  const minGames = Math.min(team1Games, team2Games);
  const diff = Math.abs(team1Games - team2Games);

  // Al menos un equipo debe llegar a 4
  if (maxGames < 4) {
    throw new Error(MatchError.INVALID_SCORE);
  }

  // 1) Directo a 4 con diferencia ≥ 2, sin TB
  if (maxGames === 4) {
    if (diff < 2) throw new Error(MatchError.INVALID_SCORE);
    if (tiebreakScore) throw new Error(MatchError.INVALID_TIEBREAK);
  }
  // 2) Extendidos (≥5)
  else if (maxGames >= 5) {
    // 5-4 con TB (proviene de 4-4)
    if (maxGames === 5 && minGames === 4) {
      if (!tiebreakScore) throw new Error(MatchError.INVALID_TIEBREAK);
      if (!/^\d+-\d+$/.test(tiebreakScore)) throw new Error(MatchError.INVALID_TIEBREAK);
      const [tb1, tb2] = tiebreakScore.split("-").map(Number);
      if (tb1 < 0 || tb2 < 0) throw new Error(MatchError.INVALID_TIEBREAK);
      if (Math.abs(tb1 - tb2) < 2) throw new Error(MatchError.INVALID_TIEBREAK);
      if (Math.max(tb1, tb2) < 7) throw new Error(MatchError.INVALID_TIEBREAK);
    } else {
      // 5-3, 6-4, 7-5, ... diferencia exacta 2 y sin TB
      if (diff !== 2) throw new Error(MatchError.INVALID_SCORE);
      if (tiebreakScore) throw new Error(MatchError.INVALID_TIEBREAK);
    }
  }

  // 3) No empates ≥ 4
  if (team1Games === team2Games && team1Games >= 4) {
    throw new Error(MatchError.INVALID_SCORE);
  }
}

// ✅ Obtener datos del match con validación
async function getMatchValidationData(matchId: string): Promise<MatchValidationData> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      group: {
        include: {
          round: { select: { isClosed: true } },
        },
      },
    },
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
    lastModified: match.updatedAt,
  };
}

// ✅ Verificar permisos del usuario (para jugadores)
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
    const isPlayerInMatch =
      playerId &&
      [
        match.team1Player1Id,
        match.team1Player2Id,
        match.team2Player1Id,
        match.team2Player2Id,
      ].includes(playerId);

    if (!isPlayerInMatch) {
      throw new Error(MatchError.NO_PERMISSION);
    }
  }
}

// ✅ Recálculo de puntos con validación de integridad
async function recalculateGroupPointsAtomic(groupId: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const matches = await tx.match.findMany({
        where: { groupId, isConfirmed: true },
        orderBy: { setNumber: "asc" },
      });

      const groupPlayers = await tx.groupPlayer.findMany({
        where: { groupId },
        include: {
          player: true,
          group: {
            include: {
              round: { include: { tournament: true } },
            },
          },
        },
      });

      if (groupPlayers.length === 0) {
        throw new Error(MatchError.POINTS_CALCULATION_FAILED);
      }

      // Mapa de sustitutos: substitutePlayerId -> titular playerId
      const substituteMap = new Map<string, string>();
      for (const gp of groupPlayers) {
        if (gp.substitutePlayerId) {
          substituteMap.set(gp.substitutePlayerId, gp.playerId);
        }
      }

      const playerStreaks = await calculateConsecutiveStreaks(groupId, tx);

      for (const groupPlayer of groupPlayers) {
        let totalPoints = 0;

        if (groupPlayer.usedComodin && !groupPlayer.substitutePlayerId) {
          totalPoints = groupPlayer.points || 0;
        } else {
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

        // Bonus racha: +2 por match si racha >= 1 y no usó comodín
        const playerStreak = playerStreaks[groupPlayer.playerId] || 0;
        if (playerStreak >= 1 && !groupPlayer.usedComodin) {
          const matchesPlayedByThisPlayer = matches.filter((match) => {
            const physicalPlayerId = groupPlayer.substitutePlayerId || groupPlayer.playerId;
            return [
              match.team1Player1Id,
              match.team1Player2Id,
              match.team2Player1Id,
              match.team2Player2Id,
            ].includes(physicalPlayerId);
          }).length;

          totalPoints += matchesPlayedByThisPlayer * 2;
        }

        await tx.groupPlayer.update({
          where: { id: groupPlayer.id },
          data: { points: totalPoints, streak: playerStreak },
        });
      }

      await updateGroupPositionsAtomic(groupId, tx);
    },
    { timeout: 20000 }
  );
}

async function updateGroupPositionsAtomic(groupId: string, tx: any): Promise<void> {
  const groupPlayers = await tx.groupPlayer.findMany({
    where: { groupId },
    orderBy: [{ points: "desc" }, { streak: "desc" }],
  });

  // FASE 1: Mover todos a posiciones temporales (1000+)
  for (let i = 0; i < groupPlayers.length; i++) {
    await tx.groupPlayer.update({
      where: { id: groupPlayers[i].id },
      data: { position: 1000 + i },
    });
  }

  // FASE 2: Mover a posiciones finales (1, 2, 3, 4)
  for (let i = 0; i < groupPlayers.length; i++) {
    await tx.groupPlayer.update({
      where: { id: groupPlayers[i].id },
      data: { position: i + 1 },
    });
  }
}

function getPointRecipientForMatch(
  match: any,
  groupPlayerId: string,
  substituteMap: Map<string, string>
): string | null {
  const matchPlayerIds = [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id,
  ];

  if (matchPlayerIds.includes(groupPlayerId)) {
    return groupPlayerId;
  }

  const substituteId = Array.from(substituteMap.keys()).find(
    (subId) => substituteMap.get(subId) === groupPlayerId
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

  // +1 por juego ganado
  if (isTeam1) points += match.team1Games || 0;
  else points += match.team2Games || 0;

  // +1 por set ganado (considerando TB 5-4)
  let team1Won = false;
  if (
    (match.team1Games === 5 && match.team2Games === 4) ||
    (match.team2Games === 5 && match.team1Games === 4)
  ) {
    if (match.tiebreakScore) {
      const [tb1, tb2] = match.tiebreakScore.split("-").map(Number);
      team1Won = tb1 > tb2;
    } else {
      team1Won = (match.team1Games || 0) > (match.team2Games || 0);
    }
  } else {
    team1Won = (match.team1Games || 0) > (match.team2Games || 0);
  }

  if ((isTeam1 && team1Won) || (isTeam2 && !team1Won)) points += 1;

  return points;
}

async function calculateConsecutiveStreaks(
  groupId: string,
  tx: any
): Promise<Record<string, number>> {
  const group = await tx.group.findUnique({
    where: { id: groupId },
    include: {
      round: { include: { tournament: true } },
      players: true,
    },
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
            isClosed: true,
          },
        },
      },
      include: {
        group: { include: { round: true } },
      },
      orderBy: { group: { round: { number: "desc" } } },
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

// ✅ VALIDACIÓN POR EQUIPOS (reutilizable)
function validateTeamConfirmation(
  match: any,
  reportedById: string,
  confirmerId: string | null
): void {
  if (!confirmerId) throw new Error(MatchError.UNAUTHORIZED);

  const team1Players = [match.team1Player1Id, match.team1Player2Id];
  const team2Players = [match.team2Player1Id, match.team2Player2Id];

  const reporterInTeam1 = team1Players.includes(reportedById);
  const confirmerInTeam1 = team1Players.includes(confirmerId);

  // REGLA: El confirmador debe ser del equipo CONTRARIO al reportero
  if (reporterInTeam1 === confirmerInTeam1) {
    throw new Error(MatchError.CONFIRMACION_MISMO_EQUIPO);
  }
}

/* ============================= PATCH (ADMIN BYPASS) ============================= */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: MATCH_ERROR_MESSAGES[MatchError.UNAUTHORIZED] },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { team1Games, team2Games, tiebreakScore, action, photoUrl } = body;

    // Validación de datos básica
    if (typeof team1Games !== "number" || typeof team2Games !== "number") {
      return NextResponse.json(
        { error: MATCH_ERROR_MESSAGES[MatchError.INVALID_DATA] },
        { status: 400 }
      );
    }

    // Validar marcador SIEMPRE (también admin)
    try {
      validatePadelScore(team1Games, team2Games, tiebreakScore);
    } catch (error: any) {
      if (Object.values(MatchError).includes(error.message)) {
        return NextResponse.json(
          { error: MATCH_ERROR_MESSAGES[error.message as MatchError] },
          { status: 400 }
        );
      }
      throw error;
    }

    // Cargar datos para validaciones
    const validationData = await getMatchValidationData(params.id);

    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        group: { include: { round: { select: { isClosed: true } } } },
      },
    });

    if (!match) {
      return NextResponse.json(
        { error: MATCH_ERROR_MESSAGES[MatchError.MATCH_NOT_FOUND] },
        { status: 404 }
      );
    }

    const playerId: string | null = (session.user as any).playerId ?? null;
    const isAdmin: boolean = Boolean((session.user as any).isAdmin);

    // Jugadores: validar fecha confirmada y permisos
    if (!isAdmin) {
      if (match.status !== "SCHEDULED" || !match.acceptedDate) {
        return NextResponse.json(
          { error: MATCH_ERROR_MESSAGES[MatchError.FECHA_NO_CONFIRMADA] },
          { status: 400 }
        );
      }
      try {
        validateUserPermissions(validationData, match, playerId, isAdmin);
      } catch (error: any) {
        if (Object.values(MatchError).includes(error.message)) {
          return NextResponse.json(
            { error: MATCH_ERROR_MESSAGES[error.message as MatchError] },
            { status: 403 }
          );
        }
        throw error;
      }
    }

    // Nadie puede modificar rondas cerradas
    if (validationData.roundClosed) {
      return NextResponse.json(
        { error: MATCH_ERROR_MESSAGES[MatchError.ROUND_CLOSED] },
        { status: 400 }
      );
    }

    // Data de actualización
    let updateData: any = {
      team1Games,
      team2Games,
      tiebreakScore: tiebreakScore || null,
      updatedAt: new Date(),
    };
    if (photoUrl) updateData.photoUrl = photoUrl;

    // Transacción
    const result = await prisma.$transaction(async (tx) => {
      const currentMatch = await tx.match.findUnique({
        where: { id: params.id },
        select: {
          isConfirmed: true,
          reportedById: true,
          confirmedById: true,
          updatedAt: true,
        },
      });

      if (!currentMatch) {
        throw new Error(MatchError.CONCURRENT_MODIFICATION);
      }

      // Evitar condiciones de carrera
      if (currentMatch.updatedAt > validationData.lastModified) {
        throw new Error(MatchError.CONCURRENT_MODIFICATION);
      }

      if (isAdmin) {
        // ✅ Admin bypass total (manteniendo score válido)
        updateData.isConfirmed = true;
        updateData.reportedById = updateData.reportedById || (session.user as any).id;
        updateData.confirmedById = updateData.confirmedById || (session.user as any).id;
        // Log
        console.log(
          `Admin ${(session.user as any).id} modificó match ${params.id} bypassing validations`
        );
      } else {
        // Jugadores: flujo normal
        if (action === "report") {
          if (currentMatch.reportedById) {
            throw new Error(MatchError.ALREADY_REPORTED);
          }
          updateData.reportedById = playerId ?? null;
          updateData.isConfirmed = false;
        } else if (action === "confirm") {
          if (!currentMatch.reportedById) {
            throw new Error(MatchError.NO_RESULT_TO_CONFIRM);
          }
          if (currentMatch.reportedById === playerId) {
            throw new Error(MatchError.CANNOT_CONFIRM_OWN);
          }
          if (currentMatch.confirmedById) {
            throw new Error(MatchError.ALREADY_CONFIRMED);
          }

          // Validación por equipos
          try {
            validateTeamConfirmation(match, currentMatch.reportedById as string, playerId);
          } catch (error: any) {
            if (Object.values(MatchError).includes(error.message)) {
              throw new Error(error.message);
            }
            throw error;
          }

          updateData.confirmedById = playerId;
          updateData.isConfirmed = true;
        } else {
          throw new Error(MatchError.INVALID_DATA);
        }
      }

      const updatedMatch = await tx.match.update({
        where: { id: params.id },
        data: updateData,
      });

      return updatedMatch;
    });

    // Recalcular puntos si quedó confirmado
    if (result.isConfirmed) {
      try {
        await recalculateGroupPointsAtomic(match.groupId);
      } catch (error) {
        console.error("Error recalculando puntos:", error);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error updating match:", error);

    if (Object.values(MatchError).includes(error.message)) {
      const errorMsg = MATCH_ERROR_MESSAGES[error.message as MatchError];
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/* ============================= GET / DELETE (sin cambios) ============================= */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: MATCH_ERROR_MESSAGES[MatchError.UNAUTHORIZED] },
        { status: 401 }
      );
    }

    const validationData = await getMatchValidationData(params.id);

    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        group: {
          include: {
            round: { include: { tournament: true } },
            players: { include: { player: true } },
          },
        },
      },
    });

    if (!match) {
      return NextResponse.json(
        { error: MATCH_ERROR_MESSAGES[MatchError.MATCH_NOT_FOUND] },
        { status: 404 }
      );
    }

    const playerId: string | null = (session.user as any).playerId ?? null;
    const isAdmin: boolean = Boolean((session.user as any).isAdmin);
    const isPlayerInMatch =
      playerId &&
      [
        match.team1Player1Id,
        match.team1Player2Id,
        match.team2Player1Id,
        match.team2Player2Id,
      ].includes(playerId as string);

    if (!isAdmin && !isPlayerInMatch) {
      return NextResponse.json(
        { error: MATCH_ERROR_MESSAGES[MatchError.NO_PERMISSION] },
        { status: 403 }
      );
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
      return NextResponse.json(
        { error: MATCH_ERROR_MESSAGES[MatchError.ROUND_CLOSED] },
        { status: 400 }
      );
    }

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
          updatedAt: new Date(),
        },
      });
      return match;
    });

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
