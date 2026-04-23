import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { Request, Response, NextFunction } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppLogger } from './common/logger/logger.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { NotificationService } from './lib/notification-service';

// Idempotency layer
import { IdempotentMiddleware } from './common/middleware/idempotent.middleware';
import { ProcessedEvent } from './common/entities/processed-event.entity';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const logger = app.get(AppLogger);

  // Initialize email transporter
  NotificationService.initializeEmailTransporter();

  // Global interceptors and filters
  app.useGlobalInterceptors(new LoggingInterceptor(logger));
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  // Backward compatibility middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.url.startsWith('/api/') && req.url !== '/favicon.ico') {
      req.url = `/api/v1${req.url}`;
    }
    next();
  });

  // Global prefix and versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation pipeline
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Register IdempotentMiddleware for external event routes
  app.use('/api/v1/webhooks', app.get(IdempotentMiddleware));
  app.use('/api/v1/spin', app.get(IdempotentMiddleware));
  app.use('/api/v1/contracts/events', app.get(IdempotentMiddleware));

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Renaissance API')
    .setDescription(
      'API documentation for the Renaissance platform - a fantasy sports card marketplace',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'User authentication and authorization endpoints')
    .addTag('Player Cards', 'Player card metadata and NFT management')
    .addTag('Users', 'User management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;

  await app.listen(port);
}

void bootstrap();
