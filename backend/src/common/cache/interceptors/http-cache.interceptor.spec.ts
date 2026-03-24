import { Test, TestingModule } from '@nestjs/testing';
import { HttpCacheInterceptor } from './http-cache.interceptor';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { NO_CACHE_METADATA } from '../decorators/no-cache.decorator';
import { CACHE_KEY_METADATA } from '../decorators/cache-key.decorator';

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockReflector = {
  get: jest.fn(),
};

const mockExecutionContext = {
  getHandler: jest.fn(),
  switchToHttp: jest.fn().mockReturnValue({
    getRequest: jest.fn(),
  }),
};

const mockHttpAdapterHost = {
  httpAdapter: {
    getRequestMethod: jest.fn(),
    getRequestUrl: jest.fn(),
  },
};

describe('HttpCacheInterceptor', () => {
  let interceptor: HttpCacheInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpCacheInterceptor,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    interceptor = module.get<HttpCacheInterceptor>(HttpCacheInterceptor);
    (interceptor as any).httpAdapterHost = mockHttpAdapterHost;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('trackBy', () => {
    it('should return undefined if NoCache decorator is present', () => {
      mockReflector.get.mockReturnValueOnce(true); // NO_CACHE_METADATA

      const result = interceptor['trackBy'](
        mockExecutionContext as unknown as ExecutionContext,
      );

      expect(result).toBeUndefined();
      expect(mockReflector.get).toHaveBeenCalledWith(
        NO_CACHE_METADATA,
        mockExecutionContext.getHandler(),
      );
    });

    it('should return undefined if not a GET request', () => {
      mockReflector.get.mockReturnValueOnce(undefined); // NO_CACHE_METADATA
      mockHttpAdapterHost.httpAdapter.getRequestMethod.mockReturnValue('POST');

      const result = interceptor['trackBy'](
        mockExecutionContext as unknown as ExecutionContext,
      );

      expect(result).toBeUndefined();
    });

    it('should return url if no CacheKey decorator', () => {
      mockReflector.get.mockReturnValueOnce(undefined); // NO_CACHE_METADATA
      mockHttpAdapterHost.httpAdapter.getRequestMethod.mockReturnValue('GET');
      mockHttpAdapterHost.httpAdapter.getRequestUrl.mockReturnValue(
        '/test-url',
      );
      mockReflector.get.mockReturnValueOnce(undefined); // CACHE_KEY_METADATA

      const result = interceptor['trackBy'](
        mockExecutionContext as unknown as ExecutionContext,
      );

      expect(result).toBe('/test-url');
    });

    it('should return custom key combined with url if CacheKey decorator is present', () => {
      mockReflector.get.mockReturnValueOnce(undefined); // NO_CACHE_METADATA
      mockHttpAdapterHost.httpAdapter.getRequestMethod.mockReturnValue('GET');
      mockHttpAdapterHost.httpAdapter.getRequestUrl.mockReturnValue(
        '/test-url',
      );
      mockReflector.get.mockReturnValueOnce('custom-key'); // CACHE_KEY_METADATA

      const result = interceptor['trackBy'](
        mockExecutionContext as unknown as ExecutionContext,
      );

      expect(result).toBe('custom-key-/test-url');
    });
  });
});
