# Renaissance Contract Deployment System

This directory contains the deployment infrastructure for Renaissance Soroban smart contracts. The system provides deterministic, repeatable, and safe contract deployments with comprehensive verification and rollback capabilities.

## Features

- **Deterministic Deployment**: Ensures contracts are deployed consistently across environments
- **Safe Deployment Process**: Validates contracts before deployment and verifies after
- **Repeatable Process**: Same inputs produce same results, enabling reproducible deployments
- **Dependency Management**: Handles contract dependencies and deployment order
- **Verification**: Confirms deployed contracts match expected code
- **State Tracking**: Maintains deployment state and prevents duplicate deployments
- **Cross-Platform**: Supports both bash and PowerShell environments

## Prerequisites

Before deploying contracts, ensure you have:

1. **Rust and Cargo** installed
2. **soroban-cli** installed: `cargo install --locked soroban-cli`
3. **WASM target** added: `rustup target add wasm32-unknown-unknown`
4. Appropriate network credentials and funding for deployment accounts

## Deployment Methods

### 1. Using Make Commands (Recommended)

```bash
# Deploy all contracts with optimization
make deploy-optimized

# Deploy all contracts without optimization
make deploy-all

# Deploy individual contracts
make deploy-settlement
make deploy-betting
make deploy-balance-ledger
```

### 2. Using Direct Scripts

#### Bash/Linux/MacOS:
```bash
# Full deployment process
./deployment/deploy-contracts.sh

# Build only
./deployment/deploy-contracts.sh --build-only

# Deploy only (skips build)
./deployment/deploy-contracts.sh --deploy-only

# Verify existing deployments
./deployment/deploy-contracts.sh --verify
```

#### PowerShell (Windows):
```powershell
# Full deployment process
.\deployment\deploy-contracts.ps1

# Build only
.\deployment\deploy-contracts.ps1 -BuildOnly

# Deploy only (skips build)
.\deployment\deploy-contracts.ps1 -DeployOnly

# Verify existing deployments
.\deployment\deploy-contracts.ps1 -VerifyOnly
```

### 3. Using Environment Variables

You can customize deployment behavior using environment variables:

```bash
# Set network and source account
export NETWORK=testnet
export SOURCE_ACCOUNT=my_account
export RPC_URL=https://soroban-testnet.stellar.org

# Then run deployment
./deployment/deploy-contracts.sh
```

## Deployment Configuration

The `deployment-config.json` file defines:

- Contract deployment order respecting dependencies
- Path to WASM files (regular and optimized)
- Network configuration
- Verification settings

## Deployment State Management

The system maintains a `deployment-state.json` file that tracks:

- Deployed contract addresses
- Contract hashes for verification
- Deployment status and timestamps
- Prevents duplicate deployments of identical contracts

## Safety Features

1. **Hash Verification**: Compares contract hashes before and after deployment
2. **Duplicate Prevention**: Skips deployment if contract with same hash is already deployed
3. **Dependency Order**: Respects contract dependencies during deployment
4. **Verification**: Validates deployed contracts against source code
5. **Logging**: Comprehensive logging of all deployment activities

## Troubleshooting

### Common Issues:

1. **soroban-cli not found**: Install with `cargo install --locked soroban-cli`
2. **WASM target missing**: Add with `rustup target add wasm32-unknown-unknown`
3. **Insufficient funds**: Ensure deployment account has sufficient XLM
4. **Network connectivity**: Verify RPC URL is accessible

### Verification Failed:

If verification fails, check:
- Network connectivity
- Correct contract address
- Matching WASM file
- Network configuration

## Best Practices

1. Always verify deployments in test environments before production
2. Keep deployment logs for audit purposes
3. Use optimized WASM files for production deployments
4. Maintain separate deployment configurations for different environments
5. Regularly backup deployment state files

## Deployment Process Flow

1. **Build Phase**: Compile all contracts to WASM
2. **Optimization Phase**: Optimize WASM files for size and performance
3. **Pre-deployment Check**: Verify if contract with same hash is already deployed
4. **Deployment Phase**: Deploy contracts in dependency order
5. **Verification Phase**: Confirm deployed contracts match expectations
6. **State Update**: Record deployment details in state file
7. **Summary Generation**: Create deployment summary and logs

## Rollback Strategy

Currently, manual intervention is required for rollbacks. Future versions will include automated rollback capabilities.

## Security Considerations

- Protect deployment account credentials
- Verify network settings before deployment
- Review contract code before deployment
- Monitor deployed contracts after deployment