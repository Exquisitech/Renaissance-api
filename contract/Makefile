.PHONY: build test clean format lint install-deps

# Default target
all: build test

# Build all contracts
build:
	@echo "Building all contracts..."
	cargo build --release --target wasm32-unknown-unknown

# Build a specific contract
build-settlement:
	@echo "Building settlement contract..."
	cargo build -p settlement --release --target wasm32-unknown-unknown

build-betting:
	@echo "Building betting contract..."
	cargo build -p betting --release --target wasm32-unknown-unknown

build-balance-ledger:
	@echo "Building balance ledger contract..."
	cargo build -p balance_ledger --release --target wasm32-unknown-unknown

# Run all tests
test:
	@echo "Running tests..."
	cargo test

# Run tests for a specific contract
test-settlement:
	@echo "Running settlement tests..."
	cargo test -p settlement

test-betting:
	@echo "Running betting tests..."
	cargo test -p betting

test-balance-ledger:
	@echo "Running balance ledger tests..."
	cargo test -p balance_ledger

test-common:
	@echo "Running common tests..."
	cargo test -p common

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	cargo clean

# Format code
format:
	@echo "Formatting code..."
	cargo fmt --all

# Check formatting
format-check:
	@echo "Checking code formatting..."
	cargo fmt --all -- --check

# Run linter
lint:
	@echo "Running clippy..."
	cargo clippy --all-targets --all-features -- -D warnings

# Install development dependencies
install-deps:
	@echo "Installing Soroban CLI..."
	cargo install --locked soroban-cli
	@echo "Adding wasm32 target..."
	rustup target add wasm32-unknown-unknown

# Optimize WASM files
optimize:
	@echo "Optimizing WASM files..."
	@for contract in settlement betting balance_ledger; do \
		if [ -f "target/wasm32-unknown-unknown/release/$${contract}.wasm" ]; then \
			soroban contract optimize \
				--wasm target/wasm32-unknown-unknown/release/$${contract}.wasm \
				--wasm-out target/wasm32-unknown-unknown/release/$${contract}_optimized.wasm; \
		fi \
	done

# Deploy contracts (requires soroban-cli and network configuration)
deploy-settlement:
	@echo "Deploying settlement contract..."
	@if [ -f "target/wasm32-unknown-unknown/release/settlement_optimized.wasm" ]; then \
		soroban contract deploy \
			--wasm target/wasm32-unknown-unknown/release/settlement_optimized.wasm \
			--source admin \
			--network testnet; \
	else \
		soroban contract deploy \
			--wasm target/wasm32-unknown-unknown/release/settlement.wasm \
			--source admin \
			--network testnet; \
	fi

deploy-betting:
	@echo "Deploying betting contract..."
	@if [ -f "target/wasm32-unknown-unknown/release/betting_optimized.wasm" ]; then \
		soroban contract deploy \
			--wasm target/wasm32-unknown-unknown/release/betting_optimized.wasm \
			--source admin \
			--network testnet; \
	else \
		soroban contract deploy \
			--wasm target/wasm32-unknown-unknown/release/betting.wasm \
			--source admin \
			--network testnet; \
	fi

deploy-balance-ledger:
	@echo "Deploying balance ledger contract..."
	@if [ -f "target/wasm32-unknown-unknown/release/balance_ledger_optimized.wasm" ]; then \
		soroban contract deploy \
			--wasm target/wasm32-unknown-unknown/release/balance_ledger_optimized.wasm \
			--source admin \
			--network testnet; \
	else \
		soroban contract deploy \
			--wasm target/wasm32-unknown-unknown/release/balance_ledger.wasm \
			--source admin \
			--network testnet; \
	fi

# Advanced deployment with deterministic scripts
deploy-all:
	@echo "Deploying all contracts with deterministic deployment script..."
	make -C deployment deploy-all

deploy-optimized:
	@echo "Deploying all contracts with optimization..."
	make -C deployment optimize-all
	make -C deployment deploy-all

# Help
help:
	@echo "Available targets:"
	@echo "  make build           - Build all contracts"
	@echo "  make test            - Run all tests"
	@echo "  make clean           - Clean build artifacts"
	@echo "  make format          - Format code"
	@echo "  make format-check    - Check code formatting"
	@echo "  make lint            - Run clippy linter"
	@echo "  make install-deps    - Install development dependencies"
	@echo "  make optimize        - Optimize WASM files"
	@echo "  make deploy-*        - Deploy specific contract"
	@echo "  make deploy-all      - Deploy all contracts with deterministic script"
	@echo "  make deploy-optimized - Deploy all contracts with optimization"
	@echo "  make test-balance-ledger - Run balance ledger tests"
	@echo "  make build-balance-ledger - Build balance ledger contract"
	@echo "  make help            - Show this help message"
