import { CustomerService } from './customer.service';
import { Customer } from '../entities/customer.entity';

describe('CustomerService', () => {
  let service: CustomerService;

  beforeEach(() => {
    service = new CustomerService();
    jest.clearAllMocks();
  });

  it('should insert a customer with sanitized phone and tenant boundary', async () => {
    const mockSave = jest.fn().mockImplementation(function (this: any) {
      this.id = 'cust-123';
      return Promise.resolve(this);
    });
    jest.spyOn(Customer.prototype, 'save').mockImplementation(mockSave);

    const result = await service.Insert(
      'bus-tenant-1',
      {
        name: 'Rohan Sharma',
        phone: '+91 (987) 654-3210',
        email: 'rohan@example.com',
        tags: ['VIP'],
      },
      'usr-1',
    );

    expect(result.business_id).toBe('bus-tenant-1');
    expect(result.phone).toBe('+919876543210');
    expect(result.name).toBe('Rohan Sharma');
    expect(result.tags).toEqual(['VIP']);
  });

  it('should import CSV text accurately', async () => {
    const mockSave = jest.fn().mockImplementation(function (this: any) {
      this.id = 'cust-' + Math.random();
      return Promise.resolve(this);
    });
    jest.spyOn(Customer.prototype, 'save').mockImplementation(mockSave);

    const csvData = `name,phone,email,tags
Aarav Gupta,+919811223344,aarav@gmail.com,Regular;Haircut
Meera Nair,9877112233,meera@gmail.com,New`;

    const summary = await service.ImportCsvString('bus-tenant-1', csvData, 'usr-1');

    expect(summary.imported).toBe(2);
    expect(summary.skipped).toBe(0);
    expect(summary.errors.length).toBe(0);
  });
});
