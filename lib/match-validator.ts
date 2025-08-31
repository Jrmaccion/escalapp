// Archivo: /lib/match-validator.ts
// Utilidad para validar que la estructura de datos es correcta antes de generar matches

export interface GroupPlayerData {
  id: string;
  position: number;
  player: {
    id: string;
    name: string;
  };
}

export interface GroupData {
  id: string;
  number: number;
  level: number;
  players: GroupPlayerData[];
  matches: { setNumber: number }[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validGroups: string[];
  invalidGroups: string[];
}

/**
 * Valida que los grupos tengan la estructura correcta para generar matches
 */
export function validateGroupsForMatches(groups: GroupData[]): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    validGroups: [],
    invalidGroups: []
  };

  for (const group of groups) {
    const groupId = `Grupo ${group.number}`;
    let groupValid = true;

    // Validar número de jugadores
    if (group.players.length < 4) {
      result.errors.push(`${groupId}: Solo ${group.players.length} jugadores, mínimo 4`);
      groupValid = false;
    } else if (group.players.length % 4 !== 0) {
      result.errors.push(`${groupId}: ${group.players.length} jugadores no es múltiplo de 4`);
      groupValid = false;
    }

    // Validar posiciones secuenciales
    const positions = group.players.map(p => p.position).sort((a, b) => a - b);
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] !== i + 1) {
        result.warnings.push(`${groupId}: Posiciones no secuenciales [${positions.join(', ')}]`);
        break;
      }
    }

    // Validar estructura de datos
    for (let i = 0; i < group.players.length; i++) {
      const player = group.players[i];
      if (!player.player?.id) {
        result.errors.push(`${groupId}: Jugador en posición ${i + 1} sin ID válido`);
        groupValid = false;
      }
      if (!player.player?.name) {
        result.warnings.push(`${groupId}: Jugador en posición ${i + 1} sin nombre`);
      }
    }

    // Validar matches existentes
    if (group.matches.length > 0) {
      const expectedMatches = Math.floor(group.players.length / 4) * 3;
      if (group.matches.length !== expectedMatches) {
        result.warnings.push(`${groupId}: Tiene ${group.matches.length} matches, se esperan ${expectedMatches}`);
      }
    }

    if (groupValid) {
      result.validGroups.push(groupId);
    } else {
      result.invalidGroups.push(groupId);
      result.isValid = false;
    }
  }

  return result;
}

/**
 * Genera un preview de los matches que se crearían sin ejecutar la creación
 */
export function previewMatches(groups: GroupData[]): Array<{
  groupId: string;
  groupNumber: number;
  matches: Array<{
    setNumber: number;
    team1: [string, string]; // [player1Name, player2Name]
    team2: [string, string];
  }>;
}> {
  const preview: Array<any> = [];

  for (const group of groups) {
    if (group.players.length < 4 || group.players.length % 4 !== 0) {
      continue;
    }

    const groupMatches: Array<any> = [];
    const blocks = Math.floor(group.players.length / 4);

    for (let b = 0; b < blocks; b++) {
      const base = b * 4;
      const players = group.players.slice(base, base + 4);
      const blockOffset = b * 3;

      // Set 1: 1+4 vs 2+3
      groupMatches.push({
        setNumber: 1 + blockOffset,
        team1: [players[0].player.name, players[3].player.name],
        team2: [players[1].player.name, players[2].player.name]
      });

      // Set 2: 1+3 vs 2+4
      groupMatches.push({
        setNumber: 2 + blockOffset,
        team1: [players[0].player.name, players[2].player.name],
        team2: [players[1].player.name, players[3].player.name]
      });

      // Set 3: 1+2 vs 3+4
      groupMatches.push({
        setNumber: 3 + blockOffset,
        team1: [players[0].player.name, players[1].player.name],
        team2: [players[2].player.name, players[3].player.name]
      });
    }

    preview.push({
      groupId: group.id,
      groupNumber: group.number,
      matches: groupMatches
    });
  }

  return preview;
}