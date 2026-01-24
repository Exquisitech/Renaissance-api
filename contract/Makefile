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
	@for contract in settlement betting; do \
		if [ -f "target/wasm32-unknown-unknown/release/$${contract}.wasm" ]; then \
			soroban contract optimize \
				--wasm target/wasm32-unknown-unknown/release/$${contract}.wasm \
				--wasm-out target/wasm32-unknown-unknown/release/$${contract}_optimized.wasm; \
		fi \
	done

# Deploy contracts (requires soroban-cli and network configuration)
deploy-settlement:
	@echo "Deploying settlement contract..."
	soroban contract deploy \
		--wasm target/wasm32-unknown-unknown/release/settlement.wasm \
		--source admin \
		--network testnet

deploy-betting:
	@echo "Deploying betting contract..."
	soroban contract deploy \
		--wasm target/wasm32-unknown-unknown/release/betting.wasm \
		--source admin \
		--network testnet

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
	@echo "  make help            - Show this help message"
