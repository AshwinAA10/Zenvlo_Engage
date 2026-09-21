import { ClsServiceManager } from 'nestjs-cls';
import { TenantBaseEntity } from './tenant-base.entity';

class TestTenantEntity extends TenantBaseEntity {
  name: string;
}

describe('TenantBaseEntity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should automatically populate workspace_id and created_by_id on insert from active CLS context', () => {
    const mockCls = {
      isActive: () => true,
      get: (key: string) => {
        if (key === 'workspace_id') return 'ws-1111-2222-3333';
        if (key === 'user_id') return 'user-4444-5555-6666';
        return null;
      },
    };

    jest.spyOn(ClsServiceManager, 'getClsService').mockReturnValue(mockCls as any);

    const entity = new TestTenantEntity();
    entity.name = 'Test Contact';
    entity.populateTenantContextOnInsert();

    expect(entity.workspace_id).toBe('ws-1111-2222-3333');
    expect(entity.created_by_id).toBe('user-4444-5555-6666');
    expect(entity.updated_by_id).toBe('user-4444-5555-6666');
  });

  it('should update updated_by_id on update from active CLS context', () => {
    const mockCls = {
      isActive: () => true,
      get: (key: string) => (key === 'user_id' ? 'user-updater-7777' : null),
    };

    jest.spyOn(ClsServiceManager, 'getClsService').mockReturnValue(mockCls as any);

    const entity = new TestTenantEntity();
    entity.workspace_id = 'ws-original';
    entity.created_by_id = 'user-creator';
    entity.updated_by_id = 'user-creator';

    entity.populateTenantContextOnUpdate();

    expect(entity.workspace_id).toBe('ws-original');
    expect(entity.created_by_id).toBe('user-creator');
    expect(entity.updated_by_id).toBe('user-updater-7777');
  });
});
