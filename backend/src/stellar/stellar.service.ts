/**
 * stellar_service.ts
 * Wallet connections, transaction building, contract calls, event listening.
 * Targets Stellar Testnet / Mainnet with Soroban smart contracts.
 */

import {
  Keypair,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  Contract,
  nativeToScVal,
  scValToNative,
  Address,
  Operation,
  Asset,
  Memo,
  TimeoutInfinite,
  Transaction,
} from '@stellar/stellar-sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NetworkType = 'testnet' | 'mainnet';

export interface StellarConfig {
  network: NetworkType;
  rpcUrl?: string; // override default RPC
  contractId: string; // Spin-to-Win contract address
  spinTokenId: string; // Token contract address for spin cost
}

export interface WalletConnection {
  publicKey: string;
  network: NetworkType;
  connected: boolean;
}

export interface SpinResult {
  spinId: bigint;
  player: string;
  prizeId: number;
  prizeName: string;
  amountWon: bigint;
  timestamp: bigint;
  seedUsed: bigint;
}

export interface PlayerStats {
  totalSpins: bigint;
  totalWon: bigint;
  lastSpinTimestamp: bigint;
}

export interface Prize {
  id: number;
  name: string;
  tokenAddress: string;
  amount: bigint;
  weight: number;
  isJackpot: boolean;
}

export interface ContractEvent {
  type: string;
  contractId: string;
  topics: unknown[];
  value: unknown;
  ledger: number;
  timestamp?: number;
}

export interface TxResult {
  success: boolean;
  hash: string;
  returnValue?: unknown;
  error?: string;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const NETWORK_CONFIG: Record<
  NetworkType,
  { rpcUrl: string; passphrase: string }
> = {
  testnet: {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    passphrase: Networks.TESTNET,
  },
  mainnet: {
    rpcUrl: 'https://soroban-mainnet.stellar.org',
    passphrase: Networks.PUBLIC,
  },
};

const DEFAULT_TX_FEE = '500000'; // 0.05 XLM in stroops (higher for Soroban)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 30_000;

// ─── Utility ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function addressToScVal(address: string): xdr.ScVal {
  return nativeToScVal(Address.fromString(address), { type: 'address' });
}

function u64ToScVal(n: bigint): xdr.ScVal {
  return nativeToScVal(n, { type: 'u64' });
}

function i128ToScVal(n: bigint): xdr.ScVal {
  return nativeToScVal(n, { type: 'i128' });
}

// ─── StellarService class ────────────────────────────────────────────────────

export class StellarService {
  private server: SorobanRpc.Server;
  private config: StellarConfig;
  private networkPassphrase: string;
  private rpcUrl: string;

  // In-memory wallet state (replace with Freighter / hardware wallet adapter as needed)
  private connectedKeypair: Keypair | null = null;

  // Event listener subscriptions
  private eventPollers: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(config: StellarConfig) {
    this.config = config;
    const net = NETWORK_CONFIG[config.network];
    this.rpcUrl = config.rpcUrl ?? net.rpcUrl;
    this.networkPassphrase = net.passphrase;
    this.server = new SorobanRpc.Server(this.rpcUrl, { allowHttp: false });
  }

  // ── Wallet connection ──────────────────────────────────────────────────────

  /**
   * Connect using a raw secret key (for server-side / testing).
   * For browser use, integrate Freighter: see connectFreighter() below.
   */
  connectWithSecret(secretKey: string): WalletConnection {
    try {
      this.connectedKeypair = Keypair.fromSecret(secretKey);
      return {
        publicKey: this.connectedKeypair.publicKey(),
        network: this.config.network,
        connected: true,
      };
    } catch (err) {
      throw new StellarServiceError('Invalid secret key', err);
    }
  }

  /**
   * Connect via Freighter browser extension.
   * Call this in a browser context; ensure @stellar/freighter-api is installed.
   */
  async connectFreighter(): Promise<WalletConnection> {
    try {
      // Dynamic import so non-browser builds don't break
      const freighter = await import('@stellar/freighter-api');

      const isConnected = await freighter.isConnected();
      if (!isConnected) {
        await freighter.requestAccess();
      }

      const { publicKey } = await freighter.getPublicKey();
      if (!publicKey) throw new Error('Freighter returned no public key');

      // Store public key for read operations; signing will go through Freighter
      this.connectedKeypair = null; // no secret available in browser
      return {
        publicKey,
        network: this.config.network,
        connected: true,
      };
    } catch (err) {
      throw new StellarServiceError('Freighter connection failed', err);
    }
  }

  disconnect(): void {
    this.connectedKeypair = null;
    this.stopAllEventListeners();
  }

  isConnected(): boolean {
    return this.connectedKeypair !== null;
  }

  getPublicKey(): string {
    if (!this.connectedKeypair) throw new StellarServiceError('Not connected');
    return this.connectedKeypair.publicKey();
  }

  // ── Account queries ────────────────────────────────────────────────────────

  async getAccountBalance(publicKey: string): Promise<Record<string, string>> {
    const account = await this.server.getAccount(publicKey);
    const balances: Record<string, string> = {};
    for (const b of account.balances) {
      const key =
        b.asset_type === 'native'
          ? 'XLM'
          : `${(b as { asset_code: string }).asset_code}:${(b as { asset_issuer: string }).asset_issuer}`;
      balances[key] = b.balance;
    }
    return balances;
  }

  async getContractBalance(): Promise<bigint> {
    const result = await this.callContractReadOnly('get_contract_balance', []);
    return result as bigint;
  }

  // ── Transaction building ───────────────────────────────────────────────────

  private async buildTransaction(
    sourcePublicKey: string,
    operation: xdr.Operation,
    memo?: Memo,
  ): Promise<Transaction> {
    const account = await this.server.getAccount(sourcePublicKey);

    const builder = new TransactionBuilder(account, {
      fee: DEFAULT_TX_FEE,
      networkPassphrase: this.networkPassphrase,
    });

    builder.addOperation(operation);

    if (memo) builder.addMemo(memo);

    builder.setTimeout(TimeoutInfinite);

    const tx = builder.build();

    // Simulate to get resource fees and footprint
    const simResult = await this.server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new StellarServiceError(`Simulation failed: ${simResult.error}`);
    }

    // Assemble with resource data
    const assembled = SorobanRpc.assembleTransaction(tx, simResult).build();
    return assembled;
  }

  // ── Signature handling ─────────────────────────────────────────────────────

  private signTransaction(tx: Transaction): Transaction {
    if (!this.connectedKeypair) {
      throw new StellarServiceError(
        'No keypair — use signWithFreighter for browser wallets',
      );
    }
    tx.sign(this.connectedKeypair);
    return tx;
  }

  /**
   * Sign a transaction via Freighter (browser only).
   * Returns the signed XDR string.
   */
  async signWithFreighter(txXdr: string): Promise<string> {
    const freighter = await import('@stellar/freighter-api');
    const { signedTxXdr } = await freighter.signTransaction(txXdr, {
      network: this.config.network === 'mainnet' ? 'MAINNET' : 'TESTNET',
    });
    return signedTxXdr;
  }

  // ── Transaction submission ─────────────────────────────────────────────────

  private async submitAndWait(
    tx: Transaction,
    retries = MAX_RETRIES,
  ): Promise<TxResult> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const sendResponse = await this.server.sendTransaction(tx);

        if (sendResponse.status === 'ERROR') {
          const errMsg =
            sendResponse.errorResult?.result().toXDR('base64') ??
            'Unknown error';
          throw new StellarServiceError(`Transaction rejected: ${errMsg}`);
        }

        // Poll for confirmation
        const hash = sendResponse.hash;
        const result = await this.pollTransaction(hash);
        return result;
      } catch (err) {
        if (attempt === retries) throw err;
        console.warn(
          `Attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms…`,
          err,
        );
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
    throw new StellarServiceError('Max retries exceeded');
  }

  private async pollTransaction(hash: string): Promise<TxResult> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const response = await this.server.getTransaction(hash);

      if (response.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        const returnValue = response.returnValue
          ? scValToNative(response.returnValue)
          : undefined;
        return { success: true, hash, returnValue };
      }

      if (response.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        return {
          success: false,
          hash,
          error: `Transaction failed: ${response.resultXdr}`,
        };
      }

      await sleep(POLL_INTERVAL_MS);
    }

    return { success: false, hash, error: 'Transaction confirmation timeout' };
  }

  // ── Contract calls ────────────────────────────────────────────────────────

  /** Execute a state-changing contract function */
  async callContract(
    functionName: string,
    args: xdr.ScVal[],
    callerPublicKey?: string,
  ): Promise<TxResult> {
    const publicKey = callerPublicKey ?? this.getPublicKey();
    const contract = new Contract(this.config.contractId);

    const operation = contract.call(functionName, ...args);
    const tx = await this.buildTransaction(
      publicKey,
      operation as unknown as xdr.Operation,
    );

    const signed = this.signTransaction(tx);
    return this.submitAndWait(signed);
  }

  /** Simulate a read-only contract call (no fee, no signing) */
  async callContractReadOnly(
    functionName: string,
    args: xdr.ScVal[],
  ): Promise<unknown> {
    // Use a random source account for simulation
    const dummyKeypair = Keypair.random();
    const contract = new Contract(this.config.contractId);

    // We need a funded account for simulation; use a known horizon account trick
    // or fall back to direct RPC ledger reads for view functions
    const account = await this.server
      .getAccount(dummyKeypair.publicKey())
      .catch(() => {
        // If dummy account not found, create a minimal account object
        return {
          accountId: () => dummyKeypair.publicKey(),
          sequenceNumber: () => '0',
          incrementSequenceNumber: () => {},
        } as ReturnType<typeof this.server.getAccount> extends Promise<infer A>
          ? A
          : never;
      });

    const builder = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    });

    builder.addOperation(
      contract.call(functionName, ...args) as unknown as xdr.Operation,
    );
    builder.setTimeout(TimeoutInfinite);

    const tx = builder.build();
    const simResult = await this.server.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new StellarServiceError(`Simulation error: ${simResult.error}`);
    }

    const simSuccess =
      simResult as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    if (!simSuccess.result) return undefined;

    return scValToNative(simSuccess.result.retval);
  }

  // ── Spin-to-Win specific methods ──────────────────────────────────────────

  /** Execute a spin */
  async spin(playerPublicKey: string): Promise<SpinResult> {
    const args = [addressToScVal(playerPublicKey)];
    const result = await this.callContract('spin', args, playerPublicKey);

    if (!result.success) {
      throw new StellarServiceError(`Spin failed: ${result.error}`);
    }

    return this.parseSpinResult(result.returnValue as Record<string, unknown>);
  }

  /** Get prizes list */
  async getPrizes(): Promise<Prize[]> {
    const raw = (await this.callContractReadOnly(
      'get_prizes',
      [],
    )) as unknown[];
    return raw.map(this.parsePrize);
  }

  /** Get player stats */
  async getPlayerStats(playerPublicKey: string): Promise<PlayerStats> {
    const args = [addressToScVal(playerPublicKey)];
    const raw = (await this.callContractReadOnly(
      'get_player_stats',
      args,
    )) as Record<string, unknown>;
    return {
      totalSpins: BigInt(raw['total_spins'] as string),
      totalWon: BigInt(raw['total_won'] as string),
      lastSpinTimestamp: BigInt(raw['last_spin_timestamp'] as string),
    };
  }

  /** Get spin history */
  async getSpinHistory(): Promise<SpinResult[]> {
    const raw = (await this.callContractReadOnly(
      'get_spin_history',
      [],
    )) as unknown[];
    return raw.map((r) => this.parseSpinResult(r as Record<string, unknown>));
  }

  /** Admin: add prize */
  async addPrize(
    adminPublicKey: string,
    name: string,
    tokenAddress: string,
    amount: bigint,
    weight: number,
    isJackpot: boolean,
  ): Promise<TxResult> {
    const args = [
      nativeToScVal(name, { type: 'symbol' }),
      addressToScVal(tokenAddress),
      i128ToScVal(amount),
      nativeToScVal(weight, { type: 'u32' }),
      nativeToScVal(isJackpot, { type: 'bool' }),
    ];
    return this.callContract('add_prize', args, adminPublicKey);
  }

  /** Admin: set paused */
  async setPaused(adminPublicKey: string, paused: boolean): Promise<TxResult> {
    const args = [nativeToScVal(paused, { type: 'bool' })];
    return this.callContract('set_paused', args, adminPublicKey);
  }

  /** Admin: withdraw fees */
  async adminWithdraw(
    adminPublicKey: string,
    amount: bigint,
    toAddress: string,
  ): Promise<TxResult> {
    const args = [i128ToScVal(amount), addressToScVal(toAddress)];
    return this.callContract('admin_withdraw', args, adminPublicKey);
  }

  // ── Token operations ──────────────────────────────────────────────────────

  /** Approve spin token allowance so the contract can deduct spin cost */
  async approveSpinCost(
    playerPublicKey: string,
    amount: bigint,
    expirationLedger: number,
  ): Promise<TxResult> {
    const tokenContract = new Contract(this.config.spinTokenId);
    const args = [
      addressToScVal(playerPublicKey),
      addressToScVal(this.config.contractId),
      i128ToScVal(amount),
      nativeToScVal(expirationLedger, { type: 'u32' }),
    ];
    const operation = tokenContract.call('approve', ...args);
    const tx = await this.buildTransaction(
      playerPublicKey,
      operation as unknown as xdr.Operation,
    );
    const signed = this.signTransaction(tx);
    return this.submitAndWait(signed);
  }

  // ── Event listening ───────────────────────────────────────────────────────

  /**
   * Subscribe to contract events, polling the RPC at the given interval.
   * Returns an unsubscribe function.
   */
  subscribeToEvents(
    startLedger: number,
    onEvent: (event: ContractEvent) => void,
    onError?: (err: unknown) => void,
  ): () => void {
    const id = this.config.contractId;
    let lastLedger = startLedger;

    const poller = setInterval(async () => {
      try {
        const response = await this.server.getEvents({
          startLedger: lastLedger,
          filters: [
            {
              type: 'contract',
              contractIds: [id],
            },
          ],
          limit: 100,
        });

        for (const event of response.events) {
          const parsed: ContractEvent = {
            type: 'contract',
            contractId: event.contractId,
            topics: event.topic.map(scValToNative),
            value: scValToNative(event.value),
            ledger: event.ledger,
          };
          onEvent(parsed);
          lastLedger = Math.max(lastLedger, event.ledger + 1);
        }
      } catch (err) {
        onError?.(err);
      }
    }, POLL_INTERVAL_MS * 3);

    this.eventPollers.set(id, poller);

    return () => {
      clearInterval(poller);
      this.eventPollers.delete(id);
    };
  }

  stopAllEventListeners(): void {
    for (const poller of this.eventPollers.values()) clearInterval(poller);
    this.eventPollers.clear();
  }

  // ── Native XLM payment (non-Soroban) ─────────────────────────────────────

  async sendNativePayment(
    fromPublicKey: string,
    toPublicKey: string,
    amount: string,
    memo?: string,
  ): Promise<TxResult> {
    const account = await this.server.getAccount(fromPublicKey);

    const builder = new TransactionBuilder(account, {
      fee: DEFAULT_TX_FEE,
      networkPassphrase: this.networkPassphrase,
    });

    builder.addOperation(
      Operation.payment({
        destination: toPublicKey,
        asset: Asset.native(),
        amount,
      }),
    );

    if (memo) builder.addMemo(Memo.text(memo));
    builder.setTimeout(TimeoutInfinite);

    const tx = builder.build();
    const signed = this.signTransaction(tx);
    return this.submitAndWait(signed);
  }

  // ── Ledger utilities ──────────────────────────────────────────────────────

  async getLatestLedger(): Promise<number> {
    const info = await this.server.getLatestLedger();
    return info.sequence;
  }

  // ── Parsers ───────────────────────────────────────────────────────────────

  private parseSpinResult(raw: Record<string, unknown>): SpinResult {
    return {
      spinId: BigInt(raw['spin_id'] as string),
      player: raw['player'] as string,
      prizeId: Number(raw['prize_id']),
      prizeName: raw['prize_name'] as string,
      amountWon: BigInt(raw['amount_won'] as string),
      timestamp: BigInt(raw['timestamp'] as string),
      seedUsed: BigInt(raw['seed_used'] as string),
    };
  }

  private parsePrize(raw: unknown): Prize {
    const r = raw as Record<string, unknown>;
    return {
      id: Number(r['id']),
      name: r['name'] as string,
      tokenAddress: r['token_address'] as string,
      amount: BigInt(r['amount'] as string),
      weight: Number(r['weight']),
      isJackpot: r['is_jackpot'] as boolean,
    };
  }
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class StellarServiceError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StellarServiceError';
    this.cause = cause;
  }
}

// ─── Factory helper ───────────────────────────────────────────────────────────

export function createStellarService(config: StellarConfig): StellarService {
  return new StellarService(config);
}

// ─── Usage example (excluded from production bundle) ─────────────────────────
/*
async function exampleUsage() {
  const service = createStellarService({
    network: "testnet",
    contractId: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    spinTokenId: "CYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY",
  });

  // Connect (server-side)
  service.connectWithSecret("SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

  const publicKey = service.getPublicKey();

  // Approve allowance for 10 spins (10 × spin_cost)
  await service.approveSpinCost(publicKey, 10_000_000n, 1_000_000);

  // Spin!
  const result = await service.spin(publicKey);
  console.log("Won:", result.amountWon.toString(), "prize:", result.prizeName);

  // Listen for events
  const latestLedger = await service.getLatestLedger();
  const unsubscribe = service.subscribeToEvents(latestLedger, (evt) => {
    console.log("Contract event:", evt);
  });

  // ... later
  unsubscribe();
}
*/
