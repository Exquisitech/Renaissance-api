#![no_std]

use common::errors::ContractError;
use common::events::{create_stake_event, create_unstake_event, STAKE_EVENT, UNSTAKE_EVENT};
use soroban_sdk::{contract, contractimpl, token, Address, Env, U256};

pub mod storage;
use storage::{DataKey, StakeData};

// Helper to keep per-user active staking duration up to date whenever their
// total staked amount changes between zero and non-zero.
fn update_user_active_duration_on_change(
    env: &Env,
    user: &Address,
    old_total: i128,
    new_total: i128,
) {
    let was_active = old_total > 0;
    let is_active = new_total > 0;

    // Only care about transitions between inactive (0) and active (>0)
    if was_active == is_active {
        return;
    }

    let now = env.ledger().timestamp();
    let active_since_key = DataKey::ActiveSince(user.clone());
    let total_duration_key = DataKey::TotalStakeDuration(user.clone());

    if !was_active && is_active {
        // User becomes active: remember when they started this active period.
        env.storage().persistent().set(&active_since_key, &now);
    } else if was_active && !is_active {
        // User stops being active: add the elapsed time to their total duration.
        let maybe_active_since: Option<u64> = env.storage().persistent().get(&active_since_key);
        if let Some(active_since) = maybe_active_since {
            let elapsed = now - active_since;
            let total_duration: u64 = env
                .storage()
                .persistent()
                .get(&total_duration_key)
                .unwrap_or(0);
            env.storage()
                .persistent()
                .set(&total_duration_key, &(total_duration + elapsed));
            env.storage().persistent().remove(&active_since_key);
        }
    }
}

#[contract]
pub struct StakingContract;

#[contractimpl]
impl StakingContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        staking_token: Address,
        min_stake: i128,
        cooldown_period: u64,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::StakingToken, &staking_token);
        env.storage().instance().set(&DataKey::MinStake, &min_stake);
        env.storage()
            .instance()
            .set(&DataKey::CooldownPeriod, &cooldown_period);

        Ok(())
    }

    pub fn update_config(
        env: Env,
        admin: Address,
        min_stake: Option<i128>,
        cooldown_period: Option<u64>,
    ) -> Result<(), ContractError> {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        if admin != stored_admin {
            return Err(ContractError::Unauthorized);
        }

        if let Some(min) = min_stake {
            env.storage().instance().set(&DataKey::MinStake, &min);
        }
        if let Some(cooldown) = cooldown_period {
            env.storage()
                .instance()
                .set(&DataKey::CooldownPeriod, &cooldown);
        }

        Ok(())
    }

    pub fn stake(env: Env, user: Address, amount: i128) -> Result<U256, ContractError> {
        user.require_auth();

        let staking_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::StakingToken)
            .ok_or(ContractError::NotInitialized)?;
        let min_stake: i128 = env.storage().instance().get(&DataKey::MinStake).unwrap();

        if amount < min_stake {
            return Err(ContractError::BelowMinStake);
        }

        // Transfer tokens to contract
        let token_client = token::Client::new(&env, &staking_token);
        token_client.transfer(&user, env.current_contract_address(), &amount);

        // Generate stake ID based on user nonce
        let nonce_key = DataKey::StakeNonce(user.clone());
        let nonce: u32 = env.storage().persistent().get(&nonce_key).unwrap_or(0);
        env.storage().persistent().set(&nonce_key, &(nonce + 1));
        let stake_id = U256::from_u32(&env, nonce);

        let timestamp = env.ledger().timestamp();

        // Record the stake
        let stake_data = StakeData { amount, timestamp };
        env.storage().persistent().set(
            &DataKey::UserStake(user.clone(), stake_id.clone()),
            &stake_data,
        );

        // Update total stake and per-user active duration
        let total_key = DataKey::TotalStake(user.clone());
        let current_total: i128 = env.storage().persistent().get(&total_key).unwrap_or(0);
        let new_total = current_total + amount;

        update_user_active_duration_on_change(&env, &user, current_total, new_total);

        env.storage().persistent().set(&total_key, &new_total);

        // Emit Event
        let mut event = create_stake_event(
            user.clone(),
            amount,
            staking_token,
            env.current_contract_address(),
            stake_id.clone(),
        );
        event.timestamp = timestamp;
        #[allow(deprecated)] // keep (topic, user) format for indexer compatibility
        env.events().publish((STAKE_EVENT, user.clone()), event);

        Ok(stake_id)
    }

    pub fn unstake(env: Env, user: Address, stake_id: U256) -> Result<(), ContractError> {
        user.require_auth();

        let staking_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::StakingToken)
            .ok_or(ContractError::NotInitialized)?;
        let cooldown_period: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CooldownPeriod)
            .unwrap();

        let stake_key = DataKey::UserStake(user.clone(), stake_id.clone());
        let stake_data: StakeData = env
            .storage()
            .persistent()
            .get(&stake_key)
            .ok_or(ContractError::StakeNotFound)?;

        let current_time = env.ledger().timestamp();
        if current_time < stake_data.timestamp + cooldown_period {
            return Err(ContractError::CooldownNotMet);
        }

        // Remove the stake
        env.storage().persistent().remove(&stake_key);

        // Update total stake and per-user active duration
        let total_key = DataKey::TotalStake(user.clone());
        let current_total: i128 = env.storage().persistent().get(&total_key).unwrap_or(0);
        let new_total = current_total - stake_data.amount;

        update_user_active_duration_on_change(&env, &user, current_total, new_total);

        if new_total > 0 {
            env.storage().persistent().set(&total_key, &new_total);
        } else {
            env.storage().persistent().remove(&total_key);
        }

        // Transfer tokens back to user
        let token_client = token::Client::new(&env, &staking_token);
        token_client.transfer(&env.current_contract_address(), &user, &stake_data.amount);

        // Emit Event
        let mut event = create_unstake_event(
            user.clone(),
            stake_data.amount,
            staking_token,
            env.current_contract_address(),
            stake_id,
            0, // Rewards are not implemented in this version, hardcode 0
        );
        event.timestamp = current_time;
        #[allow(deprecated)] // keep (topic, user) format for indexer compatibility
        env.events().publish((UNSTAKE_EVENT, user.clone()), event);

        Ok(())
    }

    pub fn get_total_stake(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalStake(user))
            .unwrap_or(0)
    }

    pub fn get_stake(env: Env, user: Address, stake_id: U256) -> Result<StakeData, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::UserStake(user, stake_id))
            .ok_or(ContractError::StakeNotFound)
    }

    // Returns the cumulative active staking duration for a user in seconds.
    // This is the total time the user has had a non-zero total staked balance.
    pub fn get_user_active_duration(env: Env, user: Address) -> u64 {
        let total_key = DataKey::TotalStake(user.clone());
        let current_total: i128 = env.storage().persistent().get(&total_key).unwrap_or(0);

        let total_duration_key = DataKey::TotalStakeDuration(user.clone());
        let mut total_duration: u64 = env
            .storage()
            .persistent()
            .get(&total_duration_key)
            .unwrap_or(0);

        if current_total > 0 {
            let active_since_key = DataKey::ActiveSince(user.clone());
            let maybe_active_since: Option<u64> = env.storage().persistent().get(&active_since_key);
            if let Some(active_since) = maybe_active_since {
                let now = env.ledger().timestamp();
                total_duration += now - active_since;
            }
        }

        total_duration
    }

    // Returns the active duration (in seconds) for a specific stake position.
    // This is a simple "now - timestamp" calculation with no on-chain loops.
    pub fn get_stake_duration(
        env: Env,
        user: Address,
        stake_id: U256,
    ) -> Result<u64, ContractError> {
        let stake_data: StakeData = env
            .storage()
            .persistent()
            .get(&DataKey::UserStake(user, stake_id))
            .ok_or(ContractError::StakeNotFound)?;
        let now = env.ledger().timestamp();
        Ok(now - stake_data.timestamp)
    }
}

#[cfg(test)]
mod test;

mod fixed_term;
mod fixed_storage;
mod fixed_types;
mod fixed_errors;
mod fixed_events;

use fixed_term::FixedLockStaking;
