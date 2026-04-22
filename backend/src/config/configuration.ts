export default () => ({
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    environment: process.env.NODE_ENV || 'development',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.CACHE_TTL || '60', 10),
    max: parseInt(process.env.CACHE_MAX || '100', 10),
    store: process.env.CACHE_STORE || 'memory',
  },
  blockchain: {
    stellar: {
      network: process.env.STELLAR_NETWORK || 'TESTNET',
      rpcUrl:
        process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
      networkPassphrase:
        process.env.STELLAR_NETWORK_PASSPHRASE ||
        'Test SDF Network ; September 2015',
    },
    soroban: {
      contractId: process.env.SOROBAN_CONTRACT_ID,
      adminSecret: process.env.SOROBAN_ADMIN_SECRET,
      settlementContractId: process.env.SOROBAN_SETTLEMENT_CONTRACT_ID,
      spinRewardsContractId: process.env.SOROBAN_SPIN_REWARDS_CONTRACT_ID,
      nftContractId: process.env.SOROBAN_NFT_CONTRACT_ID,
      nftTargetContractId: process.env.SOROBAN_NFT_TARGET_CONTRACT_ID,
      settlementFunctionAlias: process.env.SOROBAN_SETTLEMENT_FUNCTION,
      rewardFunctionAlias: process.env.SOROBAN_REWARD_FUNCTION,
      nftFunctionAlias: process.env.SOROBAN_NFT_FUNCTION,
      txTimeoutSeconds: parseInt(
        process.env.SOROBAN_TX_TIMEOUT_SECONDS || '60',
        10,
      ),
      txPollIntervalMs: parseInt(
        process.env.SOROBAN_TX_POLL_INTERVAL_MS || '1500',
        10,
      ),
      txPollAttempts: parseInt(
        process.env.SOROBAN_TX_POLL_ATTEMPTS || '20',
        10,
      ),
    },
    events: {
      enabled: process.env.CONTRACT_EVENTS_ENABLED !== 'false',
      pollIntervalMs: parseInt(
        process.env.CONTRACT_EVENTS_POLL_INTERVAL_MS || '5000',
        10,
      ),
      pageLimit: parseInt(process.env.CONTRACT_EVENTS_PAGE_LIMIT || '100', 10),
      processingRetryAttempts: parseInt(
        process.env.CONTRACT_EVENTS_PROCESSING_RETRY_ATTEMPTS || '3',
        10,
      ),
      reconnectBaseDelayMs: parseInt(
        process.env.CONTRACT_EVENTS_RECONNECT_BASE_DELAY_MS || '1000',
        10,
      ),
      reconnectMaxDelayMs: parseInt(
        process.env.CONTRACT_EVENTS_RECONNECT_MAX_DELAY_MS || '30000',
        10,
      ),
      startLedger: parseInt(
        process.env.CONTRACT_EVENTS_START_LEDGER || '0',
        10,
      ),
    },
  },
});
