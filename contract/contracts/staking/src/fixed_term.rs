#![no_std]

use soroban_sdk::{
    Env, Address, panic_with_error
};

use crate::fixed_storage::FixedDataKey;
use crate::fixed_types::FixedStakePosition;
use crate::fixed_errors::FixedStakingError;
use crate::fixed_events;

const SEVEN_DAYS: u64 = 604800;
const THIRTY_DAYS: u64 = 2592000;
const NINETY_DAYS: u64 = 7776000;

const MULT_7: u32 = 110;
const MULT_30: u32 = 130;
const MULT_90: u32 = 160;

pub struct FixedLockStaking;

impl FixedLockStaking {

    pub fn stake(
        env: &Env,
        user: Address,
        amount: i128,
        duration: u64,
    ) {
        user.require_auth();

        if amount <= 0 {
            panic!("Invalid stake amount");
        }

        let key = FixedDataKey::FixedStake(user.clone());

        if env.storage().instance().has(&key) {
            panic_with_error!(env, FixedStakingError::StakeAlreadyExists);
        }

        let multiplier = match duration {
            SEVEN_DAYS => MULT_7,
            THIRTY_DAYS => MULT_30,
            NINETY_DAYS => MULT_90,
            _ => panic_with_error!(env, FixedStakingError::InvalidDuration),
        };

        let current_time = env.ledger().timestamp();

        let stake = FixedStakePosition {
            staker: user.clone(),
            amount,
            start_time: current_time,
            lock_duration: duration,
            multiplier,
        };

        env.storage().instance().set(&key, &stake);

        fixed_events::fixed_stake_event(env, &user, amount, duration);
    }

    pub fn unstake(env: &Env, user: Address) -> i128 {
        user.require_auth();

        let key = FixedDataKey::FixedStake(user.clone());

        if !env.storage().instance().has(&key) {
            panic_with_error!(env, FixedStakingError::NoActiveStake);
        }

        let stake: FixedStakePosition =
            env.storage().instance().get(&key).unwrap();

        let now = env.ledger().timestamp();

        if now < stake.start_time + stake.lock_duration {
            panic_with_error!(env, FixedStakingError::LockNotExpired);
        }

        let reward =
            (stake.amount * stake.multiplier as i128) / 100;

        env.storage().instance().remove(&key);

        fixed_events::fixed_unstake_event(env, &user, reward);

        reward
    }

    pub fn get_stake(env: &Env, user: Address)
        -> Option<FixedStakePosition>
    {
        env.storage().instance().get(
            &FixedDataKey::FixedStake(user)
        )
    }
}