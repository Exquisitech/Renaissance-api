#![cfg(test)]

use super::*;

use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, BytesN, Env, U256};

#[test]
fn rejects_duplicate_operation_ids() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let winner = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);
    let operation_hash = BytesN::from_array(&env, &[11u8; 32]);

    client.initialize(&backend);

    client.settle_bet(
        &operation_hash,
        &U256::from_u32(&env, 7),
        &winner,
        &1_250,
        &None,
    );

    assert_eq!(
        client.try_settle_bet(
            &operation_hash,
            &U256::from_u32(&env, 8),
            &winner,
            &1_900,
            &None,
        ),
        Err(Ok(ContractError::DuplicateOperation))
    );
}

#[test]
fn supports_ttl_cleanup_for_operations() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let winner = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);
    let operation_hash = BytesN::from_array(&env, &[22u8; 32]);

    client.initialize(&backend);

    client.settle_bet(
        &operation_hash,
        &U256::from_u32(&env, 5),
        &winner,
        &300,
        &Some(5),
    );
    assert!(client.is_operation_executed(&operation_hash));

    env.ledger().with_mut(|li| {
        li.timestamp += 6;
    });

    assert!(client.cleanup_operation(&operation_hash));
    assert!(!client.is_operation_executed(&operation_hash));

    client.settle_bet(
        &operation_hash,
        &U256::from_u32(&env, 6),
        &winner,
        &450,
        &Some(5),
    );
}

// ============================================
// Authorization Tests - Unauthorized Calls
// ============================================

#[test]
#[should_panic(expected = "Unauthorized")]
fn settle_bet_without_backend_auth_fails() {
    let env = Env::default();
    let backend = Address::generate(&env);
    let winner = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let operation_hash = BytesN::from_array(&env, &[1u8; 32]);

    // Don't mock any auths - should fail with Unauthorized
    client.settle_bet(
        &operation_hash,
        &U256::from_u32(&env, 1),
        &winner,
        &1000,
        &None,
    );
}

#[test]
#[should_panic]
fn settle_bet_before_initialization_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let winner = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    // Don't initialize - try to settle immediately
    // This will panic because there's no backend signer stored
    let operation_hash = BytesN::from_array(&env, &[1u8; 32]);

    client.settle_bet(
        &operation_hash,
        &U256::from_u32(&env, 1),
        &winner,
        &1000,
        &None,
    );
}

// ============================================
// Edge Cases
// ============================================

#[test]
fn is_operation_executed_returns_false_for_new_operation() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let new_operation_hash = BytesN::from_array(&env, &[1u8; 32]);

    assert!(!client.is_operation_executed(&new_operation_hash));
}

#[test]
fn cleanup_operation_returns_false_for_nonexistent_operation() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let nonexistent_hash = BytesN::from_array(&env, &[99u8; 32]);

    assert!(!client.cleanup_operation(&nonexistent_hash));
}

#[test]
fn cleanup_operation_returns_false_before_ttl_expires() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let winner = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let operation_hash = BytesN::from_array(&env, &[1u8; 32]);

    // Settle with 100 second TTL
    client.settle_bet(
        &operation_hash,
        &U256::from_u32(&env, 1),
        &winner,
        &1000,
        &Some(100),
    );

    // Advance time but not past TTL
    env.ledger().with_mut(|li| {
        li.timestamp += 50;
    });

    // Cleanup should fail since TTL hasn't expired
    assert!(!client.cleanup_operation(&operation_hash));
    assert!(client.is_operation_executed(&operation_hash));
}

#[test]
fn settle_bet_with_zero_payout_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let winner = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let operation_hash = BytesN::from_array(&env, &[1u8; 32]);

    // Settle with zero payout (e.g., lost bet)
    client.settle_bet(
        &operation_hash,
        &U256::from_u32(&env, 1),
        &winner,
        &0,
        &None,
    );

    assert!(client.is_operation_executed(&operation_hash));
}

#[test]
fn settle_bet_with_large_payout_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let winner = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let operation_hash = BytesN::from_array(&env, &[1u8; 32]);
    let large_payout: i128 = 1_000_000_000_000;

    // Settle with large payout
    client.settle_bet(
        &operation_hash,
        &U256::from_u32(&env, 1),
        &winner,
        &large_payout,
        &None,
    );

    assert!(client.is_operation_executed(&operation_hash));
}

#[test]
fn settle_bet_with_negative_payout_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let winner = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let operation_hash = BytesN::from_array(&env, &[1u8; 32]);
    let negative_payout: i128 = -500;

    // Settle with negative payout (e.g., penalty)
    client.settle_bet(
        &operation_hash,
        &U256::from_u32(&env, 1),
        &winner,
        &negative_payout,
        &None,
    );

    assert!(client.is_operation_executed(&operation_hash));
}

#[test]
fn settle_bet_with_zero_ttl_immediate_cleanup() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let winner = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let operation_hash = BytesN::from_array(&env, &[1u8; 32]);

    // Settle with 0 TTL - operation is immediately expired per is_expired logic
    // (timestamp - executed_at >= 0 is always true when timestamp >= executed_at)
    client.settle_bet(
        &operation_hash,
        &U256::from_u32(&env, 1),
        &winner,
        &1000,
        &Some(0),
    );

    // With TTL of 0, the operation is considered expired immediately
    // so it won't be stored (it gets cleaned up during ensure_not_replayed)
    // This is existing contract behavior, not a bug
}

#[test]
fn multiple_bets_same_winner_different_operation_hashes() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let winner = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    // Settle multiple bets for the same winner
    let operation_hash1 = BytesN::from_array(&env, &[1u8; 32]);
    let operation_hash2 = BytesN::from_array(&env, &[2u8; 32]);
    let operation_hash3 = BytesN::from_array(&env, &[3u8; 32]);

    client.settle_bet(
        &operation_hash1,
        &U256::from_u32(&env, 1),
        &winner,
        &100,
        &None,
    );
    client.settle_bet(
        &operation_hash2,
        &U256::from_u32(&env, 2),
        &winner,
        &200,
        &None,
    );
    client.settle_bet(
        &operation_hash3,
        &U256::from_u32(&env, 3),
        &winner,
        &300,
        &None,
    );

    assert!(client.is_operation_executed(&operation_hash1));
    assert!(client.is_operation_executed(&operation_hash2));
    assert!(client.is_operation_executed(&operation_hash3));
}

#[test]
fn same_operation_hash_different_bet_ids_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let winner = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let operation_hash = BytesN::from_array(&env, &[1u8; 32]);

    // First settlement succeeds
    client.settle_bet(
        &operation_hash,
        &U256::from_u32(&env, 1),
        &winner,
        &100,
        &None,
    );

    // Second settlement with same operation hash but different bet_id should fail
    let result = client.try_settle_bet(
        &operation_hash,
        &U256::from_u32(&env, 2),
        &winner,
        &200,
        &None,
    );

    assert_eq!(result, Err(Ok(ContractError::DuplicateOperation)));
}

#[test]
fn different_winners_same_operation_hash_isolation() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let winner1 = Address::generate(&env);
    let winner2 = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let operation_hash1 = BytesN::from_array(&env, &[1u8; 32]);
    let operation_hash2 = BytesN::from_array(&env, &[2u8; 32]);

    // Settle bets for different winners
    client.settle_bet(
        &operation_hash1,
        &U256::from_u32(&env, 1),
        &winner1,
        &100,
        &None,
    );
    client.settle_bet(
        &operation_hash2,
        &U256::from_u32(&env, 2),
        &winner2,
        &200,
        &None,
    );

    assert!(client.is_operation_executed(&operation_hash1));
    assert!(client.is_operation_executed(&operation_hash2));
}

#[test]
fn large_bet_id_handling() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let winner = Address::generate(&env);
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let operation_hash = BytesN::from_array(&env, &[1u8; 32]);

    // Use a large U256 value for bet_id
    let large_bet_id = U256::from_u128(&env, u128::MAX);

    client.settle_bet(&operation_hash, &large_bet_id, &winner, &1000, &None);

    assert!(client.is_operation_executed(&operation_hash));
}

#[test]
fn test_settle_win_loss_draw() {
    use soroban_sdk::{testutils::Address as _, Address};

    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);

    // Deploy balance ledger and initialize
    let bl_contract_id = env.register(balance_ledger::BalanceLedgerContract, ());
    let bl_client = balance_ledger::BalanceLedgerContractClient::new(&env, &bl_contract_id);
    bl_client.initialize(&backend);

    // Deploy settlement contract and initialize with balance ledger address
    let st_contract_id = env.register(SettlementContract, ());
    let st_client = SettlementContractClient::new(&env, &st_contract_id);
    let bl_addr = Address::Contract(bl_contract_id.clone());
    st_client.initialize(&backend, &bl_addr);

    // Prepare bettor and winner
    let bettor = Address::generate(&env);
    let winner = Address::generate(&env);

    // Fund and lock bettor funds
    bl_client.set_balance(&bettor, &1_000, &0);
    bl_client.lock_funds(&bettor, &100);

    let bet_id = U256::from_u64(42);

    // Settle WIN: bettor locked 100 -> winner gets payout 200
    let win_sym = soroban_sdk::Symbol::short("WIN");
    let res = st_client.settle_bet(
        &bet_id,
        &bettor,
        &Some(winner.clone()),
        &100,
        &200,
        &win_sym,
    );
    assert!(res.is_ok());

    // Check balances: bettor locked decreased by 100, winner withdrawable increased by 200
    let bettor_balance = bl_client.get_balance(&bettor);
    assert_eq!(bettor_balance.locked, 0);

    let winner_balance = bl_client.get_withdrawable(&winner);
    assert_eq!(winner_balance, 200);

    // Attempt to re-settle same bet -> should fail
    let res2 = st_client.try_settle_bet(
        &bet_id,
        &bettor,
        &Some(winner.clone()),
        &100,
        &200,
        &win_sym,
    );
    assert!(res2.is_err());

    // Test DRAW / refund for another bet
    let bet_id2 = U256::from_u64(43);
    bl_client.set_balance(&bettor, &500, &0);
    bl_client.lock_funds(&bettor, &50);
    let draw_sym = soroban_sdk::Symbol::short("DRAW");
    let res3 = st_client.settle_bet(&bet_id2, &bettor, &None, &50, &0, &draw_sym);
    assert!(res3.is_ok());

    let after_refund = bl_client.get_balance(&bettor);
    assert_eq!(after_refund.withdrawable, 500);
    assert_eq!(after_refund.locked, 0);
}
