import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { GlobalConfig } from './entities/global-config.entity';
import { AuditListener } from './services/audit.listener';
import { HealthController } from './controllers/health.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, GlobalConfig])],
  controllers: [HealthController],
  providers: [AuditListener],
  exports: [AuditListener, TypeOrmModule],
})
export class SystemModule {}
