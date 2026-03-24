#![no_std]

use soroban_sdk::{contractimpl, symbol, Env, Address, Symbol, u128};

#[derive(Clone)]
pub struct ProfitabilityTracker;

#[contractimpl]
impl ProfitabilityTracker {
    // Initialize counters
    pub fn init(env: Env) {
        env.storage().set(&symbol!("total_deposits"), &0u128);
        env.storage().set(&symbol!("total_payouts"), &0u128);
        env.storage().set(&symbol!("net_surplus"), &0i128); // can be negative
    }

    // Deposit event — increments total deposits
    pub fn add_deposit(env: Env, amount: u128) {
        let mut deposits: u128 = env.storage().get(&symbol!("total_deposits")).unwrap_or(0);
        deposits = deposits.checked_add(amount).expect("Deposit overflow");
        env.storage().set(&symbol!("total_deposits"), &deposits);

        // Update net surplus
        let payouts: u128 = env.storage().get(&symbol!("total_payouts")).unwrap_or(0);
        let net: i128 = deposits as i128 - payouts as i128;
        env.storage().set(&symbol!("net_surplus"), &net);
    }

    // Payout event — increments total payouts
    pub fn add_payout(env: Env, amount: u128) {
        let mut payouts: u128 = env.storage().get(&symbol!("total_payouts")).unwrap_or(0);
        payouts = payouts.checked_add(amount).expect("Payout overflow");
        env.storage().set(&symbol!("total_payouts"), &payouts);

        // Update net surplus
        let deposits: u128 = env.storage().get(&symbol!("total_deposits")).unwrap_or(0);
        let net: i128 = deposits as i128 - payouts as i128;
        env.storage().set(&symbol!("net_surplus"), &net);
    }

    // Public getters
    pub fn total_deposits(env: Env) -> u128 {
        env.storage().get(&symbol!("total_deposits")).unwrap_or(0)
    }

    pub fn total_payouts(env: Env) -> u128 {
        env.storage().get(&symbol!("total_payouts")).unwrap_or(0)
    }

    pub fn net_surplus(env: Env) -> i128 {
        env.storage().get(&symbol!("net_surplus")).unwrap_or(0)
    }

    // Emit daily snapshot event
    pub fn snapshot(env: Env) {
        let deposits = Self::total_deposits(env.clone());
        let payouts = Self::total_payouts(env.clone());
        let net = Self::net_surplus(env.clone());

        env.events().publish(
            (symbol!("DailySnapshot"),),
            (deposits, payouts, net),
        );
    }
}