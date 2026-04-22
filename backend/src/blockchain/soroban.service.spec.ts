import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SorobanService } from './soroban.service';

const mockOperation = { id: 'mock-operation' };
const mockBuiltTransaction = { sign: jest.fn() };
const mockPreparedTransaction = { sign: jest.fn() };
const mockServer = {
  getAccount: jest.fn(),
  prepareTransaction: jest.fn(),
  sendTransaction: jest.fn(),
  getTransaction: jest.fn(),
};
const mockContractCall = jest.fn();
const mockTransactionBuilder = {
  addOperation: jest.fn().mockReturnThis(),
  setTimeout: jest.fn().mockReturnThis(),
  build: jest.fn().mockReturnValue(mockBuiltTransaction),
};

jest.mock('@stellar/stellar-sdk', () => ({
  rpc: {
    Server: jest.fn().mockImplementation(() => mockServer),
    Api: {
      GetTransactionStatus: {
        SUCCESS: 'SUCCESS',
        FAILED: 'FAILED',
        NOT_FOUND: 'NOT_FOUND',
      },
    },
  },
  Address: jest.fn().mockImplementation((value) => ({
    toScVal: () => ({ address: value }),
  })),
  Contract: jest.fn().mockImplementation(() => ({
    call: mockContractCall,
  })),
  Keypair: {
    fromSecret: jest.fn().mockReturnValue({
      publicKey: () => 'MOCK_PUBLIC_KEY',
    }),
  },
  nativeToScVal: jest.fn((value) => ({ scVal: value })),
  scValToNative: jest.fn(() => 'ok'),
  StrKey: {
    isValidEd25519PublicKey: jest.fn(() => false),
    isValidContract: jest.fn(() => false),
  },
  TransactionBuilder: jest.fn().mockImplementation(() => mockTransactionBuilder),
}));

describe('SorobanService', () => {
  let service: SorobanService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockContractCall.mockReturnValue(mockOperation);
    mockServer.getAccount.mockResolvedValue({ sequence: '1' });
    mockServer.prepareTransaction.mockResolvedValue(mockPreparedTransaction);
    mockServer.sendTransaction.mockResolvedValue({
      status: 'PENDING',
      hash: 'tx_hash_123',
      latestLedger: 100,
      latestLedgerCloseTime: 100,
    });
    mockServer.getTransaction.mockResolvedValue({
      status: 'SUCCESS',
      txHash: 'tx_hash_123',
      latestLedger: 100,
      latestLedgerCloseTime: 100,
      oldestLedger: 90,
      oldestLedgerCloseTime: 90,
      ledger: 100,
      createdAt: 100,
      applicationOrder: 1,
      feeBump: false,
      envelopeXdr: { toXDR: jest.fn() },
      resultXdr: { toXDR: jest.fn() },
      resultMetaXdr: { toXDR: jest.fn() },
      events: { transactionEventsXdr: [], contractEventsXdr: [] },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key, defaultValue) => {
              if (key === 'blockchain.stellar.rpcUrl') return 'https://mock-rpc';
              if (key === 'blockchain.stellar.networkPassphrase') {
                return 'Test SDF Network ; September 2015';
              }
              if (key === 'blockchain.soroban.contractId') return 'C_MOCK';
              if (key === 'blockchain.soroban.adminSecret') return 'S_SECRET';
              return defaultValue ?? null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SorobanService>(SorobanService);
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should invoke a contract and return the submitted tx hash', async () => {
    const txHash = await service.invokeContract('settle', [
      'betId',
      'outcome',
      100,
    ]);

    expect(txHash).toBe('tx_hash_123');
    expect(mockServer.getAccount).toHaveBeenCalledWith('MOCK_PUBLIC_KEY');
    expect(mockServer.prepareTransaction).toHaveBeenCalledWith(
      mockBuiltTransaction,
    );
    expect(mockPreparedTransaction.sign).toHaveBeenCalled();
    expect(mockServer.sendTransaction).toHaveBeenCalledWith(
      mockPreparedTransaction,
    );
    expect(mockServer.getTransaction).toHaveBeenCalledWith('tx_hash_123');
    expect(mockContractCall).toHaveBeenCalled();
  });

  it('should expose transaction status lookup', async () => {
    const status = await service.getTransactionStatus('tx_hash_123');
    expect(status.status).toBe('SUCCESS');
    expect(mockServer.getTransaction).toHaveBeenCalledWith('tx_hash_123');
  });
});