import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  const createService = async (cacheManagerMock: Record<string, unknown>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: cacheManagerMock,
        },
      ],
    }).compile();

    return module.get<CacheService>(CacheService);
  };

  it('clears using cacheManager.reset when available', async () => {
    const reset = jest.fn().mockResolvedValue(undefined);
    const clear = jest.fn().mockResolvedValue(undefined);
    const service = await createService({ reset, clear });

    await service.clear();

    expect(reset).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();
  });

  it('falls back to cacheManager.clear when reset is unavailable', async () => {
    const clear = jest.fn().mockResolvedValue(undefined);
    const service = await createService({ clear });

    await service.clear();

    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('uses store.clear when top-level methods are unavailable', async () => {
    const storeClear = jest.fn().mockResolvedValue(undefined);
    const service = await createService({
      store: {
        clear: storeClear,
      },
    });

    await service.clear();

    expect(storeClear).toHaveBeenCalledTimes(1);
  });

  it('clears every backend store in multi-store mode', async () => {
    const firstStoreReset = jest.fn().mockResolvedValue(undefined);
    const secondStoreClear = jest.fn().mockResolvedValue(undefined);

    const service = await createService({
      stores: [{ reset: firstStoreReset }, { clear: secondStoreClear }],
    });

    await service.clear();

    expect(firstStoreReset).toHaveBeenCalledTimes(1);
    expect(secondStoreClear).toHaveBeenCalledTimes(1);
  });
});
