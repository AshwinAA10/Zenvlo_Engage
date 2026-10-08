import { AuthService } from './auth.service';
import { User } from '../../User/entities/user.entity';
import { Business } from '../../Business/entities/business.entity';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let mockJwtService: any;
  let mockEventEmitter: any;
  let mockBusinessService: any;

  beforeEach(() => {
    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock_jwt_token_123'),
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };
    mockBusinessService = {
      InsertOnboarding: jest.fn(),
    };

    service = new AuthService(
      mockJwtService,
      mockEventEmitter,
      mockBusinessService,
    );

    jest.clearAllMocks();
  });

  it('should register a new user and create business if provided', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);
    jest.spyOn(User.prototype, 'save').mockImplementation(function (this: any) {
      this.id = 'usr-new-1';
      return Promise.resolve(this);
    });

    mockBusinessService.InsertOnboarding.mockResolvedValue({
      id: 'bus-new-1',
      name: 'Dr. Rao Dental Clinic',
      slug: 'dr-rao-dental-clinic',
      category: 'Clinic',
      logo_url: null,
    });

    const result = await service.Signup({
      email: 'dr.rao@clinic.com',
      password: 'SecurePassword123!',
      first_name: 'Anand',
      last_name: 'Rao',
      business_name: 'Dr. Rao Dental Clinic',
    });

    expect(result.access_token).toBe('mock_jwt_token_123');
    expect(result.user.email).toBe('dr.rao@clinic.com');
    expect(result.business?.name).toBe('Dr. Rao Dental Clinic');
    expect(mockJwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'usr-new-1',
        email: 'dr.rao@clinic.com',
        business_id: 'bus-new-1',
        token_version: 1,
      }),
      expect.any(Object),
    );
  });

  it('should throw ConflictException if email is already taken', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue({ id: 'existing-usr' } as any);

    await expect(
      service.Signup({
        email: 'dr.rao@clinic.com',
        password: 'Password123!',
      }),
    ).rejects.toThrow('An account with this email address already exists');
  });
});
