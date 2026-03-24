#![cfg(test)]

use soroban_sdk::{Env, Address};
use treasury_allocation::{TreasuryAllocation, AllocationRatios};

#[test]
fn test_rebalance() {
    let env = Env::default();
    let admin = Address::random(&env);

    TreasuryAllocation::init(env.clone(), admin.clone(), 1000);

    // Rebalance
    TreasuryAllocation::rebalance(env.clone(), admin.clone());

    let betting = TreasuryAllocation::get_pool_balance(env.clone(), soroban_sdk::symbol!("betting_pool"));
    let spin = TreasuryAllocation::get_pool_balance(env.clone(), soroban_sdk::symbol!("spin_rewards"));
    let staking = TreasuryAllocation::get_pool_balance(env.clone(), soroban_sdk::symbol!("staking_rewards"));
    let emergency = TreasuryAllocation::get_pool_balance(env.clone(), soroban_sdk::symbol!("emergency_reserve"));

    assert_eq!(betting, 400);
    assert_eq!(spin, 300);
    assert_eq!(staking, 200);
    assert_eq!(emergency, 100);

    // Update ratios and rebalance again
    TreasuryAllocation::update_ratios(env.clone(), admin.clone(), AllocationRatios {
        betting_pool: 25,
        spin_rewards: 25,
        staking_rewards: 25,
        emergency_reserve: 25,
    });

    TreasuryAllocation::rebalance(env.clone(), admin.clone());

    let betting = TreasuryAllocation::get_pool_balance(env.clone(), soroban_sdk::symbol!("betting_pool"));
    assert_eq!(betting, 250);
}