import { Module } from '@nestjs/common';
import { ZenvloWhatsAppService } from './services/zenvlo-whatsapp.service';
import { WHATSAPP_INTEGRATION_SERVICE } from './interfaces/whatsapp-integration.interface';
import { GooglePlacesService } from './services/google-places.service';
import { GOOGLE_PLACES_SERVICE } from './interfaces/google-places.interface';

@Module({
  providers: [
    {
      provide: WHATSAPP_INTEGRATION_SERVICE,
      useClass: ZenvloWhatsAppService,
    },
    ZenvloWhatsAppService,
    {
      provide: GOOGLE_PLACES_SERVICE,
      useClass: GooglePlacesService,
    },
    GooglePlacesService,
  ],
  exports: [
    WHATSAPP_INTEGRATION_SERVICE,
    ZenvloWhatsAppService,
    GOOGLE_PLACES_SERVICE,
    GooglePlacesService,
  ],
})
export class IntegrationModule {}
