// lib/api-errors.ts - User-friendly error handling utilities
import { NextResponse } from "next/server";
import { logger } from "./logger";

/**
 * Standard API error codes
 */
export enum ApiErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  BAD_REQUEST = "BAD_REQUEST",
  CONFLICT = "CONFLICT",
  RATE_LIMITED = "RATE_LIMITED",
  INTERNAL = "INTERNAL",
}

const CODE_TO_STATUS: Record<ApiErrorCode, number> = {
  [ApiErrorCode.UNAUTHORIZED]: 401,
  [ApiErrorCode.FORBIDDEN]: 403,
  [ApiErrorCode.NOT_FOUND]: 404,
  [ApiErrorCode.BAD_REQUEST]: 400,
  [ApiErrorCode.CONFLICT]: 409,
  [ApiErrorCode.RATE_LIMITED]: 429,
  [ApiErrorCode.INTERNAL]: 500,
};

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ApiErrorCode, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status ?? CODE_TO_STATUS[code] ?? 500;
    this.details = details;
  }
}

/**
 * Use inside handlers to abort with a typed error.
 */
export function throwApiError(
  code: ApiErrorCode,
  message: string,
  details?: unknown
): never {
  throw new ApiError(code, message, undefined, details);
}

/**
 * Returns a plain NextResponse (no generics) to avoid union type issues.
 */
export function createSuccessResponse<T>(data: T): NextResponse {
  return NextResponse.json(data);
}

/**
 * Auth helpers
 */
export function requireAuth(session: any): asserts session is { user: { id: string } } {
  if (!session?.user?.id) {
    throwApiError(ApiErrorCode.UNAUTHORIZED, "No autorizado");
  }
}

export function requireAdmin(session: any): void {
  if (!session?.user?.isAdmin) {
    throwApiError(ApiErrorCode.FORBIDDEN, "No tienes permisos para esta acción");
  }
}

/**
 * Wrap any route handler to standardize error handling.
 * Always returns NextResponse (non-generic) to keep TS happy.
 */
export async function withErrorHandling(
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      logger?.error?.("API Error", { code: err.code, status: err.status, message: err.message, details: err.details });
      return NextResponse.json(
        { errorCode: err.code, message: err.message, details: err.details },
        { status: err.status }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    logger?.error?.("Unhandled API Error", { message, err });
    return NextResponse.json(
      { errorCode: ApiErrorCode.INTERNAL, message: "Error interno del servidor", details: message },
      { status: 500 }
    );
  }
}

/**
 * Convenience helpers (optional)
 */
export function createPaginatedResponse<T>(
  items: T[],
  meta: { page?: number; pageSize?: number; total?: number } = {}
): NextResponse {
  return NextResponse.json({ items, _metadata: meta });
}
