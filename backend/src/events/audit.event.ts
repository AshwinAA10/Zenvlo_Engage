export class AuditRecordEvent {
  constructor(
    public readonly workspace_id: string,
    public readonly actor_id: string,
    public readonly action: string,
    public readonly entity_name: string,
    public readonly entity_id?: string,
    public readonly metadata?: Record<string, any>,
  ) {}
}
