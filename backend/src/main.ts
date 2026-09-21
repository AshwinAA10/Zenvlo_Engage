import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppValidationPipe } from './pipes/validation.pipe';
import { HttpExceptionFilter } from './filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 4000;
  const corsOrigin = configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000';

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-workspace-id', 'x-request-id'],
  });

  app.setGlobalPrefix('api');

  const pinoLogger = app.get(PinoLogger);
  app.useGlobalFilters(new HttpExceptionFilter(pinoLogger));
  app.useGlobalPipes(new AppValidationPipe());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Zenvlo Engage API')
    .setDescription(
      'Multi-tenant enterprise SaaS API for high-volume WhatsApp & Instagram automation',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-workspace-id', in: 'header' }, 'x-workspace-id')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);
  logger.log(`Zenvlo Engage API is running on: http://localhost:${port}/api`);
  logger.log(`OpenAPI Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
