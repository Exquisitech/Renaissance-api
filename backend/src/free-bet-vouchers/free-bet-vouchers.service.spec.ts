import { BadRequestException } from '@nestjs/common';
import { FreeBetVoucherService } from './free-bet-vouchers.service';
import { FreeBetVoucher } from './entities/free-bet-voucher.entity';

describe('FreeBetVoucherService', () => {
  const createService = () => {
    const voucherRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      softRemove: jest.fn(),
    };

    const dataSource = {
      manager: {},
      createQueryRunner: jest.fn(),
    };

    const service = new FreeBetVoucherService(
      voucherRepository as any,
      dataSource as any,
    );

    return { service, voucherRepository, dataSource };
  };

  it('creates standalone voucher without spin reference', async () => {
    const { service } = createService();

    const save = jest.fn(async (voucher) => voucher);
    const create = jest.fn((voucher) => voucher);

    const manager = {
      findOne: jest.fn().mockResolvedValue({ id: 'user-1' }),
      getRepository: jest.fn().mockReturnValue({
        create,
        save,
      }),
    };

    const result = await service.createVoucherWithManager(manager as any, {
      userId: 'user-1',
      amount: 20,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(manager.getRepository).toHaveBeenCalled();
    expect(result.metadata.sourceType).toBe('MANUAL');
    expect(result.metadata.sourceReferenceId).toBeUndefined();
    expect(result.metadata.usageCount).toBe(0);
  });

  it('tracks voucher usage metadata on consume', async () => {
    const { service } = createService();

    const voucher: Partial<FreeBetVoucher> = {
      id: 'voucher-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      used: false,
      metadata: {},
    };

    const manager = {
      findOne: jest.fn().mockResolvedValue(voucher),
      save: jest.fn(async (value) => value),
    };

    const result = await service.consumeVoucherWithManager(
      manager as any,
      'voucher-1',
      'user-1',
      'bet-1',
    );

    expect(result.used).toBe(true);
    expect(result.usedForBetId).toBe('bet-1');
    expect(result.metadata.usageCount).toBe(1);
    expect(result.metadata.lastUsedForBetId).toBe('bet-1');
    expect(Array.isArray(result.metadata.usageHistory)).toBe(true);
    expect(result.metadata.usageHistory).toHaveLength(1);
  });

  it('rejects expired voucher during validation', async () => {
    const { service, voucherRepository } = createService();

    voucherRepository.findOne.mockResolvedValue({
      id: 'voucher-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 1_000),
      used: false,
    });

    await expect(service.validateVoucher('voucher-1', 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
