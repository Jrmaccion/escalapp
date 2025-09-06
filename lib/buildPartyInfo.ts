// lib/buildPartyInfo.ts - HELPER PARA CONSTRUIR PARTYINFO DESDE MATCHES
import type { PartyInfo } from "@/components/PartyScheduling";

/**
 * Construye PartyInfo desde un array de matches (usado en componentes legacy)
 * Este helper permite la transición gradual hacia la nueva API unificada
 */
export function buildPartyInfoFromMatches(
  matches: Array<{
    id: string;
    setNumber: number;
    status?: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED" | null;
    proposedDate?: string | null;
    acceptedDate?: string | null;
    acceptedCount?: number;
    team1Player1Name?: string;
    team1Player2Name?: string;
    team2Player1Name?: string;
    team2Player2Name?: string;
    team1Games?: number | null;
    team2Games?: number | null;
    isConfirmed?: boolean;
    hasResult?: boolean;
    groupId?: string;
    groupNumber?: number;
    roundNumber?: number;
    proposedBy?: string | null;
  }>,
  context: {
    groupId: string;
    groupNumber: number;
    roundNumber: number;
    currentUserId: string | null;
  }
): PartyInfo {
  
  if (matches.length === 0) {
    return {
      groupId: context.groupId,
      groupNumber: context.groupNumber,
      roundNumber: context.roundNumber,
      players: [],
      sets: [],
      scheduleStatus: "PENDING",
      proposedDate: null,
      acceptedDate: null,
      proposedBy: null,
      acceptedCount: 0,
      proposedByCurrentUser: false
    };
  }

  // Extraer jugadores únicos de todos los sets
  const playersSet = new Set<string>();
  matches.forEach(match => {
    if (match.team1Player1Name) playersSet.add(match.team1Player1Name);
    if (match.team1Player2Name) playersSet.add(match.team1Player2Name);
    if (match.team2Player1Name) playersSet.add(match.team2Player1Name);
    if (match.team2Player2Name) playersSet.add(match.team2Player2Name);
  });

  const players = Array.from(playersSet);

  // Convertir matches a sets
  const sets = matches.map(match => ({
    id: match.id,
    setNumber: match.setNumber,
    team1Player1Name: match.team1Player1Name || "",
    team1Player2Name: match.team1Player2Name || "",
    team2Player1Name: match.team2Player1Name || "",
    team2Player2Name: match.team2Player2Name || "",
    hasResult: match.hasResult || (match.team1Games !== null && match.team2Games !== null),
    isConfirmed: match.isConfirmed || false
  }));

  // Determinar estado de programación unificado
  const scheduleStatus = deriveScheduleStatus(matches);
  
  // Usar información del primer match para datos de programación
  const firstMatch = matches[0];

  return {
    groupId: context.groupId,
    groupNumber: context.groupNumber,
    roundNumber: context.roundNumber,
    players,
    sets,
    scheduleStatus,
    proposedDate: firstMatch.proposedDate || null,
    acceptedDate: firstMatch.acceptedDate || null,
    proposedBy: firstMatch.proposedBy || null,
    acceptedCount: firstMatch.acceptedCount || 0,
    proposedByCurrentUser: context.currentUserId ? firstMatch.proposedBy === context.currentUserId : false
  };
}

/**
 * Deriva el estado de programación basado en el estado de los matches
 */
function deriveScheduleStatus(matches: Array<any>): PartyInfo['scheduleStatus'] {
  if (matches.length === 0) return "PENDING";
  
  // Si todos los sets están confirmados, el partido está completo
  const completedSets = matches.filter(m => m.isConfirmed).length;
  if (completedSets === matches.length) {
    return "COMPLETED";
  }
  
  // Verificar estado de programación basado en el primer match
  const firstMatch = matches[0];
  
  if (firstMatch.acceptedDate) {
    return "SCHEDULED";
  }
  
  if (firstMatch.proposedDate) {
    return "DATE_PROPOSED";
  }
  
  return "PENDING";
}

/**
 * Convierte datos de la nueva API Party a PartyInfo (para compatibilidad)
 */
export function partyToPartyInfo(party: any): PartyInfo {
  return {
    groupId: party.groupId,
    groupNumber: party.groupNumber,
    roundNumber: party.roundNumber,
    players: party.players.map((p: any) => p.name),
    sets: party.sets,
    scheduleStatus: party.schedule.status,
    proposedDate: party.schedule.proposedDate?.toISOString() || null,
    acceptedDate: party.schedule.acceptedDate?.toISOString() || null,
    proposedBy: party.schedule.proposedBy,
    acceptedCount: party.schedule.acceptedCount,
    proposedByCurrentUser: party.schedule.proposedByCurrentUser
  };
}

/**
 * Normaliza datos de matches para uso consistente
 */
export function normalizeMatchData(rawMatch: any): {
  id: string;
  setNumber: number;
  team1Player1Name: string;
  team1Player2Name: string;
  team2Player1Name: string;
  team2Player2Name: string;
  hasResult: boolean;
  isConfirmed: boolean;
  status: string;
  proposedDate?: string | null;
  acceptedDate?: string | null;
  acceptedCount?: number;
} {
  return {
    id: rawMatch.id,
    setNumber: rawMatch.setNumber,
    team1Player1Name: rawMatch.team1Player1Name || "",
    team1Player2Name: rawMatch.team1Player2Name || "",
    team2Player1Name: rawMatch.team2Player1Name || "",
    team2Player2Name: rawMatch.team2Player2Name || "",
    hasResult: rawMatch.hasResult || (rawMatch.team1Games !== null && rawMatch.team2Games !== null),
    isConfirmed: rawMatch.isConfirmed || false,
    status: rawMatch.status || "PENDING",
    proposedDate: rawMatch.proposedDate,
    acceptedDate: rawMatch.acceptedDate,
    acceptedCount: rawMatch.acceptedCount || 0
  };
}

/**
 * Valida que un array de matches representa un partido válido
 */
export function validatePartyMatches(matches: Array<any>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validación básica
  if (matches.length === 0) {
    errors.push("No hay sets en el partido");
    return { isValid: false, errors, warnings };
  }

  if (matches.length !== 3) {
    warnings.push(`El partido tiene ${matches.length} sets, se esperan 3`);
  }

  // Validar que todos los matches tienen la misma información de programación
  const firstMatch = matches[0];
  const inconsistentScheduling = matches.some(match => 
    match.proposedDate !== firstMatch.proposedDate ||
    match.acceptedDate !== firstMatch.acceptedDate ||
    JSON.stringify(match.acceptedBy || []) !== JSON.stringify(firstMatch.acceptedBy || [])
  );

  if (inconsistentScheduling) {
    errors.push("Los sets del partido tienen información de programación inconsistente");
  }

  // Validar jugadores únicos
  const allPlayerIds = new Set<string>();
  matches.forEach(match => {
    [match.team1Player1Id, match.team1Player2Id, match.team2Player1Id, match.team2Player2Id]
      .filter(Boolean)
      .forEach(id => allPlayerIds.add(id));
  });

  if (allPlayerIds.size !== 4) {
    warnings.push(`Se encontraron ${allPlayerIds.size} jugadores únicos, se esperan 4`);
  }

  // Validar numeración secuencial de sets
  const setNumbers = matches.map(m => m.setNumber).sort((a, b) => a - b);
  const expectedNumbers = [1, 2, 3].slice(0, matches.length);
  const hasCorrectNumbering = JSON.stringify(setNumbers) === JSON.stringify(expectedNumbers);

  if (!hasCorrectNumbering) {
    warnings.push(`Numeración de sets incorrecta: encontrados [${setNumbers.join(', ')}], esperados [${expectedNumbers.join(', ')}]`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}