import { Injectable, NestMiddleware, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessedEvent } from '../entities/processed-event.entity';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class IdempotentMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(ProcessedEvent)
    private readonly processedEventRepo: Repository<ProcessedEvent>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Generate event hash from request body + path
    const hash = crypto
      .createHash('sha256')
      .update(req.originalUrl + JSON.stringify(req.body))
      .digest('hex');

    const existing = await this.processedEventRepo.findOne({ where: { eventHash: hash } });

    if (existing) {
      // Duplicate detected
      throw new ConflictException('Duplicate event detected. Ignoring.');
    }

    // Save new processed event
    const processedEvent = this.processedEventRepo.create({
      eventHash: hash,
      source: req.originalUrl.split('/')[1] || 'unknown',
    });
    await this.processedEventRepo.save(processedEvent);

    next();
  }
}
