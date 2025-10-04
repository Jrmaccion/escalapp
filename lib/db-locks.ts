// lib/db-locks.ts
// Advisory locks a nivel Postgres, seguros en serverless si se ejecutan dentro de una única transacción.
// Usamos pg_advisory_lock(hashtext(resource)) para no preocuparnos por claves numéricas.
// Patrón de uso:
//   await withAdvisoryLock(`round:${roundId}`, async (tx) => { ... lógica crítica ... });

import { prisma } from "@/lib/prisma";

type TxClient = Parameters<typeof prisma.$transaction>[0] extends (arg: infer T) => any ? T : any;

export type LockOptions = {
  /** Tiempo máximo intentando adquirir el lock (ms). Por defecto 5000ms */
  timeoutMs?: number;
  /** Intervalo entre intentos cuando usamos try-lock (ms). Por defecto 100ms */
  retryEveryMs?: number;
  /** Si true, usa pg_try_advisory_lock en bucle; si false, usa pg_advisory_lock (bloqueante dentro del timeout). */
  tryMode?: boolean;
};

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Ejecuta `fn` dentro de una transacción Prisma *en la misma conexión*,
 * adquiriendo antes un advisory lock para `resource`.
 */
export async function withAdvisoryLock<T>(
  resource: string,
  fn: (tx: TxClient) => Promise<T>,
  opts: LockOptions = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const retryEveryMs = opts.retryEveryMs ?? 100;
  const tryMode = opts.tryMode ?? true;

  const startedAt = Date.now();

  return prisma.$transaction(async (tx) => {
    let locked = false;

    if (tryMode) {
      // Intentos no bloqueantes hasta timeout
      while (Date.now() - startedAt < timeoutMs) {
        const res = await tx.$queryRaw<{ pg_try_advisory_lock: boolean }[]>`
          SELECT pg_try_advisory_lock(hashtext(${resource}));
        `;
        if (res?.[0]?.pg_try_advisory_lock) {
          locked = true;
          break;
        }
        await sleep(retryEveryMs);
      }
      if (!locked) {
        throw new Error(
          `No se pudo adquirir el lock para "${resource}" en ${timeoutMs}ms`
        );
      }
    } else {
      // Bloqueante (ojo: si otro proceso no libera, puede colgar)
      await tx.$executeRawUnsafe(`SELECT pg_advisory_lock(hashtext($1));`, resource);
      locked = true;
    }

    try {
      const result = await fn(tx);
      return result;
    } finally {
      if (locked) {
        await tx.$executeRawUnsafe(`SELECT pg_advisory_unlock(hashtext($1));`, resource);
      }
    }
  });
}
