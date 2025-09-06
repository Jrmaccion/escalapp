// lib/security.ts - MEJORAS DE SEGURIDAD CRÍTICAS

import { z } from 'zod';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { AppError, AppErrorCode } from './error-handler';

// 1. VALIDACIÓN EXHAUSTIVA DE ENTRADA
export class InputValidator {
  static sanitizeString(input: string, maxLength: number = 1000): string {
    return input
      .trim()
      .slice(0, maxLength)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  static validateId(id: unknown, fieldName: string = 'id'): string {
    const schema = z.string().regex(/^[a-zA-Z0-9_-]+$/, 'ID contiene caracteres inválidos');
    try {
      return schema.parse(id);
    } catch {
      throw AppError.validation(
        `Invalid ${fieldName}: ${id}`,
        `El ${fieldName} proporcionado no es válido`,
        { fieldName, value: String(id) }
      );
    }
  }

  static validateQueryParams(
    url: string,
    allowedParams: string[] = [],
    maxParamLength: number = 100
  ): Record<string, string> {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    for (const [key, value] of urlObj.searchParams) {
      if (!allowedParams.includes(key)) {
        throw AppError.validation(
          `Unauthorized query parameter: ${key}`,
          'Parámetros de consulta no válidos'
        );
      }
      if (value.length > maxParamLength) {
        throw AppError.validation(
          `Query parameter ${key} too long`,
          'Parámetros de consulta demasiado largos'
        );
      }
      params[key] = this.sanitizeString(value, maxParamLength);
    }
    return params;
  }
}

// 2. AUTORIZACIÓN GRANULAR
export class AuthorizationGuard {
  static async requireAdmin(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw AppError.unauthorized('No authenticated session');
    if (!session.user.isAdmin) {
      throw AppError.unauthorized('Admin access required', {
        userId: session.user.id,
      });
    }
    return { userId: session.user.id, isAdmin: session.user.isAdmin };
  }

  static async requirePlayerAccess(req: NextRequest, resourcePlayerId?: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw AppError.unauthorized('No authenticated session');

    const userPlayerId = session.user.playerId;
    if (!userPlayerId) {
      throw AppError.unauthorized('Player profile required', { userId: session.user.id });
    }

    if (resourcePlayerId && resourcePlayerId !== userPlayerId && !session.user.isAdmin) {
      throw AppError.unauthorized('Cannot access other player resources', {
        userId: session.user.id,
      });
    }

    return {
      userId: session.user.id,
      playerId: userPlayerId,
      isAdmin: session.user.isAdmin,
    };
  }

  static async requireTournamentAccess(req: NextRequest, tournamentId: string) {
    const auth = await this.requirePlayerAccess(req);
    if (auth.isAdmin) return { ...auth, tournamentAccess: true };

    const { prisma } = await import('./prisma');
    const participation = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId: auth.playerId } },
    });

    if (!participation) {
      throw AppError.unauthorized('Not registered in tournament', {
        playerId: auth.playerId,
      });
    }

    return { ...auth, tournamentAccess: true };
  }
}

// 3. RATE LIMITING (memoria, simple)
class RateLimiter {
  private static requests = new Map<string, { count: number; resetTime: number }>();

  static checkLimit(identifier: string, maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) {
    const now = Date.now();
    const key = `ratelimit:${identifier}`;
    const current = this.requests.get(key);
    if (!current || now > current.resetTime) {
      this.requests.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }
    if (current.count >= maxRequests) return false;
    current.count++;
    return true;
  }

  static getRemainingRequests(identifier: string, maxRequests: number = 100): number {
    const current = this.requests.get(`ratelimit:${identifier}`);
    if (!current || Date.now() > current.resetTime) return maxRequests;
    return Math.max(0, maxRequests - current.count);
  }
}

// 4. LOGGING DE SEGURIDAD
export class SecurityLogger {
  static logSecurityEvent(
    event: 'auth_failure' | 'unauthorized_access' | 'suspicious_activity' | 'rate_limit_exceeded',
    details: { userId?: string; ip?: string; userAgent?: string; resource?: string; attemptedAction?: string; additionalData?: any }
  ) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'SECURITY',
      event,
      details,
      severity: this.getEventSeverity(event),
    };
    if (process.env.NODE_ENV === 'production') {
      console.error('[SECURITY]', JSON.stringify(logEntry));
    } else {
      console.warn('SECURITY EVENT:', logEntry);
    }
  }

  private static getEventSeverity(event: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (event) {
      case 'auth_failure':
      case 'rate_limit_exceeded':
        return 'MEDIUM';
      case 'unauthorized_access':
      case 'suspicious_activity':
        return 'HIGH';
      default:
        return 'LOW';
    }
  }
}

// 5. MIDDLEWARE DE SEGURIDAD (para usar dentro de handlers si quieres)
export function createSecurityMiddleware() {
  return async (req: NextRequest) => {
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const path = req.nextUrl.pathname;

    // Rate limit simple
    if (!RateLimiter.checkLimit(String(ip), 100, 15 * 60 * 1000)) {
      SecurityLogger.logSecurityEvent('rate_limit_exceeded', { ip: String(ip), userAgent, resource: path });
      throw AppError.businessLogic(
        AppErrorCode.EXTERNAL_SERVICE_ERROR,
        'Rate limit exceeded',
        'Demasiadas solicitudes. Inténtalo más tarde',
        {}
      );
    }

    if (path.startsWith('/api/')) {
      const allowedParams = ['id', 'tournamentId', 'roundId', 'playerId', 'page', 'limit', 'filter', 'debug', 'ref'];
      InputValidator.validateQueryParams(req.url, allowedParams);
    }

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const ct = req.headers.get('content-type');
      if (ct && !ct.includes('application/json')) {
        throw AppError.validation('Invalid content type', 'Tipo de contenido no válido');
      }
    }

    return { ip, userAgent, path };
  };
}

// 6. HEADERS DE SEGURIDAD
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "font-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
} as const;
