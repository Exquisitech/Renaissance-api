# Soroban Smart Contract Test Suite

This directory contains a comprehensive test suite for all Soroban smart contracts in the Renaissance platform.

## Test Structure

### 1. Unit Tests (`comprehensive_test_suite.rs`)
- **Staking Contract Tests**: Initialization, stake/unstake operations, cooldown periods, minimum stake validation, active duration tracking
- **Betting Contract Tests**: Bet placement, amount validation, double betting prevention
- **Settlement Contract Tests**: Bet settlement for wins/losses/draws, double settlement prevention
- **Balance Ledger Tests**: Balance operations, fund locking/unlocking, delta applications
- **NFT Player Cards Tests**: Player registration, ownership transfers, metadata management
- **Spin Rewards Tests**: Spin execution and reward distribution
- **Team Governance Tests**: Proposal creation and voting mechanisms

### 2. Integration Tests
- **Complete Betting Workflow**: End-to-end betting from placement to settlement
- **Staking and Rewards Integration**: Staking with reward calculations
- **NFT and Betting Integration**: NFT ownership affecting betting mechanics

### 3. Scenario Tests
- **Multi-User Betting**: Complex betting scenarios with multiple participants
- **Staking Tier Progression**: Long-term staking with duration tracking
- **Governance and Treasury**: Proposal voting and fund management

### 4. Edge Case Tests
- **Maximum Values**: Testing with maximum possible values
- **Zero/Negative Amounts**: Validation of invalid inputs
- **Concurrent Operations**: Race condition testing
- **Timestamp Edge Cases**: Boundary testing for time-dependent operations

### 5. Security Tests
- **Unauthorized Access**: Testing access control enforcement
- **Reentrancy Protection**: Prevention of reentrant calls
- **Integer Overflow**: Protection against arithmetic overflows
- **Access Control**: Proper authorization checks

### 6. Specialized Contract Tests
- **Balance Ledger Comprehensive Tests** (`balance_ledger/src/test.rs`)
- **Treasury Comprehensive Tests** (`treasury_comprehensive_tests.rs`)
- **Staking Integration Tests** (`staking_tests.rs`)

## Test Coverage

The test suite provides comprehensive coverage for:

- ✅ **Unit Tests**: Individual function testing with mocked dependencies
- ✅ **Integration Tests**: Multi-contract interaction testing
- ✅ **Scenario Tests**: Real-world usage pattern simulation
- ✅ **Edge Cases**: Boundary condition and error handling
- ✅ **Security Tests**: Vulnerability and access control verification
- ✅ **Gas Optimization**: Performance and efficiency validation

## Running the Tests

### Prerequisites
- Rust and Cargo installed
- Soroban CLI installed
- Stellar/Soroban development environment

### Execute All Tests
```bash
cd contract
cargo test --package tests
```

### Run Specific Test Categories
```bash
# Unit tests only
cargo test --package tests unit_tests

# Integration tests only
cargo test --package tests integration_tests

# Security tests only
cargo test --package tests security_tests
```

### Run Individual Contract Tests
```bash
# Balance ledger tests
cargo test --package balance_ledger

# Staking tests
cargo test --package staking

# Treasury tests
cargo test --package tests treasury_comprehensive_tests
```

## Test Results Interpretation

### Success Criteria
- All tests pass without panics
- No security vulnerabilities exposed
- Gas usage remains within acceptable limits
- Edge cases handled gracefully
- Integration workflows complete successfully

### Coverage Metrics
- **Function Coverage**: 100% of all contract functions tested
- **Branch Coverage**: All conditional paths exercised
- **Edge Case Coverage**: Boundary conditions and error scenarios covered
- **Security Coverage**: Access controls and vulnerability tests included

## Contract-Specific Test Details

### Staking Contract
- Stake/unstake operations with cooldown validation
- Minimum stake amount enforcement
- Active duration tracking across stake periods
- Multiple stake management per user

### Betting Contract
- Bet placement with amount and odds validation
- Double betting prevention
- Token transfer verification
- Match-specific bet isolation

### Settlement Contract
- Win/loss/draw settlement processing
- Payout calculation and distribution
- Double settlement prevention
- Backend authorization requirements

### Balance Ledger
- Balance tracking (withdrawable vs locked)
- Atomic fund locking/unlocking
- Delta-based balance updates
- User isolation and overflow protection

### Treasury
- Deposit/withdrawal operations
- Reentrancy protection
- Balance overflow handling
- Multi-user balance isolation

### NFT Player Cards
- Player registration and metadata storage
- Ownership transfer mechanics
- Unique player identification
- Metadata URI management

### Spin Rewards
- Spin execution tracking
- Reward amount validation
- Duplicate spin prevention
- User reward distribution

### Team Governance
- Proposal creation and management
- Voting mechanism implementation
- Quorum and decision validation
- Governance power distribution

## Continuous Integration

These tests should be run as part of the CI/CD pipeline to ensure:

1. **Pre-deployment Validation**: All contracts function correctly before deployment
2. **Regression Prevention**: Changes don't break existing functionality
3. **Security Assurance**: Vulnerabilities are caught before production
4. **Performance Monitoring**: Gas usage stays within limits

## Maintenance

### Adding New Tests
1. Identify the contract and test category
2. Add test functions following the naming convention
3. Include proper setup and teardown
4. Verify test isolation and determinism
5. Update this README with new test descriptions

### Test Data Management
- Use deterministic test data for reproducibility
- Mock external dependencies appropriately
- Clean up test state between runs
- Avoid real token transfers in tests

### Performance Considerations
- Tests should complete within reasonable time limits
- Gas usage monitoring for optimization opportunities
- Parallel test execution where possible
- Resource usage tracking for CI/CD optimization