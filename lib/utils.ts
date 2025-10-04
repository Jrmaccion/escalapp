import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ✅ Forzar TZ consistente en servidor y cliente
const ES_TIMEZONE: Intl.DateTimeFormatOptions["timeZone"] = "Europe/Madrid"

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: ES_TIMEZONE,
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ES_TIMEZONE,
  }).format(new Date(date))
}

// --- Resto utilidades existentes (sin cambios funcionales) ---

export function calculatePointsForMatch(
  playerGames: number,
  opponentGames: number,
  wonSet: boolean
) {
  // +1 por juego ganado +1 por set ganado
  return playerGames + (wonSet ? 1 : 0)
}

export function validateSetInput(team1Games: number, team2Games: number, tiebreakScore?: string) {
  // Reglas: 0–4; si 4–4, tie-break a 7 con diferencia de 2 y se computa como 5–4.
  const isInt = (n: number) => Number.isInteger(n) && n >= 0 && n <= 5
  if (!isInt(team1Games) || !isInt(team2Games)) {
    throw new Error("Los juegos deben estar entre 0 y 5")
  }

  if (team1Games === 4 && team2Games === 4) {
    if (!tiebreakScore) {
      throw new Error("Si hay 4–4 es obligatorio informar el tie-break (p. ej., 7–5)")
    }

    const [tb1, tb2] = tiebreakScore.split("-").map(s => parseInt(s.trim()))
    if (isNaN(tb1) || isNaN(tb2) || Math.abs(tb1 - tb2) < 2) {
      throw new Error("Resultado de tie-break inválido")
    }
  }

  if (Math.max(team1Games, team2Games) < 4) {
    throw new Error("Al menos un equipo debe ganar 4 juegos")
  }

  return true
}
