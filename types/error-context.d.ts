// types/error-context.d.ts
// Ampliación no intrusiva para evitar TS2353 con Partial<ErrorContext>.

declare global {
  interface ErrorContext {
    // concurrency.ts
    resource?: string;
    roundNumber?: number;
    timeDiff?: number;
    originalHash?: string;

    // security.ts
    field?: string;
    attemptedAction?: string;
    requestedPlayerId?: string;
    playerId?: string;
    ip?: string;

    // Permite campos adicionales sin perder tipado de los conocidos
    [key: string]: unknown;
  }
}

export {};
