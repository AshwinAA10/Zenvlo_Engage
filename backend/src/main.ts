import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppValidationPipe } from './pipes/validation.pipe';
import { HttpExceptionFilter } from './filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 4000;
  const corsOrigin =
    configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000';

  app.enableCors({
    origin: (origin, cb) => {
      // Allow requests from frontend, local dev, or external websites loading public widgets
      cb(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-request-id',
      'x-razorpay-signature',
      'x-hub-signature-256',
      'x-hub-timestamp',
      'x-zenvlo-signature',
      'x-zenvlo-timestamp',
    ],
  });

  app.setGlobalPrefix('api');

  const pinoLogger = await app.resolve(PinoLogger);
  app.useGlobalFilters(new HttpExceptionFilter(pinoLogger));
  app.useGlobalPipes(new AppValidationPipe());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Zenvlo Engage API')
    .setDescription(
      'India-first testimonial and review management SaaS API for local businesses & D2C brands',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Support both /docs (as required by PRD Section 25) and /api/docs
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port, '0.0.0.0');

  logger.log(
    `Zenvlo Engage API is running on: http://localhost:${port}/api`,
  );
  logger.log(
    `OpenAPI Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
}

bootstrap();