import { createLogger, format, transports } from 'winston';

export type LogMeta = Record<string, unknown>;

class AppLogger {
  private static instance: AppLogger | undefined;

  private readonly logger = createLogger({
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: format.combine(
      format.errors({ stack: true }),
      format.timestamp(),
      AppLogger.flattenError(),
      format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const stackSegment = stack ? ` | ${stack}` : '';
        const metaSegment = AppLogger.serializeMeta(meta);
        return `${timestamp} ${level}: ${message}${stackSegment}${metaSegment}`;
      }),
    ),
    transports: [new transports.Console()],
  });

  static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger();
    }
    return AppLogger.instance;
  }

  debug(message: string, meta?: LogMeta) {
    this.logger.debug(AppLogger.toOneLine(message), meta);
  }

  info(message: string, meta?: LogMeta) {
    this.logger.info(AppLogger.toOneLine(message), meta);
  }

  warn(message: string, meta?: LogMeta) {
    this.logger.warn(AppLogger.toOneLine(message), meta);
  }

  error(error: unknown, message = 'Unhandled error', meta?: LogMeta) {
    const errorMessage = AppLogger.serializeError(error);
    const base = message ? `${AppLogger.toOneLine(message)} | ${errorMessage}` : errorMessage;
    this.logger.error(base, meta);
  }

  private static flattenError() {
    return format((info) => {
      if (typeof info.message === 'string') {
        info.message = AppLogger.toOneLine(info.message);
      }
      if (info.stack && typeof info.stack === 'string') {
        info.stack = AppLogger.toOneLine(info.stack);
      }
      return info;
    })();
  }

  private static serializeError(error: unknown): string {
    if (error instanceof Error) {
      const parts = [`${error.name}: ${error.message}`];
      if (error.stack) {
        parts.push(error.stack);
      }
      return AppLogger.toOneLine(parts.join(' | '));
    }

    if (typeof error === 'string') {
      return AppLogger.toOneLine(error);
    }

    if (error && typeof error === 'object') {
      try {
        return AppLogger.toOneLine(JSON.stringify(error));
      } catch {
        return 'Unserializable error object';
      }
    }

    return 'Unknown error';
  }

  private static toOneLine(value: string): string {
    return value.replace(/\s*\n+\s*/g, ' | ').replace(/\s{2,}/g, ' ').trim();
  }

  private static serializeMeta(meta: Record<string, unknown>): string {
    if (!meta || Object.keys(meta).length === 0) {
      return '';
    }

    try {
      return ` ${JSON.stringify(meta)}`;
    } catch {
      return '';
    }
  }
}

export const logger = AppLogger.getInstance();
