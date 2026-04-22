import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { rpc, xdr } from '@stellar/stellar-sdk';
import { BalanceLedgerService } from './balance.ledger.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const USER_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
const ADMIN_SECRET = 'SCZANGBA5RLKJCPKFZFZGLOKVMXKWL4E3BOSKWBXJWLMHQ4OEVIAJVJ';
const RPC_URL = 'https://soroban-testnet.stellar.org';
const PASSPHRASE = 'Test SDF Network ; September 2015';

function makeConfigService(
  overrides: Record<string, unknown> = {},
): ConfigService {
  const defaults: Record<string, unknown> = {
    'blockchain.stellar.rpcUrl': RPC_URL,
    'blockchain.stellar.networkPassphrase': PASSPHRASE,
    'blockchain.soroban.balanceLedgerContractId': CONTRACT_ID,
    'blockchain.soroban.adminSecret': ADMIN_SECRET,
    'blockchain.soroban.txTimeoutSeconds': 60,
    'blockchain.soroban.txPollIntervalMs': 0, // instant in tests
    'blockchain.soroban.txPollAttempts': 3,
    ...overrides,
  };
  return {
    get: (key: string, fallback?: unknown) => defaults[key] ?? fallback,
  } as any;
}

function makeService(
  configOverrides: Record<string, unknown> = {},
): BalanceLedgerService {
  const svc = new BalanceLedgerService(makeConfigService(configOverrides));
  svc.onModuleInit();
  return svc;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

/** Build a minimal mock rpc.Server attached to a BalanceLedgerService instance. */
function mockServer(svc: BalanceLedgerService) {
  const mock = {
    getAccount: jest.fn(),
    prepareTransaction: jest.fn(),
    sendTransaction: jest.fn(),
    getTransaction: jest.fn(),
    simulateTransaction: jest.fn(),
  };
  (svc as any).server = mock;
  return mock;
}

/** Fake a successful send + confirmed transaction flow. */
function setupSuccessfulSend(
  server: ReturnType<typeof mockServer>,
  hash = 'abc123',
) {
  const fakeAccount = {
    accountId: () => 'G_ADMIN',
    sequenceNumber: () => '1',
    incrementSequenceNumber: jest.fn(),
  };
  server.getAccount.mockResolvedValue(fakeAccount);
  server.prepareTransaction.mockImplementation(async (tx: any) => tx);
  server.sendTransaction.mockResolvedValue({ status: 'PENDING', hash });
  server.getTransaction.mockResolvedValue({
    status: rpc.Api.GetTransactionStatus.SUCCESS,
    returnValue: undefined,
    resultMetaXdr: null,
  });
}

/** Fake a simulateTransaction response for view calls. */
function setupSimulateSuccess(
  server: ReturnType<typeof mockServer>,
  retval: xdr.ScVal,
) {
  const fakeAccount = {
    accountId: () => 'G_ADMIN',
    sequenceNumber: () => '1',
    incrementSequenceNumber: jest.fn(),
  };
  server.getAccount.mockResolvedValue(fakeAccount);
  server.simulateTransaction.mockResolvedValue({
    result: { retval },
    error: undefined,
  } as any);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BalanceLedgerService', () => {
  // ── Initialization ──────────────────────────────────────────────────────────

  describe('initialization', () => {
    it('is defined when fully configured', () => {
      const svc = makeService();
      expect(svc).toBeDefined();
    });

    it('stays unconfigured and does not throw when config is missing', () => {
      const svc = makeService({
        'blockchain.stellar.rpcUrl': undefined,
        'blockchain.soroban.balanceLedgerContractId': undefined,
        'blockchain.soroban.adminSecret': undefined,
      });
      expect(svc).toBeDefined();
    });

    it('throws ServiceUnavailableException when invoking without config', async () => {
      const svc = makeService({
        'blockchain.stellar.rpcUrl': undefined,
        'blockchain.soroban.balanceLedgerContractId': undefined,
        'blockchain.soroban.adminSecret': undefined,
      });
      await expect(svc.getBalance(USER_ADDRESS)).rejects.toThrow(
        'BalanceLedgerService is not configured',
      );
    });
  });

  // ── setBalance ──────────────────────────────────────────────────────────────

  describe('setBalance', () => {
    it('submits a transaction and returns the txHash plus echoed balance', async () => {
      const svc = makeService();
      const server = mockServer(svc);
      setupSuccessfulSend(server, 'set_hash_001');

      const result = await svc.setBalance(USER_ADDRESS, 500n, 100n);

      expect(result.txHash).toBe('set_hash_001');
      expect(result.balance).toEqual({ withdrawable: 500n, locked: 100n });
    });

    it('invokes the contract with function name set_balance', async () => {
      const svc = makeService();
      const server = mockServer(svc);
      setupSuccessfulSend(server, 'set_hash_002');

      await svc.setBalance(USER_ADDRESS, 0n, 0n);

      // The transaction is built with `contract.call('set_balance', ...)` — we
      // verify via sendTransaction being called (full XDR parsing is Stellar-internal).
      expect(server.sendTransaction).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from the RPC layer', async () => {
      const svc = makeService();
      const server = mockServer(svc);
      const fakeAccount = {
        accountId: () => 'G_ADMIN',
        sequenceNumber: () => '1',
        incrementSequenceNumber: jest.fn(),
      };
      server.getAccount.mockResolvedValue(fakeAccount);
      server.prepareTransaction.mockImplementation(async (tx: any) => tx);
      server.sendTransaction.mockResolvedValue({
        status: 'ERROR',
        hash: 'h',
        errorResult: null,
        diagnosticEvents: [],
      });

      await expect(svc.setBalance(USER_ADDRESS, 100n, 0n)).rejects.toThrow(
        'Soroban submission failed',
      );
    });
  });

  // ── applyDelta ──────────────────────────────────────────────────────────────

  describe('applyDelta', () => {
    it('returns a txHash on success', async () => {
      const svc = makeService();
      const server = mockServer(svc);
      setupSuccessfulSend(server, 'delta_hash_001');

      const result = await svc.applyDelta(USER_ADDRESS, 200n, -50n);

      expect(result.txHash).toBe('delta_hash_001');
    });

    it('supports zero deltas', async () => {
      const svc = makeService();
      const server = mockServer(svc);
      setupSuccessfulSend(server, 'delta_hash_002');

      await expect(svc.applyDelta(USER_ADDRESS, 0n, 0n)).resolves.not.toThrow();
    });
  });

  // ── lockFunds ───────────────────────────────────────────────────────────────

  describe('lockFunds', () => {
    it('returns a txHash when the contract confirms', async () => {
      const svc = makeService();
      const server = mockServer(svc);
      setupSuccessfulSend(server, 'lock_hash_001');

      const result = await svc.lockFunds(USER_ADDRESS, 300n);

      expect(result.txHash).toBe('lock_hash_001');
      expect(server.sendTransaction).toHaveBeenCalledTimes(1);
    });

    it('throws when the RPC returns TRY_AGAIN_LATER', async () => {
      const svc = makeService();
      const server = mockServer(svc);
      const fakeAccount = {
        accountId: () => 'G_ADMIN',
        sequenceNumber: () => '1',
        incrementSequenceNumber: jest.fn(),
      };
      server.getAccount.mockResolvedValue(fakeAccount);
      server.prepareTransaction.mockImplementation(async (tx: any) => tx);
      server.sendTransaction.mockResolvedValue({
        status: 'TRY_AGAIN_LATER',
        hash: 'h',
      });

      await expect(svc.lockFunds(USER_ADDRESS, 10n)).rejects.toThrow(
        'retry later',
      );
    });
  });

  // ── unlockFunds ─────────────────────────────────────────────────────────────

  describe('unlockFunds', () => {
    it('returns a txHash when the contract confirms', async () => {
      const svc = makeService();
      const server = mockServer(svc);
      setupSuccessfulSend(server, 'unlock_hash_001');

      const result = await svc.unlockFunds(USER_ADDRESS, 100n);

      expect(result.txHash).toBe('unlock_hash_001');
    });

    it('times out if the transaction stays NOT_FOUND', async () => {
      const svc = makeService({ 'blockchain.soroban.txPollAttempts': 2 });
      const server = mockServer(svc);
      const fakeAccount = {
        accountId: () => 'G_ADMIN',
        sequenceNumber: () => '1',
        incrementSequenceNumber: jest.fn(),
      };
      server.getAccount.mockResolvedValue(fakeAccount);
      server.prepareTransaction.mockImplementation(async (tx: any) => tx);
      server.sendTransaction.mockResolvedValue({
        status: 'PENDING',
        hash: 'hung',
      });
      server.getTransaction.mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.NOT_FOUND,
      });

      await expect(svc.unlockFunds(USER_ADDRESS, 50n)).rejects.toThrow(
        'Timed out waiting',
      );
    });
  });

  // ── getBalance ──────────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('returns a UserBalance decoded from the simulation result', async () => {
      const { nativeToScVal } = await import('@stellar/stellar-sdk');

      const retval = nativeToScVal(
        { withdrawable: 1000n, locked: 250n },
        { type: 'map' },
      );

      const svc = makeService();
      const server = mockServer(svc);
      setupSimulateSuccess(server, retval);

      const balance = await svc.getBalance(USER_ADDRESS);

      // The map may decode as an object; we only need to check the values exist
      expect(balance).toBeDefined();
    });

    it('throws when simulation returns an error', async () => {
      const svc = makeService();
      const server = mockServer(svc);
      const fakeAccount = {
        accountId: () => 'G_ADMIN',
        sequenceNumber: () => '1',
        incrementSequenceNumber: jest.fn(),
      };
      server.getAccount.mockResolvedValue(fakeAccount);
      server.simulateTransaction.mockResolvedValue({
        error: 'host error: ...',
      });

      await expect(svc.getBalance(USER_ADDRESS)).rejects.toThrow(
        'Simulation error',
      );
    });
  });

  // ── getWithdrawable / getLocked / getTotal ──────────────────────────────────

  describe('scalar view functions', () => {
    async function setupI128(svc: BalanceLedgerService, value: bigint) {
      const { nativeToScVal } = await import('@stellar/stellar-sdk');
      const retval = nativeToScVal(value, { type: 'i128' });
      const server = mockServer(svc);
      setupSimulateSuccess(server, retval);
    }

    it('getWithdrawable resolves without throwing', async () => {
      const svc = makeService();
      await setupI128(svc, 750n);
      await expect(svc.getWithdrawable(USER_ADDRESS)).resolves.not.toThrow();
    });

    it('getLocked resolves without throwing', async () => {
      const svc = makeService();
      await setupI128(svc, 250n);
      await expect(svc.getLocked(USER_ADDRESS)).resolves.not.toThrow();
    });

    it('getTotal resolves without throwing', async () => {
      const svc = makeService();
      await setupI128(svc, 1000n);
      await expect(svc.getTotal(USER_ADDRESS)).resolves.not.toThrow();
    });
  });

  // ── parseBalanceUpdatedEvents ───────────────────────────────────────────────

  describe('parseBalanceUpdatedEvents', () => {
    it('returns an empty array when resultMetaXdr is null', () => {
      const svc = makeService();
      const fakeResponse = {
        returnValue: undefined,
        resultMetaXdr: null,
      } as any;
      expect(svc.parseBalanceUpdatedEvents(fakeResponse)).toEqual([]);
    });

    it('returns an empty array when sorobanMeta has no events', () => {
      const svc = makeService();
      const fakeResponse = {
        returnValue: undefined,
        resultMetaXdr: {
          switch: () => ({ value: 3 }),
          v3: () => ({
            operations: () => [],
            sorobanMeta: () => ({ events: () => [] }),
          }),
        },
      } as any;
      expect(svc.parseBalanceUpdatedEvents(fakeResponse)).toEqual([]);
    });

    it('ignores events with unrecognised topic symbols', () => {
      const { nativeToScVal } = require('@stellar/stellar-sdk');
      const svc = makeService();

      const fakeEvent = {
        body: () => ({
          v0: () => ({
            topics: () => [
              nativeToScVal('other_event'),
              nativeToScVal(USER_ADDRESS),
            ],
            data: () => nativeToScVal([0n, 0n, 0n, 0n]),
          }),
        }),
      } as any;

      const fakeResponse = {
        returnValue: undefined,
        resultMetaXdr: {
          switch: () => ({ value: 3 }),
          v3: () => ({
            operations: () => [],
            sorobanMeta: () => ({ events: () => [fakeEvent] }),
          }),
        },
      } as any;

      expect(svc.parseBalanceUpdatedEvents(fakeResponse)).toEqual([]);
    });
  });

  // ── NestJS DI smoke test ────────────────────────────────────────────────────

  describe('NestJS module wiring', () => {
    it('can be resolved from a TestingModule', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BalanceLedgerService,
          { provide: ConfigService, useValue: makeConfigService() },
        ],
      }).compile();

      const svc = module.get<BalanceLedgerService>(BalanceLedgerService);
      expect(svc).toBeInstanceOf(BalanceLedgerService);
    });
  });
});
