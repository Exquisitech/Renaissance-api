import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Address,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  scValToNative,
  StrKey,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

interface TypedSorobanArg {
  value?: unknown;
  type?: unknown;
  scVal?: xdr.ScVal;
}

interface ResolvedInvocation {
  contractId: string;
  functionName: string;
  args: unknown[];
}

@Injectable()
export class SorobanService implements OnModuleInit {
  private readonly logger = new Logger(SorobanService.name);
  private server: rpc.Server | null = null;
  private networkPassphrase = '';
  private contractId = '';
  private adminKeypair: Keypair | null = null;
  private settlementContractId = '';
  private spinRewardsContractId = '';
  private nftContractId = '';
  private nftTargetContractId = '';
  private settlementFunctionAlias = '';
  private rewardFunctionAlias = '';
  private nftFunctionAlias = '';
  private txTimeoutSeconds = 60;
  private txPollIntervalMs = 1500;
  private txPollAttempts = 20;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeClient();
  }

  private initializeClient() {
    const rpcUrl = this.configService.get<string>('blockchain.stellar.rpcUrl');
    this.networkPassphrase =
      this.configService.get<string>('blockchain.stellar.networkPassphrase') ||
      '';
    this.contractId =
      this.configService.get<string>('blockchain.soroban.contractId') || '';
    this.settlementContractId =
      this.configService.get<string>(
        'blockchain.soroban.settlementContractId',
      ) || '';
    this.spinRewardsContractId =
      this.configService.get<string>(
        'blockchain.soroban.spinRewardsContractId',
      ) || '';
    this.nftContractId =
      this.configService.get<string>('blockchain.soroban.nftContractId') || '';
    this.nftTargetContractId =
      this.configService.get<string>(
        'blockchain.soroban.nftTargetContractId',
      ) || '';
    this.settlementFunctionAlias =
      this.configService.get<string>(
        'blockchain.soroban.settlementFunctionAlias',
      ) || '';
    this.rewardFunctionAlias =
      this.configService.get<string>('blockchain.soroban.rewardFunctionAlias') ||
      '';
    this.nftFunctionAlias =
      this.configService.get<string>('blockchain.soroban.nftFunctionAlias') || '';
    this.txTimeoutSeconds = this.configService.get<number>(
      'blockchain.soroban.txTimeoutSeconds',
      60,
    );
    this.txPollIntervalMs = this.configService.get<number>(
      'blockchain.soroban.txPollIntervalMs',
      1500,
    );
    this.txPollAttempts = this.configService.get<number>(
      'blockchain.soroban.txPollAttempts',
      20,
    );

    const adminSecret = this.configService.get<string>(
      'blockchain.soroban.adminSecret',
    );

    if (!rpcUrl || !this.contractId || !adminSecret) {
      this.logger.warn(
        'Soroban configuration missing. Contract invocations are disabled.',
      );
      return;
    }

    this.server = new rpc.Server(rpcUrl);
    this.adminKeypair = Keypair.fromSecret(adminSecret);

    this.logger.log(
      `SorobanService initialized with default contract ID: ${this.contractId}`,
    );
  }

  async invokeContract(
    functionName: string,
    args: any[] = [],
  ): Promise<string> {
    this.assertConfigured();
    const invocation = this.resolveInvocation(functionName, args);

    try {
      this.logger.log(
        `Preparing Soroban invocation contract=${invocation.contractId} function=${invocation.functionName} argCount=${invocation.args.length}`,
      );

      const sourceAccount = await this.server!.getAccount(
        this.adminKeypair!.publicKey(),
      );
      const contract = new Contract(invocation.contractId);
      const scArgs = invocation.args.map((arg) => this.mapArgumentToScVal(arg));

      let transaction = new TransactionBuilder(sourceAccount, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(contract.call(invocation.functionName, ...scArgs))
        .setTimeout(this.txTimeoutSeconds)
        .build();

      this.logger.log(
        `Simulating Soroban invocation for ${invocation.functionName}`,
      );
      transaction = await this.server!.prepareTransaction(transaction);

      this.logger.log(
        `Signing Soroban transaction for ${invocation.functionName} with ${this.adminKeypair!.publicKey()}`,
      );
      transaction.sign(this.adminKeypair!);

      this.logger.log(
        `Submitting Soroban transaction for ${invocation.functionName}`,
      );
      const sendResponse = await this.server!.sendTransaction(transaction);
      this.logger.log(
        `Soroban submission status=${sendResponse.status} hash=${sendResponse.hash}`,
      );

      if (sendResponse.status === 'ERROR') {
        throw new Error(
          `Soroban submission failed: ${this.formatSendError(sendResponse)}`,
        );
      }

      if (sendResponse.status === 'TRY_AGAIN_LATER') {
        throw new Error(
          `Soroban RPC asked to retry later for transaction ${sendResponse.hash}`,
        );
      }

      const finalResponse = await this.waitForTransaction(sendResponse.hash);
      if (finalResponse.returnValue) {
        this.logger.log(
          `Soroban transaction ${sendResponse.hash} succeeded with return=${JSON.stringify(
            this.safeScValToNative(finalResponse.returnValue),
          )}`,
        );
      } else {
        this.logger.log(
          `Soroban transaction ${sendResponse.hash} confirmed successfully`,
        );
      }

      return sendResponse.hash;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Soroban error';
      this.logger.error(
        `Error invoking contract function ${functionName}: ${message}`,
      );
      throw error;
    }
  }

  async getTransactionStatus(
    txHash: string,
  ): Promise<rpc.Api.GetTransactionResponse> {
    this.assertConfigured();
    return this.server!.getTransaction(txHash);
  }

  private resolveInvocation(
    functionName: string,
    args: unknown[],
  ): ResolvedInvocation {
    let resolvedContractId = this.contractId;
    let resolvedFunctionName = functionName;
    let resolvedArgs = [...args];

    if (functionName === 'settle' && this.settlementContractId) {
      resolvedContractId = this.settlementContractId;
      if (this.settlementFunctionAlias && args.length >= 5) {
        resolvedFunctionName = this.settlementFunctionAlias;
      }
    }

    if (functionName === 'distribute_reward' && this.spinRewardsContractId) {
      resolvedContractId = this.spinRewardsContractId;
      if (this.rewardFunctionAlias) {
        resolvedFunctionName = this.rewardFunctionAlias;
        if (resolvedFunctionName === 'reward_xlm') {
          resolvedArgs = args.slice(0, 2);
        }
      }
    }

    if (functionName === 'mint_nft') {
      resolvedContractId =
        this.spinRewardsContractId || this.nftContractId || this.contractId;
      if (this.nftFunctionAlias) {
        resolvedFunctionName = this.nftFunctionAlias;
        if (resolvedFunctionName === 'reward_nft') {
          if (!this.nftTargetContractId) {
            throw new BadRequestException(
              'SOROBAN_NFT_TARGET_CONTRACT_ID is required to invoke reward_nft',
            );
          }
          resolvedArgs = [
            { type: 'address', value: this.nftTargetContractId },
            args[0],
          ];
        }
      }
    }

    return {
      contractId: resolvedContractId,
      functionName: resolvedFunctionName,
      args: resolvedArgs,
    };
  }

  private mapArgumentToScVal(arg: unknown): xdr.ScVal {
    if (this.isTypedSorobanArg(arg)) {
      if (arg.scVal) {
        return arg.scVal;
      }

      if (arg.type === 'address') {
        return new Address(String(arg.value)).toScVal();
      }

      if (arg.type === 'bytes32') {
        return nativeToScVal(this.coerceFixedBuffer(arg.value, 32), {
          type: 'bytes',
        });
      }

      return nativeToScVal(arg.value, arg.type ? { type: arg.type } : undefined);
    }

    if (arg && typeof arg === 'object' && typeof (arg as any).toXDR === 'function') {
      return arg as xdr.ScVal;
    }

    if (typeof arg === 'string') {
      if (
        StrKey.isValidEd25519PublicKey(arg) ||
        StrKey.isValidContract(arg)
      ) {
        return new Address(arg).toScVal();
      }
      return nativeToScVal(arg);
    }

    return nativeToScVal(arg);
  }

  private async waitForTransaction(
    txHash: string,
  ): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
    for (let attempt = 1; attempt <= this.txPollAttempts; attempt++) {
      const transaction = await this.server!.getTransaction(txHash);

      if (transaction.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return transaction;
      }

      if (transaction.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(
          `Soroban transaction ${txHash} failed: ${this.formatTransactionFailure(transaction)}`,
        );
      }

      if (attempt < this.txPollAttempts) {
        await this.sleep(this.txPollIntervalMs);
      }
    }

    throw new Error(
      `Timed out waiting for Soroban transaction ${txHash} after ${this.txPollAttempts} attempts`,
    );
  }

  private safeScValToNative(value: xdr.ScVal): unknown {
    try {
      return scValToNative(value);
    } catch {
      return value.toXDR('base64');
    }
  }

  private formatSendError(
    response: rpc.Api.SendTransactionResponse,
  ): string {
    const pieces: string[] = [];
    if (response.errorResult) {
      pieces.push(response.errorResult.toXDR('base64'));
    }
    if (response.diagnosticEvents?.length) {
      pieces.push(
        response.diagnosticEvents
          .map((event) => event.toXDR('base64'))
          .join(','),
      );
    }
    return pieces.join(' | ') || response.status;
  }

  private formatTransactionFailure(
    response: rpc.Api.GetFailedTransactionResponse,
  ): string {
    const diagnosticEvents =
      response.diagnosticEventsXdr
        ?.map((event) => event.toXDR('base64'))
        .join(', ') || 'none';
    return `result=${response.resultXdr.toXDR('base64')} diagnostics=${diagnosticEvents}`;
  }

  private assertConfigured(): void {
    if (!this.server || !this.adminKeypair || !this.contractId) {
      throw new ServiceUnavailableException(
        'SorobanService is not configured with RPC, contract ID, and admin secret',
      );
    }
  }

  private isTypedSorobanArg(value: unknown): value is TypedSorobanArg {
    return Boolean(
      value &&
        typeof value === 'object' &&
        ('type' in (value as Record<string, unknown>) ||
          'scVal' in (value as Record<string, unknown>)),
    );
  }

  private coerceFixedBuffer(value: unknown, expectedLength: number): Buffer {
    const buffer =
      Buffer.isBuffer(value)
        ? value
        : typeof value === 'string'
          ? Buffer.from(value.replace(/^0x/, ''), 'hex')
          : null;

    if (!buffer || buffer.length !== expectedLength) {
      throw new BadRequestException(
        `Expected ${expectedLength}-byte value for Soroban argument`,
      );
    }

    return buffer;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}