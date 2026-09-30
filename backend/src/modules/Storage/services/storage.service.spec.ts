import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;
  let mockConfigService: any;
  let mockLogger: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'S3_REGION') return 'ap-south-1';
        return null;
      }),
    };
    mockLogger = {
      setContext: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    service = new StorageService(mockConfigService, mockLogger);
  });

  it('should upload a valid PNG base64 image and return a URL', async () => {
    // 8-byte PNG header: 89 50 4E 47 0D 0A 1A 0A followed by dummy data
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const base64Data = pngHeader.toString('base64');

    const result = await service.UploadBase64({
      data: `data:image/png;base64,${base64Data}`,
      filename: 'sample.png',
      category: 'photo',
    });

    expect(result.url).toBeDefined();
    expect(result.content_type).toBe('image/png');
    expect(result.key).toContain('photos/');
  });

  it('should reject file exceeding maximum size limit', async () => {
    // Fake large buffer of 6MB
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024);
    bigBuffer[0] = 0xff;
    bigBuffer[1] = 0xd8;
    bigBuffer[2] = 0xff;

    await expect(
      service.UploadBase64({
        data: bigBuffer.toString('base64'),
        filename: 'large.jpg',
        category: 'photo',
      }),
    ).rejects.toThrow('File size exceeds maximum allowed limit');
  });

  it('should reject file with unsupported format', async () => {
    // Executable / random text bytes
    const textBuffer = Buffer.from('plain text file not an image or video');

    await expect(
      service.UploadBase64({
        data: textBuffer.toString('base64'),
        filename: 'notes.txt',
        category: 'photo',
      }),
    ).rejects.toThrow('Invalid image format');
  });
});
