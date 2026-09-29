import { TestimonialService } from './testimonial.service';
import { Testimonial } from '../entities/testimonial.entity';
import { Business } from '../../Business/entities/business.entity';
import { Customer } from '../../Customer/entities/customer.entity';

describe('TestimonialService', () => {
  let service: TestimonialService;

  beforeEach(() => {
    service = new TestimonialService();
    jest.clearAllMocks();
  });

  it('should submit public testimonial as PENDING with consent captured', async () => {
    jest.spyOn(Business, 'findOne').mockResolvedValue({
      id: 'bus-1',
      slug: 'orchid-salon',
      user_id: 'usr-owner-1',
      status: 1,
    } as any);

    jest.spyOn(Customer, 'findOne').mockResolvedValue(null);

    const mockSave = jest.fn().mockImplementation(function (this: any) {
      this.id = 'testi-123';
      return Promise.resolve(this);
    });
    jest.spyOn(Testimonial.prototype, 'save').mockImplementation(mockSave);

    const result = await service.SubmitPublic('orchid-salon', {
      rating: 5,
      content: 'Absolutely phenomenal service! The staff was courteous.',
      customer_name: 'Priyanka Chopra',
      customer_phone: '+919988776655',
      consent_given: true,
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('testi-123');
  });

  it('should reject submission if consent is missing', async () => {
    jest.spyOn(Business, 'findOne').mockResolvedValue({
      id: 'bus-1',
      slug: 'orchid-salon',
    } as any);

    await expect(
      service.SubmitPublic('orchid-salon', {
        rating: 4,
        content: 'Good experience overall',
        customer_name: 'Rahul',
        consent_given: false,
      }),
    ).rejects.toThrow('Customer consent is required');
  });

  it('should allow business owner to approve or reject a testimonial', async () => {
    const existing = new Testimonial();
    existing.id = 'testi-999';
    existing.business_id = 'bus-1';
    existing.approval_status = 'PENDING';

    jest.spyOn(Testimonial, 'findOne').mockResolvedValue(existing as any);
    jest.spyOn(existing, 'save').mockResolvedValue(existing as any);

    const approved = await service.UpdateStatus(
      'bus-1',
      'testi-999',
      { status: 'APPROVED' as any },
      'usr-owner-1',
    );

    expect(approved.approval_status).toBe('APPROVED');
    expect(approved.approved_at).toBeDefined();
    expect(approved.approved_by_id).toBe('usr-owner-1');
  });
});
