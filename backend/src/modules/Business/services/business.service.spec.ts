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

  describe('GetOnboardingStatus and UpdateOnboardingStatus', () => {
    it('should derive onboarding status and steps from business entity and real state', async () => {
      const mockBusiness = {
        id: 'bus-789',
        name: 'Aura Laser Clinic',
        category: 'Healthcare & Clinic',
        phone: '+919876543210',
        settings: {
          onboarding: {
            current_step: 1,
            completed_steps: ['profile'],
            skipped_steps: [],
            dismissed: false,
            completed: false,
          },
        },
      };

      jest.spyOn(service, 'GetById').mockResolvedValue(mockBusiness as any);

      const status = await service.GetOnboardingStatus('bus-789');

      expect(status.business_id).toBe('bus-789');
      expect(status.has_profile).toBe(true);
      expect(status.completed_steps).toContain('profile');
      expect(status.completed).toBe(false);
      expect(status.dismissed).toBe(false);
      expect(status.current_step).toBe(1);
    });

    it('should persist updated onboarding state into business.settings without falsifying completion', async () => {
      const mockBusiness: any = {
        id: 'bus-789',
        name: 'Aura Laser Clinic',
        category: 'Healthcare & Clinic',
        phone: '+919876543210',
        settings: {},
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
      };

      jest.spyOn(service, 'GetById').mockResolvedValue(mockBusiness);

      const updated = await service.UpdateOnboardingStatus('bus-789', 'user-123', {
        current_step: 2,
        skipped_steps: ['optional_logo'],
        dismissed: false,
      });

      expect(mockBusiness.save).toHaveBeenCalled();
      expect(mockBusiness.settings.onboarding).toBeDefined();
      expect(mockBusiness.settings.onboarding.current_step).toBe(2);
      expect(mockBusiness.settings.onboarding.skipped_steps).toContain('optional_logo');
      expect(updated.skipped_steps).toContain('optional_logo');
      expect(updated.completed).toBe(false);
    });

    it('should mark onboarding completed when requested', async () => {
      const mockBusiness: any = {
        id: 'bus-789',
        name: 'Aura Laser Clinic',
        category: 'Healthcare & Clinic',
        phone: '+919876543210',
        settings: {},
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
      };

      jest.spyOn(service, 'GetById').mockResolvedValue(mockBusiness);

      const updated = await service.UpdateOnboardingStatus('bus-789', 'user-123', {
        completed: true,
        dismissed: true,
        completed_steps: ['profile', 'channel', 'first_milestone'],
      });

      expect(mockBusiness.save).toHaveBeenCalled();
      expect(updated.completed).toBe(true);
      expect(updated.dismissed).toBe(true);
    });
  });
});
