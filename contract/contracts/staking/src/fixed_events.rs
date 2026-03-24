use soroban_sdk::{symbol_short, Env, Address};

pub fn fixed_stake_event(env: &Env, user: &Address, amount: i128, duration: u64) {
    env.events().publish(
        (symbol_short!("fx_stake"), user),
        (amount, duration),
    );
}

pub fn fixed_unstake_event(env: &Env, user: &Address, reward: i128) {
    env.events().publish(
        (symbol_short!("fx_unstake"), user),
        reward,
    );
}