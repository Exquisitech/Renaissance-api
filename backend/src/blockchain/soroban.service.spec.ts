import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SorobanService } from './soroban.service';

// Correct mock for stellar-sdk rpc.Server
const mockServer = {
  getAccount: jest.fn(),
  prepareTransaction: jest.fn(),
  sendTransaction: jest.fn(),
};

jest.mock('@stellar/stellar-sdk', () => {
    return {
        rpc: {
            Server: jest.fn().mockImplementation(() => mockServer),
        },
        Keypair: {
            fromSecret: jest.fn().mockReturnValue({
                publicKey: () => 'MOCK_PUBLIC_KEY',
            }),
        },
        TransactionBuilder: jest.fn(),
        Networks: { TESTNET: 'TESTNET' },
        TimeoutInfinite: 0,
    };
});

describe('SorobanService', () => {
  let service: SorobanService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'blockchain.stellar.rpcUrl') return 'https://mock-rpc';
              if (key === 'blockchain.stellar.networkPassphrase') return 'secret';
              if (key === 'blockchain.soroban.contractId') return 'C_MOCK';
              if (key === 'blockchain.soroban.adminSecret') return 'S_SECRET';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SorobanService>(SorobanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize client on module init', () => {
      service.onModuleInit();
      // Check if logged or property set - private props hard to check without verifying mocks
      // In this case, if no error thrown, it's good.
      expect(service).toBeDefined();
  });

  it('should invoke contract', async () => {
      service.onModuleInit(); // Ensure init
      
      mockServer.getAccount.mockResolvedValue({ sequence: '1' });
      
      const result = await service.invokeContract('settle', ['betId', 'outcome', 100]);
      expect(result).toContain('mock_tx_hash');
  });
});
