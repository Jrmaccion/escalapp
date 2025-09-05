// lib/error-handler.ts - SISTEMA CENTRALIZADO DE ERRORES

export enum AppErrorCode {
  // Errores de autenticación
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INVALID_SESSION = "INVALID_SESSION",

  // Errores de validación
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",

  // Errores de negocio
  NOT_FOUND = "NOT_FOUND", // genérico
  TOURNAMENT_NOT_FOUND = "TOURNAMENT_NOT_FOUND", // mantenido por compatibilidad
  ROUND_ALREADY_CLOSED = "ROUND_ALREADY_CLOSED",
  INSUFFICIENT_PLAYERS = "INSUFFICIENT_PLAYERS",
  MATCHES_INCOMPLETE = "MATCHES_INCOMPLETE",
  CONCURRENT_MODIFICATION = "CONCURRENT_MODIFICATION",

  // Errores de sistema
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR"
}

/**
 * Contexto estándar para enriquecer errores. Incluye campos usados por
 * security.ts, concurrency.ts y performance.ts, además de una firma abierta.
 */
interface ErrorContext {
  // Identidad y request
  userId?: string;
  requestId?: string;
  timestamp: Date;

  // Entidades de dominio
  tournamentId?: string;
  roundId?: string;
  groupId?: string;
  playerId?: string;
  requestedPlayerId?: string;

  // Operación y recursos
  operation?: string;
  resource?: string;
  attemptedAction?: string;
  path?: string;

  // Datos de cliente
  ip?: string;
  userAgent?: string;

  // Validación
  field?: string;
  value?: unknown;

  // Concurrencia / integridad
  roundNumber?: number;
  timeDiff?: number;
  originalTimestamp?: Date;
  originalHash?: string;
  currentHash?: string;

  // Permite metadatos ad-hoc sin romper el tipado
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly statusCode: number;
  public readonly context: ErrorContext;
  public readonly isOperational: boolean;
  public readonly userMessage: string;

  constructor(
    code: AppErrorCode,
    message: string,
    userMessage: string = "Ha ocurrido un error",
    statusCode: number = 500,
    context: Partial<ErrorContext> = {},
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.userMessage = userMessage;
    this.isOperational = isOperational;
    this.context = {
      timestamp: new Date(),
      ...context
    };

    // Mantener stack trace
    Error.captureStackTrace(this, AppError);
  }

  static unauthorized(message: string = "No autorizado", context?: Partial<ErrorContext>) {
    return new AppError(
      AppErrorCode.UNAUTHORIZED,
      message,
      "No tienes permisos para realizar esta acción",
      401,
      context
    );
  }

  static validation(message: string, userMessage?: string, context?: Partial<ErrorContext>) {
    return new AppError(
      AppErrorCode.VALIDATION_ERROR,
      message,
      userMessage || "Los datos proporcionados no son válidos",
      400,
      context
    );
  }

  static notFound(resource: string, id?: string, context?: Partial<ErrorContext>) {
    return new AppError(
      AppErrorCode.NOT_FOUND, // genérico; se mantiene TOURNAMENT_NOT_FOUND por compat.
      `${resource} not found${id ? `: ${id}` : ''}`,
      `No se encontró el ${resource.toLowerCase()} solicitado`,
      404,
      context
    );
  }

  static businessLogic(
    code: AppErrorCode,
    message: string,
    userMessage: string,
    context?: Partial<ErrorContext>
  ) {
    return new AppError(code, message, userMessage, 409, context);
  }

  static internal(message: string, originalError?: Error, context?: Partial<ErrorContext>) {
    const appError = new AppError(
      AppErrorCode.INTERNAL_ERROR,
      message,
      "Error interno del servidor. Por favor, inténtalo más tarde",
      500,
      context,
      false
    );

    if (originalError) {
      appError.stack = originalError.stack;
    }

    return appError;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.userMessage,
      timestamp: this.context.timestamp,
      ...(process.env.NODE_ENV === 'development' && {
        details: {
          originalMessage: this.message,
          stack: this.stack,
          context: this.context
        }
      })
    };
  }
}

// Logger centralizado
export class Logger {
  private static logError(error: AppError | Error, context?: any) {
    const logData = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: error.message,
      stack: error.stack,
      context: context || {},
      ...(error instanceof AppError && {
        code: error.code,
        userMessage: error.userMessage,
        isOperational: error.isOperational,
        errorContext: error.context
      })
    };

    // En producción, enviar a servicio de logging externo
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrar con servicio como DataDog, Sentry, etc.
      console.error(JSON.stringify(logData));
    } else {
      console.error('🔥 ERROR:', logData);
    }
  }

  static error(error: AppError | Error, context?: any) {
    this.logError(error, context);
  }

  static warn(message: string, context?: any) {
    console.warn('⚠️ WARNING:', { message, context, timestamp: new Date().toISOString() });
  }

  static info(message: string, context?: any) {
    console.log('ℹ️ INFO:', { message, context, timestamp: new Date().toISOString() });
  }
}

// Handler para APIs de Next.js
export function handleApiError(error: unknown, context?: Partial<ErrorContext>) {
  if (error instanceof AppError) {
    Logger.error(error);
    return {
      status: error.statusCode,
      body: error.toJSON()
    };
  }

  // Error no manejado - convertir a AppError
  const appError = AppError.internal(
    `Unhandled error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    error instanceof Error ? error : undefined,
    context
  );

  Logger.error(appError);

  return {
    status: 500,
    body: appError.toJSON()
  };
}

// Middleware para wrappear funciones async
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: Partial<ErrorContext>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.internal(
        `Error in ${fn.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
        context
      );
    }
  };
}
