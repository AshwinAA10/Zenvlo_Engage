import { BusinessService } from './business.service';
import { Business } from '../entities/business.entity';
import { Customer } from '../../Customer/entities/customer.entity';
import { RequestLog } from '../../Request/entities/request-log.entity';
import { Testimonial } from '../../Testimonial/entities/testimonial.entity';
import { Widget } from '../../Widget/entities/widget.entity';

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

  describe('GetChecklistStatus and UpdateChecklistPreferences', () => {
    it('should derive 5 authoritative checklist tasks and progress from real entity counts', async () => {
      const mockBusiness: any = {
        id: 'bus-101',
        name: 'Apex Dental Care',
        category: 'Dentistry',
        phone: '+919123456789',
        settings: {
          checklist: {
            dismissed: false,
            collapsed: false,
          },
        },
      };

      jest.spyOn(service, 'GetById').mockResolvedValue(mockBusiness);
      jest.spyOn(Customer, 'count').mockResolvedValue(2);
      jest.spyOn(RequestLog, 'count').mockResolvedValue(0);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(0);
      jest.spyOn(Widget, 'count').mockResolvedValue(0);

      const checklist = await service.GetChecklistStatus('bus-101');

      expect(checklist.business_id).toBe('bus-101');
      expect(checklist.total_tasks).toBe(5);
      // profile is true (has name & category), customer is true (count=2), request=false, testimonial=false, widget=false
      expect(checklist.completed_tasks).toBe(2);
      expect(checklist.progress_percentage).toBe(40);
      expect(checklist.all_completed).toBe(false);
      expect(checklist.dismissed).toBe(false);
      expect(checklist.collapsed).toBe(false);

      const profileTask = checklist.tasks.find((t) => t.id === 'profile');
      expect(profileTask?.completed).toBe(true);
      expect(profileTask?.action_url).toBe('/settings');

      const customerTask = checklist.tasks.find((t) => t.id === 'customer');
      expect(customerTask?.completed).toBe(true);
      expect(customerTask?.status_hint).toBe('2 customers added');

      const requestTask = checklist.tasks.find((t) => t.id === 'request');
      expect(requestTask?.completed).toBe(false);
      expect(requestTask?.action_url).toBe('/requests');

      const widgetTask = checklist.tasks.find((t) => t.id === 'widget');
      expect(widgetTask?.is_optional).toBe(true);
    });

    it('should calculate 100% and all_completed when all 5 tasks are completed', async () => {
      const mockBusiness: any = {
        id: 'bus-102',
        name: 'Apex Dental Care',
        category: 'Dentistry',
        phone: '+919123456789',
        settings: {},
      };

      jest.spyOn(service, 'GetById').mockResolvedValue(mockBusiness);
      jest.spyOn(Customer, 'count').mockResolvedValue(5);
      jest.spyOn(RequestLog, 'count').mockResolvedValue(3);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(1);
      jest.spyOn(Widget, 'count').mockResolvedValue(1);

      const checklist = await service.GetChecklistStatus('bus-102');

      expect(checklist.total_tasks).toBe(5);
      expect(checklist.completed_tasks).toBe(5);
      expect(checklist.progress_percentage).toBe(100);
      expect(checklist.all_completed).toBe(true);
      expect(checklist.tasks.every((t) => t.completed)).toBe(true);
    });

    it('should update checklist presentation preferences without altering task completion', async () => {
      const mockBusiness: any = {
        id: 'bus-103',
        name: 'Apex Dental Care',
        category: 'Dentistry',
        settings: {},
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
      };

      jest.spyOn(service, 'GetById').mockResolvedValue(mockBusiness);
      jest.spyOn(Customer, 'count').mockResolvedValue(0);
      jest.spyOn(RequestLog, 'count').mockResolvedValue(0);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(0);
      jest.spyOn(Widget, 'count').mockResolvedValue(0);

      const updated = await service.UpdateChecklistPreferences('bus-103', 'user-123', {
        dismissed: true,
        collapsed: true,
      });

      expect(mockBusiness.save).toHaveBeenCalled();
      expect(mockBusiness.settings.checklist.dismissed).toBe(true);
      expect(mockBusiness.settings.checklist.collapsed).toBe(true);
      expect(updated.dismissed).toBe(true);
      expect(updated.collapsed).toBe(true);
      // Hiding/collapsing MUST NOT falsify task completion:
      expect(updated.completed_tasks).toBe(1); // Only profile is complete
      expect(updated.all_completed).toBe(false);
      expect(updated.progress_percentage).toBe(20);
    });
  });
});

