import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { RequestContextStorage } from '../../common/request-context';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id']?.toString() ?? uuid();

    RequestContextStorage.run({ correlationId }, () => {
      res.setHeader('x-correlation-id', correlationId);
      next();
    });
  }
}
