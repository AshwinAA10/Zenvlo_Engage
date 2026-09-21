import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PinoLogger } from 'nestjs-pino';
import { EVENT_AUDIT_RECORD } from '../../../common/constants';
import { AuditRecordEvent } from '../../../events/audit.event';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditListener {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AuditListener.name);
  }

  @OnEvent(EVENT_AUDIT_RECORD, { async: true })
  async handleAuditRecord(event: AuditRecordEvent): Promise<void> {
    try {
      const log = new AuditLog();
      log.workspace_id = event.workspace_id;
      log.actor_id = event.actor_id;
      log.action = event.action;
      log.entity_name = event.entity_name;
      log.entity_id = event.entity_id || null;
      log.metadata = event.metadata || null;

      await log.save();

      this.logger.info(
        {
          workspace_id: event.workspace_id,
          action: event.action,
          entity: event.entity_name,
        },
        'Audit record persisted successfully',
      );
    } catch (error: any) {
      this.logger.error(
        { err: error.message, stack: error.stack },
        'Failed to persist audit log record',
      );
    }
  }
}
