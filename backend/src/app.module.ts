import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';

import { dataSourceOptions } from './database/data-source';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';

import { SystemModule } from './modules/System/System.module';
import { UserModule } from './modules/User/User.module';
import { BusinessModule } from './modules/Business/Business.module';
import { AuthModule } from './modules/Auth/Auth.module';
import { CustomerModule } from './modules/Customer/Customer.module';
import { TestimonialModule } from './modules/Testimonial/Testimonial.module';
import { IntegrationModule } from './modules/Integration/Integration.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('NODE_ENV') === 'production' ? 'info' : 'debug',
          transport:
            config.get<string>('NODE_ENV') !== 'production'
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:standard',
                  },
                }
              : undefined,
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'body.password',
            'body.token',
            'body.secret_key',
            'body.access_token',
          ],
        },
      }),
    }),

    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: any) =>
          (req.headers && (req.headers['x-request-id'] as string)) || uuidv4(),
      },
    }),

    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => ({
        ...dataSourceOptions,
        autoLoadEntities: true,
      }),
    }),

    SystemModule,
    UserModule,
    BusinessModule,
    AuthModule,
    CustomerModule,
    TestimonialModule,
    IntegrationModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
