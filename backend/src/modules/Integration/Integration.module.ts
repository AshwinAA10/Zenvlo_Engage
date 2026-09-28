import { Module } from '@nestjs/common';
import { ZenvloWhatsAppService } from './services/zenvlo-whatsapp.service';
import { WHATSAPP_INTEGRATION_SERVICE } from './interfaces/whatsapp-integration.interface';

@Module({
  providers: [
    {
      provide: WHATSAPP_INTEGRATION_SERVICE,
      useClass: ZenvloWhatsAppService,
    },
    ZenvloWhatsAppService,
  ],
  exports: [WHATSAPP_INTEGRATION_SERVICE, ZenvloWhatsAppService],
})
export class IntegrationModule {}
