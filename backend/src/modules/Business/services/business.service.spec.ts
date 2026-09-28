import { BusinessService } from './business.service';
import { Business } from '../entities/business.entity';

describe('BusinessService', () => {
  let service: BusinessService;

  beforeEach(() => {
    service = new BusinessService();
    jest.clearAllMocks();
  });

  it('should generate clean unique slugs from business name', async () => {
    jest.spyOn(Business, 'findOne').mockResolvedValue(null);

    const mockSave = jest.fn().mockImplementation(function (this: any) {
      this.id = 'bus-123';
      return Promise.resolve(this);
    });
    jest.spyOn(Business.prototype, 'save').mockImplementation(mockSave);

    const result = await service.InsertOnboarding('user-123', {
      name: 'Lotus Wellness & Ayurvedic Clinic!',
      category: 'Clinic',
      phone: '+919988776655',
    });

    expect(result.slug).toBe('lotus-wellness-ayurvedic-clinic');
    expect(result.category).toBe('Clinic');
    expect(result.user_id).toBe('user-123');
  });

  it('should append numeric suffix if slug already exists', async () => {
    // First lookup in InsertOnboarding checks if user has business -> null
    // Then slug check returns an existing business once, then null
    jest
      .spyOn(Business, 'findOne')
      .mockResolvedValueOnce(null) // GetByUser
      .mockResolvedValueOnce({ id: 'existing-id' } as any) // slug collision
      .mockResolvedValueOnce(null); // slug available

    const mockSave = jest.fn().mockImplementation(function (this: any) {
      this.id = 'bus-456';
      return Promise.resolve(this);
    });
    jest.spyOn(Business.prototype, 'save').mockImplementation(mockSave);

    const result = await service.InsertOnboarding('user-456', {
      name: 'Spa Oasis',
    });

    expect(result.slug).toBe('spa-oasis-1');
  });
});
