// lib/logger.ts - Centralized logging utility with environment checks

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';
  private enableProductionLogs = process.env.ENABLE_PRODUCTION_LOGS === 'true';

  /**
   * Debug level - only in development
   */
  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.log(`[DEBUG] ${message}`, context || '');
    }
  }

  /**
   * Info level - development + optional production
   */
  info(message: string, context?: LogContext) {
    if (this.isDevelopment || this.enableProductionLogs) {
      console.log(`[INFO] ${message}`, context || '');
    }
  }

  /**
   * Warning level - always logged
   */
  warn(message: string, context?: LogContext) {
    console.warn(`[WARN] ${message}`, context || '');
  }

  /**
   * Error level - always logged
   */
  error(message: string, error?: Error | any, context?: LogContext) {
    const errorDetails = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;

    console.error(`[ERROR] ${message}`, {
      ...errorDetails,
      ...context
    });
  }

  /**
   * Performance timing helper
   */
  time(label: string) {
    if (this.isDevelopment) {
      console.time(label);
    }
  }

  timeEnd(label: string) {
    if (this.isDevelopment) {
      console.timeEnd(label);
    }
  }

  /**
   * API request logger
   */
  apiRequest(method: string, path: string, context?: LogContext) {
    this.debug(`${method} ${path}`, context);
  }

  /**
   * API response logger
   */
  apiResponse(method: string, path: string, statusCode: number, durationMs?: number) {
    const duration = durationMs ? ` (${durationMs}ms)` : '';
    this.debug(`${method} ${path} -> ${statusCode}${duration}`);
  }

  /**
   * Database query logger
   */
  dbQuery(operation: string, model: string, context?: LogContext) {
    this.debug(`DB ${operation} ${model}`, context);
  }

  /**
   * Business logic logger
   */
  business(message: string, context?: LogContext) {
    this.info(`[BUSINESS] ${message}`, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for extensibility
export type { LogLevel, LogContext };
