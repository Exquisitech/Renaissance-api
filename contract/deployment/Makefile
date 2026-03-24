# Deployment Makefile for Renaissance Soroban Smart Contracts
# Provides deterministic, repeatable and safe contract deployment

# Default configuration
NETWORK ?= testnet
SOURCE_ACCOUNT ?= admin
RPC_URL ?= https://soroban-testnet.stellar.org
PASSPHRASE ?= "Test SDF Network ; September 2015"
BUILD_DIR = target/wasm32-unknown-unknown/release
DEPLOYMENT_STATE_FILE = deployment-state.json
SCRIPT_DIR = ./deployment

# Contract names
CONTRACTS = settlement betting balance_ledger player_card staking

# Build all contracts before deployment
.PHONY: build-all
build-all:
	@echo "Building all contracts..."
	cargo build --release --target wasm32-unknown-unknown

# Optimize all WASM files
.PHONY: optimize-all
optimize-all:
	@echo "Optimizing all WASM files..."
	@for contract in $(CONTRACTS); do \
		if [ -f "$(BUILD_DIR)/$$contract.wasm" ]; then \
			echo "Optimizing $$contract..."; \
			soroban contract optimize \
				--wasm $(BUILD_DIR)/$$contract.wasm \
				--wasm-out $(BUILD_DIR)/$$contract\_optimized.wasm; \
		else \
			echo "WASM file not found for $$contract, skipping optimization"; \
		fi \
	done

# Deploy all contracts
.PHONY: deploy-all
deploy-all: build-all optimize-all
	@echo "Deploying all contracts to $(NETWORK)..."
	@./deployment/deploy-contracts.sh --network $(NETWORK) --source $(SOURCE_ACCOUNT)

# Deploy individual contracts
.PHONY: deploy-settlement
deploy-settlement: build-all
	@echo "Deploying settlement contract to $(NETWORK)..."
	@if [ -f "$(BUILD_DIR)/settlement_optimized.wasm" ]; then \
		soroban contract deploy \
			--wasm $(BUILD_DIR)/settlement_optimized.wasm \
			--source $(SOURCE_ACCOUNT) \
			--network $(NETWORK) \
			--rpc-url $(RPC_URL) \
			--network-passphrase $(PASSPHRASE); \
	else \
		soroban contract deploy \
			--wasm $(BUILD_DIR)/settlement.wasm \
			--source $(SOURCE_ACCOUNT) \
			--network $(NETWORK) \
			--rpc-url $(RPC_URL) \
			--network-passphrase $(PASSPHRASE); \
	fi

.PHONY: deploy-betting
deploy-betting: build-all
	@echo "Deploying betting contract to $(NETWORK)..."
	@if [ -f "$(BUILD_DIR)/betting_optimized.wasm" ]; then \
		soroban contract deploy \
			--wasm $(BUILD_DIR)/betting_optimized.wasm \
			--source $(SOURCE_ACCOUNT) \
			--network $(NETWORK) \
			--rpc-url $(RPC_URL) \
			--network-passphrase $(PASSPHRASE); \
	else \
		soroban contract deploy \
			--wasm $(BUILD_DIR)/betting.wasm \
			--source $(SOURCE_ACCOUNT) \
			--network $(NETWORK) \
			--rpc-url $(RPC_URL) \
			--network-passphrase $(PASSPHRASE); \
	fi

.PHONY: deploy-balance-ledger
deploy-balance-ledger: build-all
	@echo "Deploying balance ledger contract to $(NETWORK)..."
	@if [ -f "$(BUILD_DIR)/balance_ledger_optimized.wasm" ]; then \
		soroban contract deploy \
			--wasm $(BUILD_DIR)/balance_ledger_optimized.wasm \
			--source $(SOURCE_ACCOUNT) \
			--network $(NETWORK) \
			--rpc-url $(RPC_URL) \
			--network-passphrase $(PASSPHRASE); \
	else \
		soroban contract deploy \
			--wasm $(BUILD_DIR)/balance_ledger.wasm \
			--source $(SOURCE_ACCOUNT) \
			--network $(NETWORK) \
			--rpc-url $(RPC_URL) \
			--network-passphrase $(PASSPHRASE); \
	fi

.PHONY: deploy-player-card
deploy-player-card: build-all
	@echo "Deploying player card contract to $(NETWORK)..."
	@if [ -f "$(BUILD_DIR)/player_card_optimized.wasm" ]; then \
		soroban contract deploy \
			--wasm $(BUILD_DIR)/player_card_optimized.wasm \
			--source $(SOURCE_ACCOUNT) \
			--network $(NETWORK) \
			--rpc-url $(RPC_URL) \
			--network-passphrase $(PASSPHRASE); \
	else \
		soroban contract deploy \
			--wasm $(BUILD_DIR)/player_card.wasm \
			--source $(SOURCE_ACCOUNT) \
			--network $(NETWORK) \
			--rpc-url $(RPC_URL) \
			--network-passphrase $(PASSPHRASE); \
	fi

.PHONY: deploy-staking
deploy-staking: build-all
	@echo "Deploying staking contract to $(NETWORK)..."
	@if [ -f "$(BUILD_DIR)/staking_optimized.wasm" ]; then \
		soroban contract deploy \
			--wasm $(BUILD_DIR)/staking_optimized.wasm \
			--source $(SOURCE_ACCOUNT) \
			--network $(NETWORK) \
			--rpc-url $(RPC_URL) \
			--network-passphrase $(PASSPHRASE); \
	else \
		soroban contract deploy \
			--wasm $(BUILD_DIR)/staking.wasm \
			--source $(SOURCE_ACCOUNT) \
			--network $(NETWORK) \
			--rpc-url $(RPC_URL) \
			--network-passphrase $(PASSPHRASE); \
	fi

# Deploy only (skip build)
.PHONY: deploy-only
deploy-only:
	@echo "Deploying all contracts without building..."
	@./deployment/deploy-contracts.sh --deploy-only --network $(NETWORK) --source $(SOURCE_ACCOUNT)

# Verify deployed contracts
.PHONY: verify
verify:
	@echo "Verifying deployed contracts..."
	@if [ -f "$(DEPLOYMENT_STATE_FILE)" ]; then \
		./deployment/deploy-contracts.sh --verify --network $(NETWORK); \
	else \
		echo "No deployment state file found. Nothing to verify."; \
	fi

# Check prerequisites
.PHONY: check-prerequisites
check-prerequisites:
	@echo "Checking prerequisites..."
	@which soroban > /dev/null || (echo "soroban-cli not found. Install with: cargo install --locked soroban-cli" && exit 1)
	@which rustc > /dev/null || (echo "rustc not found. Install Rust first." && exit 1)
	@rustc --print target-list | grep -q wasm32-unknown-unknown || (echo "Adding wasm32-unknown-unknown target..." && rustup target add wasm32-unknown-unknown)
	@echo "Prerequisites OK"

# Clean deployment artifacts
.PHONY: clean-deployment
clean-deployment:
	@echo "Cleaning deployment artifacts..."
	@rm -f deployment-*.log
	@rm -f deployment-state.json
	@echo "Deployment artifacts cleaned"

# Show deployment status
.PHONY: status
status:
	@echo "Deployment Status:"
	@if [ -f "$(DEPLOYMENT_STATE_FILE)" ]; then \
		echo "Deployment state file exists: $(DEPLOYMENT_STATE_FILE)"; \
		jq -r '.contracts | to_entries[] | "  \(.key): \(.value.address) (\(.value.status))"' $(DEPLOYMENT_STATE_FILE) 2>/dev/null || echo "  No contracts deployed yet"; \
		echo "Network: $(NETWORK)"; \
	else \
		echo "No deployment state file found. No contracts have been deployed yet."; \
	fi

# Export environment variables for the scripts
export NETWORK
export SOURCE_ACCOUNT
export RPC_URL
export PASSPHRASE

# Help target
.PHONY: help
help:
	@echo "Renaissance Contract Deployment Makefile"
	@echo "======================================"
	@echo "Usage: make [TARGET]"
	@echo ""
	@echo "Deployment Targets:"
	@echo "  deploy-all           - Build and deploy all contracts"
	@echo "  deploy-settlement    - Deploy settlement contract only"
	@echo "  deploy-betting       - Deploy betting contract only"
	@echo "  deploy-balance-ledger - Deploy balance ledger contract only"
	@echo "  deploy-player-card   - Deploy player card contract only"
	@echo "  deploy-staking       - Deploy staking contract only"
	@echo "  deploy-only          - Deploy without rebuilding"
	@echo "  verify               - Verify deployed contracts"
	@echo ""
	@echo "Utility Targets:"
	@echo "  build-all            - Build all contracts"
	@echo "  optimize-all         - Optimize all WASM files"
	@echo "  check-prerequisites  - Check if prerequisites are met"
	@echo "  status               - Show deployment status"
	@echo "  clean-deployment     - Clean deployment artifacts"
	@echo "  help                 - Show this help message"
	@echo ""
	@echo "Environment Variables:"
	@echo "  NETWORK             - Network to deploy to (default: testnet)"
	@echo "  SOURCE_ACCOUNT      - Source account for deployment (default: admin)"
	@echo "  RPC_URL             - RPC URL (default: https://soroban-testnet.stellar.org)"
	@echo "  PASSPHRASE          - Network passphrase"