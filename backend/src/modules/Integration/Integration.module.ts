import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { ZenvloWhatsAppService } from './services/zenvlo-whatsapp.service';
import { MockWhatsAppService } from './services/mock-whatsapp.service';
import { WHATSAPP_INTEGRATION_SERVICE } from './interfaces/whatsapp-integration.interface';
import { GooglePlacesService } from './services/google-places.service';
import { GOOGLE_PLACES_SERVICE } from './interfaces/google-places.interface';
import { RazorpayService } from './services/razorpay.service';
import { RAZORPAY_SERVICE } from './interfaces/razorpay.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: WHATSAPP_INTEGRATION_SERVICE,
      useFactory: (configService: ConfigService, logger?: PinoLogger) => {
        const nodeEnv = (
          configService.get<string>('NODE_ENV') ||
          process.env.NODE_ENV ||
          'development'
        ).toLowerCase();
        const isProduction = nodeEnv === 'production';
        const providerConfig = (
          configService.get<string>('WHATSAPP_PROVIDER') ||
          process.env.WHATSAPP_PROVIDER ||
          (isProduction ? 'zenvlo' : 'mock')
        ).toLowerCase();

        if (isProduction) {
          if (providerConfig !== 'zenvlo') {
            throw new Error(
              `[SECURITY FATAL] Insecure WhatsApp provider '${providerConfig}' is strictly forbidden in production. Production must use 'zenvlo'.`,
            );
          }
          return new ZenvloWhatsAppService(logger, configService);
        }

        if (providerConfig === 'zenvlo') {
          return new ZenvloWhatsAppService(logger, configService);
        }

        return new MockWhatsAppService(logger);
      },
      inject: [ConfigService, { token: PinoLogger, optional: true }],
    },
    ZenvloWhatsAppService,
    MockWhatsAppService,
    {
      provide: GOOGLE_PLACES_SERVICE,
      useClass: GooglePlacesService,
    },
    GooglePlacesService,
    {
      provide: RAZORPAY_SERVICE,
      useClass: RazorpayService,
    },
    RazorpayService,
  ],
  exports: [
    WHATSAPP_INTEGRATION_SERVICE,
    ZenvloWhatsAppService,
    MockWhatsAppService,
    GOOGLE_PLACES_SERVICE,
    GooglePlacesService,
    RAZORPAY_SERVICE,
    RazorpayService,
  ],
})
export class IntegrationModule {}
