// lib/api-errors.ts - User-friendly error handling utilities

import { NextResponse } from "next/server";
import { logger } from "./logger";

/**
 * Standard API error codes
 */
export enum ApiErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  SESSION_EXPIRED = "SESSION_EXPIRED",

  // Resource errors
  NOT_FOUND = "NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",

  // Validation errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",

  // Business logic errors
  TOURNAMENT_FULL = "TOURNAMENT_FULL",
  ROUND_CLOSED = "ROUND_CLOSED",
  MATCH_ALREADY_CONFIRMED = "MATCH_ALREADY_CONFIRMED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",

  // System errors
  DATABASE_ERROR = "DATABASE_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  // Authentication & Authorization
  [ApiErrorCode.UNAUTHORIZED]: "Debes iniciar sesión para acceder a este recurso",
  [ApiErrorCode.FORBIDDEN]: "No tienes permisos para realizar esta acción",
  [ApiErrorCode.SESSION_EXPIRED]: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente",

  // Resource errors
  [ApiErrorCode.NOT_FOUND]: "El recurso solicitado no existe",
  [ApiErrorCode.ALREADY_EXISTS]: "Este recurso ya existe",

  // Validation errors
  [ApiErrorCode.VALIDATION_ERROR]: "Los datos proporcionados no son válidos",
  [ApiErrorCode.INVALID_INPUT]: "Por favor, verifica los datos ingresados",

  // Business logic errors
  [ApiErrorCode.TOURNAMENT_FULL]: "El torneo ha alcanzado su capacidad máxima",
  [ApiErrorCode.ROUND_CLOSED]: "Esta ronda ya ha sido cerrada",
  [ApiErrorCode.MATCH_ALREADY_CONFIRMED]: "Este partido ya ha sido confirmado",
  [ApiErrorCode.INSUFFICIENT_PERMISSIONS]: "No tienes permisos suficientes para esta operación",

  // System errors
  [ApiErrorCode.DATABASE_ERROR]: "Error al conectar con la base de datos. Intenta nuevamente",
  [ApiErrorCode.INTERNAL_ERROR]: "Ha ocurrido un error inesperado. Por favor, intenta más tarde",
  [ApiErrorCode.SERVICE_UNAVAILABLE]: "El servicio no está disponible en este momento",
};

/**
 * HTTP status codes for each error type
 */
const ERROR_STATUS_CODES: Record<ApiErrorCode, number> = {
  // Authentication & Authorization
  [ApiErrorCode.UNAUTHORIZED]: 401,
  [ApiErrorCode.FORBIDDEN]: 403,
  [ApiErrorCode.SESSION_EXPIRED]: 401,

  // Resource errors
  [ApiErrorCode.NOT_FOUND]: 404,
  [ApiErrorCode.ALREADY_EXISTS]: 409,

  // Validation errors
  [ApiErrorCode.VALIDATION_ERROR]: 400,
  [ApiErrorCode.INVALID_INPUT]: 400,

  // Business logic errors
  [ApiErrorCode.TOURNAMENT_FULL]: 400,
  [ApiErrorCode.ROUND_CLOSED]: 400,
  [ApiErrorCode.MATCH_ALREADY_CONFIRMED]: 400,
  [ApiErrorCode.INSUFFICIENT_PERMISSIONS]: 403,

  // System errors
  [ApiErrorCode.DATABASE_ERROR]: 500,
  [ApiErrorCode.INTERNAL_ERROR]: 500,
  [ApiErrorCode.SERVICE_UNAVAILABLE]: 503,
};

/**
 * Structured API error interface
 */
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: any;
  timestamp: string;
  path?: string;
}

/**
 * Create a structured API error response
 */
export function createErrorResponse(
  code: ApiErrorCode,
  customMessage?: string,
  details?: any,
  path?: string
): NextResponse<ApiError> {
  const message = customMessage || ERROR_MESSAGES[code];
  const statusCode = ERROR_STATUS_CODES[code];

  const errorResponse: ApiError = {
    code,
    message,
    timestamp: new Date().toISOString(),
    ...(details && { details }),
    ...(path && { path }),
  };

  // Log error (warnings for client errors, errors for server errors)
  if (statusCode >= 500) {
    logger.error(`API Error: ${code}`, { message, details, path });
  } else if (statusCode >= 400) {
    logger.warn(`API Warning: ${code}`, { message, details, path });
  }

  return NextResponse.json(errorResponse, { status: statusCode });
}

/**
 * Wrap an async API handler with error handling
 */
export function withErrorHandling<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiError>> {
  return handler().catch((error: unknown) => {
    // Handle known ApiError codes
    if (error instanceof Error && error.message in ApiErrorCode) {
      return createErrorResponse(error.message as ApiErrorCode);
    }

    // Handle Prisma errors
    if (error && typeof error === "object" && "code" in error) {
      const prismaError = error as { code: string; meta?: any };

      switch (prismaError.code) {
        case "P2002":
          return createErrorResponse(
            ApiErrorCode.ALREADY_EXISTS,
            "Este registro ya existe",
            prismaError.meta
          );
        case "P2025":
          return createErrorResponse(
            ApiErrorCode.NOT_FOUND,
            "Registro no encontrado",
            prismaError.meta
          );
        default:
          return createErrorResponse(
            ApiErrorCode.DATABASE_ERROR,
            undefined,
            { code: prismaError.code }
          );
      }
    }

    // Handle generic errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Unhandled error in API handler", error);

    return createErrorResponse(
      ApiErrorCode.INTERNAL_ERROR,
      undefined,
      process.env.NODE_ENV === "development" ? { error: errorMessage } : undefined
    );
  });
}

/**
 * Throw a typed API error
 */
export function throwApiError(
  code: ApiErrorCode,
  message?: string,
  details?: any
): never {
  const error = new Error(message || ERROR_MESSAGES[code]);
  error.name = code;
  (error as any).code = code;
  (error as any).details = details;
  throw error;
}

/**
 * Validation helper
 */
export function validateRequired<T>(
  value: T | null | undefined,
  fieldName: string
): T {
  if (value === null || value === undefined) {
    throwApiError(
      ApiErrorCode.VALIDATION_ERROR,
      `El campo '${fieldName}' es requerido`
    );
  }
  return value;
}

/**
 * Authorization helper
 */
export function requireAuth(session: any): asserts session is { user: { id: string } } {
  if (!session?.user?.id) {
    throwApiError(ApiErrorCode.UNAUTHORIZED);
  }
}

/**
 * Admin authorization helper
 */
export function requireAdmin(session: any): asserts session is { user: { id: string; isAdmin: true } } {
  requireAuth(session);
  if (!session.user.isAdmin) {
    throwApiError(ApiErrorCode.FORBIDDEN, "Se requieren permisos de administrador");
  }
}

/**
 * Success response helper
 */
export function createSuccessResponse<T>(data: T, status: number = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * Paginated response helper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

/**
 * Example usage in an API route:
 *
 * export async function GET(req: NextRequest) {
 *   return withErrorHandling(async () => {
 *     const session = await getServerSession(authOptions);
 *     requireAuth(session);
 *
 *     const data = await prisma.tournament.findMany();
 *     return createSuccessResponse(data);
 *   });
 * }
 */
