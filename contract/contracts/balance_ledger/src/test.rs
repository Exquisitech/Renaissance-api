#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn initialize_only_once() {
    let env = Env::default();
    let backend = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);
    assert_eq!(
        client.try_initialize(&backend),
        Err(Ok(BalanceLedgerError::AlreadyInitialized))
    );
}

#[test]
fn set_and_query_split_balances() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);
    let updated = client.set_balance(&user, &1_000, &250);

    assert_eq!(
        updated,
        UserBalance {
            withdrawable: 1_000,
            locked: 250,
        }
    );
    assert_eq!(client.get_withdrawable(&user), 1_000);
    assert_eq!(client.get_locked(&user), 250);
    assert_eq!(client.get_total(&user), 1_250);
    assert_eq!(client.get_balance(&user), updated);
}

#[test]
fn lock_and_unlock_funds_atomically() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);
    client.set_balance(&user, &500, &100);

    let locked = client.lock_funds(&user, &200);
    assert_eq!(locked.withdrawable, 300);
    assert_eq!(locked.locked, 300);

    let unlocked = client.unlock_funds(&user, &50);
    assert_eq!(unlocked.withdrawable, 350);
    assert_eq!(unlocked.locked, 250);
}

#[test]
fn apply_delta_updates_both_buckets_atomically() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);
    client.set_balance(&user, &200, &75);

    let updated = client.apply_delta(&user, &-25, &125);
    assert_eq!(updated.withdrawable, 175);
    assert_eq!(updated.locked, 200);
}

#[test]
fn rejects_invalid_or_insufficient_updates() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);
    client.set_balance(&user, &100, &10);

    assert_eq!(
        client.try_set_balance(&user, &-1, &10),
        Err(Ok(BalanceLedgerError::InvalidAmount))
    );
    assert_eq!(
        client.try_lock_funds(&user, &101),
        Err(Ok(BalanceLedgerError::InsufficientWithdrawable))
    );
    assert_eq!(
        client.try_unlock_funds(&user, &11),
        Err(Ok(BalanceLedgerError::InsufficientLocked))
    );
    assert_eq!(
        client.try_apply_delta(&user, &-101, &0),
        Err(Ok(BalanceLedgerError::InsufficientWithdrawable))
    );
}

#[test]
fn records_cumulative_user_metrics() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let first = client.record_metrics(&user, &100, &0, &100);
    assert_eq!(
        first,
        UserMetrics {
            total_staked: 100,
            total_won: 0,
            total_lost: 100,
        }
    );

    let second = client.record_metrics(&user, &250, &400, &0);
    assert_eq!(
        second,
        UserMetrics {
            total_staked: 350,
            total_won: 400,
            total_lost: 100,
        }
    );

    assert_eq!(client.get_metrics(&user), second);
}

#[test]
fn rejects_negative_metric_deltas() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    assert_eq!(
        client.try_record_metrics(&user, &-1, &0, &0),
        Err(Ok(BalanceLedgerError::InvalidAmount))
    );
    assert_eq!(
        client.try_record_metrics(&user, &0, &-1, &0),
        Err(Ok(BalanceLedgerError::InvalidAmount))
    );
    assert_eq!(
        client.try_record_metrics(&user, &0, &0, &-1),
        Err(Ok(BalanceLedgerError::InvalidAmount))
    );
}

// ============================================
// Overflow Protection Tests
// ============================================

#[test]
fn get_total_prevents_overflow() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    // Set balance close to i128::MAX
    let max = i128::MAX;
    let half_max = max / 2;
    client.set_balance(&user, &half_max, &half_max);

    // get_total should overflow since half_max + half_max > i128::MAX (roughly)
    // Actually half_max + half_max = max - 1, which is fine
    // Let's set values that will definitely overflow
    client.set_balance(&user, &max, &1);

    let result = client.try_get_total(&user);
    assert_eq!(result, Err(Ok(BalanceLedgerError::Overflow)));
}

#[test]
fn record_metrics_prevents_overflow() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    // Set metrics close to max
    let large_value = i128::MAX - 100;
    client.record_metrics(&user, &large_value, &0, &0);

    // Adding more should overflow
    let result = client.try_record_metrics(&user, &101, &0, &0);
    assert_eq!(result, Err(Ok(BalanceLedgerError::Overflow)));
}

#[test]
fn record_metrics_prevents_overflow_on_won() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let large_value = i128::MAX - 50;
    client.record_metrics(&user, &0, &large_value, &0);

    let result = client.try_record_metrics(&user, &0, &51, &0);
    assert_eq!(result, Err(Ok(BalanceLedgerError::Overflow)));
}

#[test]
fn record_metrics_prevents_overflow_on_lost() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let large_value = i128::MAX - 200;
    client.record_metrics(&user, &0, &0, &large_value);

    let result = client.try_record_metrics(&user, &0, &0, &201);
    assert_eq!(result, Err(Ok(BalanceLedgerError::Overflow)));
}

#[test]
fn apply_delta_prevents_overflow_on_withdrawable() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    // Set withdrawable close to max
    let large_value = i128::MAX - 100;
    client.set_balance(&user, &large_value, &0);

    // Adding more should overflow
    let result = client.try_apply_delta(&user, &101, &0);
    assert_eq!(result, Err(Ok(BalanceLedgerError::Overflow)));
}

#[test]
fn apply_delta_prevents_overflow_on_locked() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let large_value = i128::MAX - 50;
    client.set_balance(&user, &0, &large_value);

    let result = client.try_apply_delta(&user, &0, &51);
    assert_eq!(result, Err(Ok(BalanceLedgerError::Overflow)));
}

// ============================================
// Authorization Tests
// ============================================

#[test]
#[should_panic]
fn set_balance_without_backend_auth_fails() {
    let env = Env::default();
    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    // Don't mock auths - should fail
    client.set_balance(&user, &1000, &500);
}

#[test]
#[should_panic]
fn apply_delta_without_backend_auth_fails() {
    let env = Env::default();
    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    // Don't mock auths - should fail
    client.apply_delta(&user, &100, &-50);
}

#[test]
#[should_panic]
fn lock_funds_without_backend_auth_fails() {
    let env = Env::default();
    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    // Don't mock auths - should fail
    client.lock_funds(&user, &100);
}

#[test]
#[should_panic]
fn unlock_funds_without_backend_auth_fails() {
    let env = Env::default();
    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    // Don't mock auths - should fail
    client.unlock_funds(&user, &100);
}

#[test]
#[should_panic]
fn record_metrics_without_backend_auth_fails() {
    let env = Env::default();
    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    // Don't mock auths - should fail
    client.record_metrics(&user, &100, &50, &25);
}

// ============================================
// Edge Cases
// ============================================

#[test]
fn lock_funds_with_zero_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);
    client.set_balance(&user, &1000, &0);

    let result = client.try_lock_funds(&user, &0);
    assert_eq!(result, Err(Ok(BalanceLedgerError::InvalidAmount)));
}

#[test]
fn unlock_funds_with_zero_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);
    client.set_balance(&user, &0, &1000);

    let result = client.try_unlock_funds(&user, &0);
    assert_eq!(result, Err(Ok(BalanceLedgerError::InvalidAmount)));
}

#[test]
fn lock_funds_with_negative_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);
    client.set_balance(&user, &1000, &0);

    let result = client.try_lock_funds(&user, &-100);
    assert_eq!(result, Err(Ok(BalanceLedgerError::InvalidAmount)));
}

#[test]
fn unlock_funds_with_negative_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);
    client.set_balance(&user, &0, &1000);

    let result = client.try_unlock_funds(&user, &-100);
    assert_eq!(result, Err(Ok(BalanceLedgerError::InvalidAmount)));
}

#[test]
fn set_balance_with_negative_locked_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let result = client.try_set_balance(&user, &100, &-50);
    assert_eq!(result, Err(Ok(BalanceLedgerError::InvalidAmount)));
}

#[test]
fn get_balance_returns_zero_for_new_user() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let new_user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let balance = client.get_balance(&new_user);
    assert_eq!(balance.withdrawable, 0);
    assert_eq!(balance.locked, 0);
}

#[test]
fn get_metrics_returns_zero_for_new_user() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let new_user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    let metrics = client.get_metrics(&new_user);
    assert_eq!(metrics.total_staked, 0);
    assert_eq!(metrics.total_won, 0);
    assert_eq!(metrics.total_lost, 0);
}

#[test]
fn get_withdrawable_returns_zero_for_new_user() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let new_user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    assert_eq!(client.get_withdrawable(&new_user), 0);
}

#[test]
fn get_locked_returns_zero_for_new_user() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let new_user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    assert_eq!(client.get_locked(&new_user), 0);
}

#[test]
fn get_total_returns_zero_for_new_user() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let new_user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    assert_eq!(client.get_total(&new_user), 0);
}

#[test]
fn apply_delta_with_zero_values_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);
    client.set_balance(&user, &500, &200);

    let updated = client.apply_delta(&user, &0, &0);
    assert_eq!(updated.withdrawable, 500);
    assert_eq!(updated.locked, 200);
}

#[test]
fn multiple_users_balances_isolated() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    // Set different balances for each user
    client.set_balance(&user1, &1000, &500);
    client.set_balance(&user2, &2000, &1000);
    client.set_balance(&user3, &0, &0);

    // Verify isolation
    let balance1 = client.get_balance(&user1);
    let balance2 = client.get_balance(&user2);
    let balance3 = client.get_balance(&user3);

    assert_eq!(balance1.withdrawable, 1000);
    assert_eq!(balance1.locked, 500);

    assert_eq!(balance2.withdrawable, 2000);
    assert_eq!(balance2.locked, 1000);

    assert_eq!(balance3.withdrawable, 0);
    assert_eq!(balance3.locked, 0);

    // Modify one user, verify others unchanged
    client.lock_funds(&user1, &200);

    let balance1_after = client.get_balance(&user1);
    let balance2_after = client.get_balance(&user2);

    assert_eq!(balance1_after.withdrawable, 800);
    assert_eq!(balance1_after.locked, 700);

    assert_eq!(balance2_after.withdrawable, 2000);
    assert_eq!(balance2_after.locked, 1000);
}

#[test]
fn record_metrics_with_zero_deltas_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);

    // First record some metrics
    client.record_metrics(&user, &100, &50, &25);

    // Record zero deltas
    let metrics = client.record_metrics(&user, &0, &0, &0);

    assert_eq!(metrics.total_staked, 100);
    assert_eq!(metrics.total_won, 50);
    assert_eq!(metrics.total_lost, 25);
}

#[test]
fn lock_exact_withdrawable_amount_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);
    client.set_balance(&user, &500, &0);

    // Lock exactly the withdrawable amount
    let result = client.lock_funds(&user, &500);
    assert_eq!(result.withdrawable, 0);
    assert_eq!(result.locked, 500);
}

#[test]
fn unlock_exact_locked_amount_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(BalanceLedgerContract, ());
    let client = BalanceLedgerContractClient::new(&env, &contract_id);

    client.initialize(&backend);
    client.set_balance(&user, &0, &500);

    // Unlock exactly the locked amount
    let result = client.unlock_funds(&user, &500);
    assert_eq!(result.withdrawable, 500);
    assert_eq!(result.locked, 0);
}
