import { Injectable } from '@nestjs/common';
import { createLogger, format, transports, Logger } from 'winston';
import { RequestContextStorage } from '../request-context';

@Injectable()
export class AppLogger {
  private logger: Logger;

  constructor() {
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json(),
      ),
      transports: [new transports.Console()],
    });
  }

  private enrich(message: string, meta?: Record<string, any>) {
    const context = RequestContextStorage.getStore();

    return {
      message,
      correlationId: context?.correlationId,
      ...meta,
    };
  }

  info(message: string, meta?: Record<string, any>) {
    this.logger.info(this.enrich(message, meta));
  }

  warn(message: string, meta?: Record<string, any>) {
    this.logger.warn(this.enrich(message, meta));
  }

  error(message: string, meta?: Record<string, any>) {
    this.logger.error(this.enrich(message, meta));
  }

  debug(message: string, meta?: Record<string, any>) {
    this.logger.debug(this.enrich(message, meta));
  }
}
