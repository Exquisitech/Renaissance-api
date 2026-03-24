# PowerShell Deployment script for Renaissance Soroban smart contracts
# Provides deterministic, repeatable and safe contract deployments

param(
    [string]$Network = $(if ($env:NETWORK) { $env:NETWORK } else { "testnet" }),
    [string]$SourceAccount = $(if ($env:SOURCE_ACCOUNT) { $env:SOURCE_ACCOUNT } else { "admin" }),
    [string]$RpcUrl = $(if ($env:RPC_URL) { $env:RPC_URL } else { "https://soroban-testnet.stellar.org" }),
    [string]$Passphrase = $(if ($env:PASSPHRASE) { $env:PASSPHRASE } else { "Test SDF Network ; September 2015" }),
    [switch]$BuildOnly = $false,
    [switch]$DeployOnly = $false,
    [switch]$OptimizeOnly = $false,
    [switch]$VerifyOnly = $false,
    [switch]$Rollback = $false,
    [switch]$Help = $false
)

# Exit on any error
$ErrorActionPreference = "Stop"

# Configuration
$BuildDir = "target/wasm32-unknown-unknown/release"
$LogFile = "deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$Contracts = @("settlement", "betting", "balance_ledger", "player_card", "staking")
$DeploymentStateFile = "deployment-state.json"

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

# Logging function
function Log-Message {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $LogFile -Append
}

# Print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "$Blue[INFO]$Reset $Message"
    Log-Message "INFO - $Message"
}

function Write-Success {
    param([string]$Message)
    Write-Host "$Green[SUCCESS]$Reset $Message"
    Log-Message "SUCCESS - $Message"
}

function Write-Warning {
    param([string]$Message)
    Write-Host "$Yellow[WARNING]$Reset $Message"
    Log-Message "WARNING - $Message"
}

function Write-ErrorCustom {
    param([string]$Message)
    Write-Host "$Red[ERROR]$Reset $Message"
    Log-Message "ERROR - $Message"
}

# Check if soroban-cli is installed
function Test-SorobanCli {
    try {
        $result = & soroban --version 2>$null
        Write-Success "soroban-cli is installed $result"
        return $true
    } catch {
        Write-ErrorCustom "soroban-cli is not installed. Please install it first."
        Write-Status "Run: cargo install --locked soroban-cli"
        exit 1
    }
}

# Check if rust and wasm target is available
function Test-RustSetup {
    try {
        $rustcVersion = & rustc --version 2>$null
        Write-Status "Rust is installed: $rustcVersion"
    } catch {
        Write-ErrorCustom "rustc is not installed. Please install Rust first."
        Write-Status "Visit: https://www.rust-lang.org/tools/install"
        exit 1
    }
    
    # Check if wasm32 target is installed
    $targets = & rustc --print target-list
    if ($targets -notmatch "wasm32-unknown-unknown") {
        Write-Status "Adding wasm32-unknown-unknown target..."
        & rustup target add wasm32-unknown-unknown
    }
    Write-Success "Rust environment is ready"
}

# Build all contracts
function Build-Contracts {
    Write-Status "Building all contracts..."
    & cargo build --release --target wasm32-unknown-unknown
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorCustom "Failed to build contracts"
        exit 1
    }
    Write-Success "All contracts built successfully"
}

# Optimize WASM files
function Optimize-Contracts {
    Write-Status "Optimizing WASM files..."
    
    foreach ($contract in $Contracts) {
        $wasmFile = Join-Path $BuildDir "$contract.wasm"
        $optimizedWasm = Join-Path $BuildDir "${contract}_optimized.wasm"
        
        if (Test-Path $wasmFile) {
            Write-Status "Optimizing $contract..."
            & soroban contract optimize --wasm $wasmFile --wasm-out $optimizedWasm
            if ($LASTEXITCODE -eq 0) {
                Write-Success "$contract optimized"
            } else {
                Write-ErrorCustom "Failed to optimize $contract"
            }
        } else {
            Write-Warning "WASM file not found for $contract, skipping optimization"
        }
    }
}

# Calculate contract hash for deterministic deployment
function Get-ContractHash {
    param([string]$WasmFile)
    
    if (-not (Test-Path $WasmFile)) {
        Write-ErrorCustom "WASM file $WasmFile does not exist"
        return $null
    }
    
    # Get the hash of the WASM file
    $bytes = [System.IO.File]::ReadAllBytes($WasmFile)
    $sha256 = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    -join $sha256.ForEach({"{0:x2}" -f $_})
}

# Deploy a single contract with deterministic check
function Deploy-Contract {
    param([string]$ContractName, [string]$WasmFile)
    
    Write-Status "Processing deployment for $ContractName..."
    
    # Use optimized WASM if available, otherwise use regular WASM
    $finalWasm = $WasmFile
    $optimizedWasm = Join-Path $BuildDir "${ContractName}_optimized.wasm"
    if (Test-Path $optimizedWasm) {
        $finalWasm = $optimizedWasm
    }
    
    # Calculate hash for this contract
    $contractHash = Get-ContractHash -WasmFile $finalWasm
    Log-Message "Contract $ContractName hash: $contractHash"
    
    # Check if contract is already deployed with this hash
    if (Test-Path $DeploymentStateFile) {
        $deploymentState = Get-Content $DeploymentStateFile -Raw | ConvertFrom-Json
        $existingAddress = $null
        $existingHash = $null
        
        if ($deploymentState.contracts.$ContractName) {
            $existingAddress = $deploymentState.contracts.$ContractName.address
            $existingHash = $deploymentState.contracts.$ContractName.hash
        }
        
        if ($existingAddress -and $existingHash -eq $contractHash) {
            Write-Warning "$ContractName is already deployed with the same hash at $existingAddress"
            Write-Status "Verifying contract at stored address..."
            
            # Verify the contract is still active at the stored address
            if (Test-Contract -ContractAddress $existingAddress -WasmFile $finalWasm) {
                Write-Success "$ContractName verified at $existingAddress"
                Update-DeploymentState -ContractName $ContractName -Address $existingAddress -Hash $contractHash -Status "verified"
                return $true
            } else {
                Write-Warning "Stored address for $ContractName is no longer valid, redeploying..."
            }
        }
    }
    
    # Deploy the contract
    Write-Status "Deploying $ContractName..."
    
    # Create a temporary file to capture output
    $tempOutput = [System.IO.Path]::GetTempFileName()
    try {
        # Use PowerShell redirection to capture output
        $process = Start-Process -FilePath "soroban" -ArgumentList @(
            "contract", "deploy",
            "--wasm", $finalWasm,
            "--source", $SourceAccount,
            "--network", $Network,
            "--rpc-url", $RpcUrl,
            "--network-passphrase", $Passphrase
        ) -RedirectStandardOutput $tempOutput -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            $contractId = Get-Content $tempOutput | Where-Object { $_ -ne "" } | Select-Object -Last 1
            Write-Success "$ContractName deployed successfully at $contractId"
            Update-DeploymentState -ContractName $ContractName -Address $contractId -Hash $contractHash -Status "deployed"
            return $true
        } else {
            Write-ErrorCustom "Failed to deploy $ContractName"
            return $false
        }
    } finally {
        if (Test-Path $tempOutput) {
            Remove-Item $tempOutput
        }
    }
}

# Verify contract at given address
function Test-Contract {
    param([string]$ContractAddress, [string]$WasmFile)
    
    # Create a temporary file for the fetched contract
    $tempWasm = Join-Path $env:TEMP "fetched_contract_$([DateTime]::Now.ToString('yyyyMMddHHmmss')).wasm"
    
    try {
        # Attempt to fetch the contract from the network
        $fetchProcess = Start-Process -FilePath "soroban" -ArgumentList @(
            "contract", "fetch",
            "--id", $ContractAddress,
            "--output", $tempWasm,
            "--network", $Network,
            "--rpc-url", $RpcUrl,
            "--network-passphrase", $Passphrase
        ) -Wait -PassThru
        
        if ($fetchProcess.ExitCode -eq 0) {
            # Compare hashes
            $storedHash = Get-ContractHash -WasmFile $WasmFile
            $fetchedHash = Get-ContractHash -WasmFile $tempWasm
            
            if ($storedHash -eq $fetchedHash) {
                return $true  # Verification successful
            } else {
                return $false  # Hash mismatch
            }
        } else {
            return $false  # Fetch failed
        }
    } catch {
        return $false  # Exception occurred
    } finally {
        if (Test-Path $tempWasm) {
            Remove-Item $tempWasm -Force
        }
    }
}

# Update deployment state file
function Update-DeploymentState {
    param(
        [string]$ContractName,
        [string]$Address,
        [string]$Hash,
        [string]$Status
    )
    
    $timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
    
    # Create initial structure if file doesn't exist
    if (-not (Test-Path $DeploymentStateFile)) {
        $initialState = @{
            contracts = @{}
            network = $Network
            timestamp = $timestamp
        }
        $initialState | ConvertTo-Json -Depth 10 | Out-File -FilePath $DeploymentStateFile -Encoding UTF8
    }
    
    # Read current state
    $deploymentState = Get-Content $DeploymentStateFile -Raw | ConvertFrom-Json -AsHashtable
    
    # Update the contract entry
    $deploymentState.contracts[$ContractName] = @{
        address = $Address
        hash = $Hash
        status = $Status
        timestamp = $timestamp
    }
    
    # Write updated state
    $deploymentState | ConvertTo-Json -Depth 10 | Out-File -FilePath $DeploymentStateFile -Encoding UTF8
}

# Deploy all contracts in dependency order
function Deploy-AllContracts {
    Write-Status "Starting deployment of all contracts..."
    
    # Define deployment order based on dependencies
    $deploymentOrder = @("balance_ledger", "betting", "settlement", "player_card", "staking")
    
    foreach ($contract in $deploymentOrder) {
        $wasmFile = Join-Path $BuildDir "${contract}.wasm"
        $optimizedWasm = Join-Path $BuildDir "${contract}_optimized.wasm"
        
        # Use optimized WASM if available
        $finalWasm = $wasmFile
        if (Test-Path $optimizedWasm) {
            $finalWasm = $optimizedWasm
        }
        
        if (Test-Path $finalWasm) {
            if (-not (Deploy-Contract -ContractName $contract -WasmFile $wasmFile)) {
                Write-ErrorCustom "Deployment of $contract failed, stopping deployment process."
                exit 1
            }
        } else {
            Write-Warning "WASM file not found for $contract, skipping deployment"
        }
    }
    
    Write-Success "All contracts deployed successfully!"
}

# Rollback function (basic implementation)
function Invoke-Rollback {
    Write-Warning "Rollback functionality is not implemented in this version."
    Write-Status "Manual intervention required for rollback."
}

# Print deployment summary
function Show-Summary {
    Write-Status "=== Deployment Summary ==="
    
    if (Test-Path $DeploymentStateFile) {
        Write-Host "Network: $Network"
        Write-Host "Deployment file: $DeploymentStateFile"
        Write-Host ""
        Write-Host "Deployed contracts:"
        
        $deploymentState = Get-Content $DeploymentStateFile -Raw | ConvertFrom-Json -AsHashtable
        foreach ($contractName in $deploymentState.contracts.PSObject.Properties.Name) {
            $contractInfo = $deploymentState.contracts[$contractName]
            Write-Host "  $contractName`: $($contractInfo.address) ($($contractInfo.status))"
        }
    } else {
        Write-Host "No deployment state file found. No contracts have been deployed yet."
    }
    
    Write-Host ""
    Write-Success "Deployment log saved to: $LogFile"
}

# Verify existing deployments
function Test-Deployments {
    Write-Status "Verifying existing deployments..."
    
    if (-not (Test-Path $DeploymentStateFile)) {
        Write-ErrorCustom "No deployment state file found. Nothing to verify."
        return $false
    }
    
    $allGood = $true
    $deploymentState = Get-Content $DeploymentStateFile -Raw | ConvertFrom-Json -AsHashtable
    
    foreach ($contractName in $deploymentState.contracts.PSObject.Properties.Name) {
        $contractInfo = $deploymentState.contracts[$contractName]
        $address = $contractInfo.address
        $hash = $contractInfo.hash
        
        if ($address -and $hash) {
            Write-Status "Verifying $contractName at $address..."
            
            $wasmFile = Join-Path $BuildDir "${contractName}.wasm"
            $optimizedWasm = Join-Path $BuildDir "${contractName}_optimized.wasm"
            $finalWasm = $wasmFile
            
            if (Test-Path $optimizedWasm) {
                $finalWasm = $optimizedWasm
            }
            
            if (Test-Contract -ContractAddress $address -WasmFile $finalWasm) {
                Write-Success "$contractName verified successfully"
                Update-DeploymentState -ContractName $contractName -Address $address -Hash $hash -Status "verified"
            } else {
                Write-ErrorCustom "$contractName verification failed"
                Update-DeploymentState -ContractName $contractName -Address $address -Hash $hash -Status "verification_failed"
                $allGood = $false
            }
        }
    }
    
    if ($allGood) {
        Write-Success "All contracts verified successfully"
        return $true
    } else {
        Write-ErrorCustom "Some contracts failed verification"
        return $false
    }
}

# Main execution
if ($Help) {
    Write-Host "Usage: $($MyInvocation.MyCommand.Name) [OPTIONS]"
    Write-Host "Options:"
    Write-Host "  -Network         Network to deploy to (default: testnet)"
    Write-Host "  -SourceAccount   Source account for deployment (default: admin)"
    Write-Host "  -RpcUrl          RPC URL (default: https://soroban-testnet.stellar.org)"
    Write-Host "  -Passphrase      Network passphrase (default: 'Test SDF Network ; September 2015')"
    Write-Host "  -BuildOnly       Only build contracts, don't deploy"
    Write-Host "  -DeployOnly      Skip build, only deploy (assumes contracts are built)"
    Write-Host "  -OptimizeOnly    Only optimize WASM files"
    Write-Host "  -VerifyOnly      Verify deployed contracts"
    Write-Host "  -Rollback        Attempt to rollback deployment"
    Write-Host "  -Help            Show this help message"
    exit 0
}

Write-Status "Renaissance Contract Deployment Script"
Write-Host "====================================="

# Validate environment
Test-SorobanCli
Test-RustSetup

# Execute based on flags
if ($OptimizeOnly) {
    Optimize-Contracts
} elseif ($BuildOnly) {
    Build-Contracts
    Optimize-Contracts
} elseif ($DeployOnly) {
    Deploy-AllContracts
} elseif ($VerifyOnly) {
    Test-Deployments
} elseif ($Rollback) {
    Invoke-Rollback
} else {
    # Full deployment process
    Build-Contracts
    Optimize-Contracts
    Deploy-AllContracts
}

Show-Summary