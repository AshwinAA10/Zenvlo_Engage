import { BeforeInsert, BeforeUpdate } from 'typeorm';
import { ClsServiceManager } from 'nestjs-cls';
import { BaseTable } from './base.table';

export abstract class TenantBaseEntity extends BaseTable {
  @BeforeInsert()
  populateTenantContextOnInsert(): void {
    const cls = ClsServiceManager.getClsService();
    if (cls && cls.isActive()) {
      const businessId =
        cls.get<string>('business_id') ||
        cls.get<string>('workspace_id');
      const userId = cls.get<string>('user_id');

      if (!this.business_id && businessId) {
        this.business_id = businessId;
      }
      if (!this.created_by_id && userId) {
        this.created_by_id = userId;
      }
      if (!this.updated_by_id && userId) {
        this.updated_by_id = userId;
      }
    }
  }

  @BeforeUpdate()
  populateTenantContextOnUpdate(): void {
    const cls = ClsServiceManager.getClsService();
    if (cls && cls.isActive()) {
      const userId = cls.get<string>('user_id');
      if (userId) {
        this.updated_by_id = userId;
      }
    }
  }
}
