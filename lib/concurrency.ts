// lib/concurrency.ts - SISTEMA DE LOCKS Y VALIDACIONES DE CONCURRENCIA
import { prisma } from './prisma';
import { AppError, AppErrorCode } from './error-handler';
import { createHash } from 'crypto';

/** ====== Locks en memoria (single process) ====== */
class LockManager {
  private static locks = new Map<string, {
    acquired: Date;
    timeout: NodeJS.Timeout;
    operation: string;
  }>();

  static async acquireLock(
    resource: string,
    operation: string,
    timeoutMs: number = 30000,
  ): Promise<() => void> {
    const lockKey = `lock:${resource}`;

    if (this.locks.has(lockKey)) {
      const existing = this.locks.get(lockKey)!;
      throw AppError.businessLogic(
        AppErrorCode.CONCURRENT_MODIFICATION,
        `Resource ${resource} is locked by operation: ${existing.operation}`,
        'Esta operación ya está siendo procesada por otro usuario',
        { operation, resource, lockedSince: existing.acquired },
      );
    }

    const timeout = setTimeout(() => {
      this.locks.delete(lockKey);
      // eslint-disable-next-line no-console
      console.warn(`Lock ${lockKey} expired after ${timeoutMs}ms`);
    }, timeoutMs);

    this.locks.set(lockKey, {
      acquired: new Date(),
      timeout,
      operation,
    });

    return () => {
      const lock = this.locks.get(lockKey);
      if (lock) {
        clearTimeout(lock.timeout);
        this.locks.delete(lockKey);
      }
    };
  }

  static isLocked(resource: string): boolean {
    return this.locks.has(`lock:${resource}`);
  }

  static getActiveLocks() {
    return Array.from(this.locks.entries()).map(([key, lock]) => ({
      resource: key.replace('lock:', ''),
      operation: lock.operation,
      acquired: lock.acquired,
    }));
  }
}

/** ====== Decorator withLock tipado para TS5 ====== */
export function withLock<T extends (...args: any[]) => any>(
  resourceFactory: (...args: Parameters<T>) => string,
  operation: string,
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>,
  ): TypedPropertyDescriptor<T> | void {
    const original = descriptor.value!;
    const wrapped = (async function (this: any, ...args: Parameters<T>) {
      const resource = resourceFactory(...args);
      const releaseLock = await LockManager.acquireLock(resource, operation);
      try {
        return await (original as any).apply(this, args);
      } finally {
        releaseLock();
      }
    }) as T;

    descriptor.value = wrapped;
    return descriptor;
  };
}

/** ====== Validador de concurrencia para rondas ====== */
export class ConcurrencyValidator {
  static async validateRoundClosure(roundId: string): Promise<{
    round: any;
    integrityHash: string;
    timestamp: Date;
  }> {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: {
          select: {
            id: true,
            title: true,
            totalRounds: true,
            updatedAt: true,
          },
        },
        groups: {
          include: {
            players: {
              select: {
                id: true,
                playerId: true,
                position: true,
                points: true,
                usedComodin: true,
                streak: true,
              },
            },
            matches: {
              select: {
                id: true,
                isConfirmed: true,
                team1Games: true,
                team2Games: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!round) {
      throw AppError.notFound('Ronda', roundId);
    }

    if (round.isClosed) {
      throw AppError.businessLogic(
        AppErrorCode.ROUND_ALREADY_CLOSED,
        `Round ${roundId} is already closed`,
        'Esta ronda ya ha sido cerrada',
        { roundId, roundNumber: round.number },
      );
    }

    const integrityData = {
      roundId: round.id,
      isClosed: round.isClosed,
      groupsCount: round.groups.length,
      playersData: round.groups
        .flatMap(g => g.players.map(p => `${p.playerId}:${p.position}:${p.points}:${p.streak}`))
        .sort(),
      matchesData: round.groups
        .flatMap(g => g.matches.map(m => `${m.id}:${m.isConfirmed}:${m.team1Games}:${m.team2Games}`))
        .sort(),
      tournamentUpdatedAt: round.tournament.updatedAt.getTime(),
    };

    const integrityHash = createHash('sha256')
      .update(JSON.stringify(integrityData))
      .digest('hex');

    return {
      round,
      integrityHash,
      timestamp: new Date(),
    };
  }

  static async revalidateIntegrity(
    roundId: string,
    originalHash: string,
    originalTimestamp: Date,
  ): Promise<void> {
    const timeDiff = Date.now() - originalTimestamp.getTime();
    if (timeDiff > 5 * 60 * 1000) {
      throw AppError.businessLogic(
        AppErrorCode.CONCURRENT_MODIFICATION,
        `Operation timeout: ${timeDiff}ms exceeded maximum`,
        'La operación ha tardado demasiado. Por favor, inténtalo de nuevo',
        { roundId, timeDiff, originalTimestamp },
      );
    }

    const { integrityHash } = await this.validateRoundClosure(roundId);
    if (integrityHash !== originalHash) {
      throw AppError.businessLogic(
        AppErrorCode.CONCURRENT_MODIFICATION,
        'Data has been modified during operation',
        'Los datos han sido modificados por otro usuario durante la operación',
        { roundId, originalHash, currentHash: integrityHash },
      );
    }
  }
}

/** ====== Orquestador de torneo (ejemplo) ====== */
export class RobustTournamentEngine {
  @withLock((roundId: string) => `round:${roundId}`, 'closeRoundAndGenerateNext')
  static async closeRoundAndGenerateNext(roundId: string) {
    const { integrityHash, timestamp } = await ConcurrencyValidator.validateRoundClosure(roundId);

    // … lógica existente de cierre/generación …

    return prisma.$transaction(async (tx) => {
      const finalCheck = await tx.round.findUnique({
        where: { id: roundId },
        select: { isClosed: true, updatedAt: true },
      });

      if (!finalCheck || finalCheck.isClosed) {
        throw AppError.businessLogic(
          AppErrorCode.CONCURRENT_MODIFICATION,
          'Round state changed during operation',
          'El estado de la ronda cambió durante la operación',
          { roundId },
        );
      }

      // Revalidación justo antes del commit
      await ConcurrencyValidator.revalidateIntegrity(roundId, integrityHash, timestamp);

      await tx.round.update({
        where: { id: roundId },
        data: { isClosed: true }, // updatedAt se actualiza solo (schema @updatedAt)
      });

      return {
        success: true,
        roundId,
        timestamp: new Date(),
      };
    }, {
      timeout: 60_000,
      isolationLevel: 'Serializable',
    });
  }
}

/** ====== Health checker ====== */
export class HealthChecker {
  static async checkConcurrencyHealth() {
    const locks = LockManager.getActiveLocks();
    const now = Date.now();
    const staleLocks = locks
      .filter(l => (now - l.acquired.getTime()) > 10 * 60 * 1000)
      .map(l => ({ ...l, age: now - l.acquired.getTime() }));

    const recommendations: string[] = [];
    if (staleLocks.length > 0) {
      recommendations.push(`${staleLocks.length} locks están activos por más de 10 minutos`);
    }
    if (locks.length > 5) {
      recommendations.push('Muchas operaciones concurrentes activas - considera limitar la carga');
    }

    return {
      activeLocks: locks.length,
      staleLocks,
      recommendations,
    };
  }
}
