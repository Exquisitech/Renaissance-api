#!/bin/bash
# Deployment script for Renaissance Soroban smart contracts
# Provides deterministic, repeatable and safe contract deployments

set -e  # Exit on any error

# Default configuration
NETWORK="${NETWORK:-testnet}"
SOURCE_ACCOUNT="${SOURCE_ACCOUNT:-admin}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
PASSPHRASE="${PASSPHRASE:-"Test SDF Network ; September 2015"}"
BUILD_DIR="target/wasm32-unknown-unknown/release"
LOG_FILE="deployment-$(date +%Y%m%d-%H%M%S).log"
CONTRACTS=("settlement" "betting" "balance_ledger" "player_card" "staking")
DEPLOYMENT_STATE_FILE="deployment-state.json"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if soroban-cli is installed
check_soroban_cli() {
    if ! command -v soroban &> /dev/null; then
        print_error "soroban-cli is not installed. Please install it first."
        print_status "Run: cargo install --locked soroban-cli"
        exit 1
    fi
    print_success "soroban-cli is installed $(soroban --version)"
}

# Check if rust and wasm target is available
check_rust_setup() {
    if ! command -v rustc &> /dev/null; then
        print_error "rustc is not installed. Please install Rust first."
        print_status "Visit: https://www.rust-lang.org/tools/install"
        exit 1
    fi
    
    if ! rustc --print target-list | grep -q wasm32-unknown-unknown; then
        print_status "Adding wasm32-unknown-unknown target..."
        rustup target add wasm32-unknown-unknown
    fi
    print_success "Rust environment is ready"
}

# Build all contracts
build_contracts() {
    print_status "Building all contracts..."
    cargo build --release --target wasm32-unknown-unknown
    print_success "All contracts built successfully"
}

# Optimize WASM files
optimize_contracts() {
    print_status "Optimizing WASM files..."
    
    for contract in "${CONTRACTS[@]}"; do
        wasm_file="$BUILD_DIR/${contract}.wasm"
        optimized_wasm="$BUILD_DIR/${contract}_optimized.wasm"
        
        if [ -f "$wasm_file" ]; then
            print_status "Optimizing $contract..."
            soroban contract optimize --wasm "$wasm_file" --wasm-out "$optimized_wasm"
            print_success "$contract optimized"
        else
            print_warning "WASM file not found for $contract, skipping optimization"
        fi
    done
}

# Calculate contract hash for deterministic deployment
calculate_contract_hash() {
    local wasm_file=$1
    if [ ! -f "$wasm_file" ]; then
        print_error "WASM file $wasm_file does not exist"
        return 1
    fi
    
    # Get the hash of the WASM file
    sha256sum "$wasm_file" | cut -d' ' -f1
}

# Deploy a single contract with deterministic check
deploy_contract() {
    local contract_name=$1
    local wasm_file=$2
    local optimized_wasm="$BUILD_DIR/${contract_name}_optimized.wasm"
    
    print_status "Processing deployment for $contract_name..."
    
    # Use optimized WASM if available, otherwise use regular WASM
    local final_wasm="$wasm_file"
    if [ -f "$optimized_wasm" ]; then
        final_wasm="$optimized_wasm"
    fi
    
    # Calculate hash for this contract
    local contract_hash=$(calculate_contract_hash "$final_wasm")
    log "Contract $contract_name hash: $contract_hash"
    
    # Check if contract is already deployed with this hash
    if [ -f "$DEPLOYMENT_STATE_FILE" ]; then
        local existing_address=$(jq -r ".contracts[\"$contract_name\"]?.address // empty" "$DEPLOYMENT_STATE_FILE" 2>/dev/null)
        local existing_hash=$(jq -r ".contracts[\"$contract_name\"]?.hash // empty" "$DEPLOYMENT_STATE_FILE" 2>/dev/null)
        
        if [ -n "$existing_address" ] && [ "$existing_hash" = "$contract_hash" ]; then
            print_warning "$contract_name is already deployed with the same hash at $existing_address"
            print_status "Verifying contract at stored address..."
            
            # Verify the contract is still active at the stored address
            if verify_contract "$existing_address" "$final_wasm"; then
                print_success "$contract_name verified at $existing_address"
                update_deployment_state "$contract_name" "$existing_address" "$contract_hash" "verified"
                return 0
            else
                print_warning "Stored address for $contract_name is no longer valid, redeploying..."
            fi
        fi
    fi
    
    # Deploy the contract
    print_status "Deploying $contract_name..."
    local contract_id
    contract_id=$(soroban contract deploy \
        --wasm "$final_wasm" \
        --source "$SOURCE_ACCOUNT" \
        --network "$NETWORK" \
        --rpc-url "$RPC_URL" \
        --network-passphrase "$PASSPHRASE")
    
    if [ $? -eq 0 ]; then
        print_success "$contract_name deployed successfully at $contract_id"
        update_deployment_state "$contract_name" "$contract_id" "$contract_hash" "deployed"
        return 0
    else
        print_error "Failed to deploy $contract_name"
        return 1
    fi
}

# Verify contract at given address
verify_contract() {
    local contract_address=$1
    local wasm_file=$2
    
    # Create a temporary file for the fetched contract
    local temp_wasm="/tmp/fetched_contract_$(date +%s).wasm"
    
    # Attempt to fetch the contract from the network
    if soroban contract fetch \
        --id "$contract_address" \
        --output "$temp_wasm" \
        --network "$NETWORK" \
        --rpc-url "$RPC_URL" \
        --network-passphrase "$PASSPHRASE" 2>/dev/null; then
        
        # Compare hashes
        local stored_hash=$(calculate_contract_hash "$wasm_file")
        local fetched_hash=$(calculate_contract_hash "$temp_wasm")
        
        rm -f "$temp_wasm"  # Clean up
        
        if [ "$stored_hash" = "$fetched_hash" ]; then
            return 0  # Verification successful
        else
            return 1  # Hash mismatch
        fi
    else
        rm -f "$temp_wasm"  # Clean up
        return 1  # Fetch failed
    fi
}

# Update deployment state file
update_deployment_state() {
    local contract_name=$1
    local address=$2
    local hash=$3
    local status=$4
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Create initial structure if file doesn't exist
    if [ ! -f "$DEPLOYMENT_STATE_FILE" ]; then
        echo '{"contracts": {}, "network": "'"$NETWORK"'", "timestamp": "'"$timestamp"'"}' > "$DEPLOYMENT_STATE_FILE"
    fi
    
    # Update the contract entry
    jq --arg name "$contract_name" \
       --arg addr "$address" \
       --arg hsh "$hash" \
       --arg stat "$status" \
       --arg time "$timestamp" \
       '.contracts[$name] = {"address": $addr, "hash": $hsh, "status": $stat, "timestamp": $time}' \
       "$DEPLOYMENT_STATE_FILE" > "${DEPLOYMENT_STATE_FILE}.tmp" && mv "${DEPLOYMENT_STATE_FILE}.tmp" "$DEPLOYMENT_STATE_FILE"
}

# Deploy all contracts in dependency order
deploy_all_contracts() {
    print_status "Starting deployment of all contracts..."
    
    # Define deployment order based on dependencies
    local deployment_order=("balance_ledger" "betting" "settlement" "player_card" "staking")
    
    for contract in "${deployment_order[@]}"; do
        local wasm_file="$BUILD_DIR/${contract}.wasm"
        local optimized_wasm="$BUILD_DIR/${contract}_optimized.wasm"
        
        # Use optimized WASM if available
        local final_wasm="$wasm_file"
        if [ -f "$optimized_wasm" ]; then
            final_wasm="$optimized_wasm"
        fi
        
        if [ -f "$final_wasm" ]; then
            if ! deploy_contract "$contract" "$final_wasm"; then
                print_error "Deployment of $contract failed, stopping deployment process."
                exit 1
            fi
        else
            print_warning "WASM file not found for $contract, skipping deployment"
        fi
    done
    
    print_success "All contracts deployed successfully!"
}

# Rollback function (basic implementation)
rollback_deployment() {
    print_warning "Rollback functionality is not implemented in this version."
    print_status "Manual intervention required for rollback."
}

# Print deployment summary
print_summary() {
    print_status "=== Deployment Summary ==="
    
    if [ -f "$DEPLOYMENT_STATE_FILE" ]; then
        echo "Network: $NETWORK"
        echo "Deployment file: $DEPLOYMENT_STATE_FILE"
        echo ""
        echo "Deployed contracts:"
        jq -r '.contracts | to_entries[] | "  \(.key): \(.value.address) (\(.value.status))"' "$DEPLOYMENT_STATE_FILE" 2>/dev/null || echo "  No contracts deployed yet"
    else
        echo "No deployment state file found. No contracts have been deployed yet."
    fi
    
    echo ""
    print_success "Deployment log saved to: $LOG_FILE"
}

# Main execution
main() {
    print_status "Renaissance Contract Deployment Script"
    print_status "====================================="
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --network|--net)
                NETWORK="$2"
                shift 2
                ;;
            --source)
                SOURCE_ACCOUNT="$2"
                shift 2
                ;;
            --rpc-url)
                RPC_URL="$2"
                shift 2
                ;;
            --passphrase)
                PASSPHRASE="$2"
                shift 2
                ;;
            --build-only)
                BUILD_ONLY=true
                shift
                ;;
            --deploy-only)
                DEPLOY_ONLY=true
                shift
                ;;
            --optimize-only)
                OPTIMIZE_ONLY=true
                shift
                ;;
            --verify)
                VERIFY_ONLY=true
                shift
                ;;
            --rollback)
                ROLLBACK=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --network, --net NET    Network to deploy to (default: testnet)"
                echo "  --source ACCOUNT       Source account for deployment (default: admin)"
                echo "  --rpc-url URL          RPC URL (default: https://soroban-testnet.stellar.org)"
                echo "  --passphrase PHRASE    Network passphrase (default: Test SDF Network ; September 2015)"
                echo "  --build-only           Only build contracts, don't deploy"
                echo "  --deploy-only          Skip build, only deploy (assumes contracts are built)"
                echo "  --optimize-only        Only optimize WASM files"
                echo "  --verify               Verify deployed contracts"
                echo "  --rollback             Attempt to rollback deployment"
                echo "  -h, --help             Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Validate environment
    check_soroban_cli
    check_rust_setup
    
    # Execute based on flags
    if [ "$OPTIMIZE_ONLY" = true ]; then
        optimize_contracts
    elif [ "$BUILD_ONLY" = true ]; then
        build_contracts
        optimize_contracts
    elif [ "$DEPLOY_ONLY" = true ]; then
        deploy_all_contracts
    elif [ "$VERIFY_ONLY" = true ]; then
        verify_deployments
    elif [ "$ROLLBACK" = true ]; then
        rollback_deployment
    else
        # Full deployment process
        build_contracts
        optimize_contracts
        deploy_all_contracts
    fi
    
    print_summary
}

# Verify existing deployments
verify_deployments() {
    print_status "Verifying existing deployments..."
    
    if [ ! -f "$DEPLOYMENT_STATE_FILE" ]; then
        print_error "No deployment state file found. Nothing to verify."
        return 1
    fi
    
    local all_good=true
    jq -r '.contracts | to_entries[] | "\(.key)|\(.value.address)|\(.value.hash)"' "$DEPLOYMENT_STATE_FILE" 2>/dev/null | while IFS='|' read -r contract_name address hash; do
        if [ -n "$address" ] && [ -n "$hash" ]; then
            print_status "Verifying $contract_name at $address..."
            
            local wasm_file="$BUILD_DIR/${contract_name}.wasm"
            local optimized_wasm="$BUILD_DIR/${contract_name}_optimized.wasm"
            local final_wasm="$wasm_file"
            
            if [ -f "$optimized_wasm" ]; then
                final_wasm="$optimized_wasm"
            fi
            
            if verify_contract "$address" "$final_wasm"; then
                print_success "$contract_name verified successfully"
                update_deployment_state "$contract_name" "$address" "$hash" "verified"
            else
                print_error "$contract_name verification failed"
                update_deployment_state "$contract_name" "$address" "$hash" "verification_failed"
                all_good=false
            fi
        fi
    done
    
    if [ "$all_good" = true ]; then
        print_success "All contracts verified successfully"
    else
        print_error "Some contracts failed verification"
        return 1
    fi
}

# Run main function with all arguments
main "$@"