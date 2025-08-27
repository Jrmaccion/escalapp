import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

export function calculatePointsForMatch(
  playerGames: number,
  opponentGames: number,
  wonSet: boolean
): number {
  return playerGames + (wonSet ? 1 : 0)
}

export function getTeamsForSet(players: any[], setNumber: number) {
  switch (setNumber) {
    case 1:
      return {
        team1: [players[0], players[3]], // #1 + #4
        team2: [players[1], players[2]]  // #2 + #3
      }
    case 2:
      return {
        team1: [players[0], players[2]], // #1 + #3
        team2: [players[1], players[3]]  // #2 + #4
      }
    case 3:
      return {
        team1: [players[0], players[1]], // #1 + #2
        team2: [players[2], players[3]]  // #3 + #4
      }
    default:
      throw new Error('Número de set inválido')
  }
}

export function validateMatchResult(team1Games: number, team2Games: number, tiebreakScore?: string) {
  if (team1Games < 0 || team1Games > 5 || team2Games < 0 || team2Games > 5) {
    throw new Error('Los juegos deben estar entre 0 y 5')
  }

  if (team1Games === 4 && team2Games === 4) {
    if (!tiebreakScore || !tiebreakScore.includes('-')) {
      throw new Error('Se requiere resultado de tie-break para empate 4-4')
    }

    const [tb1, tb2] = tiebreakScore.split('-').map(s => parseInt(s.trim()))
    if (isNaN(tb1) || isNaN(tb2) || Math.abs(tb1 - tb2) < 2) {
      throw new Error('Resultado de tie-break inválido')
    }
  }

  if (Math.max(team1Games, team2Games) < 4) {
    throw new Error('Al menos un equipo debe ganar 4 juegos')
  }

  return true
}
