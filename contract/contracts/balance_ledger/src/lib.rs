#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, Symbol};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BalanceLedgerError {
    Unauthorized = 1,
    AlreadyInitialized = 2,
    InvalidAmount = 3,
    InsufficientWithdrawable = 4,
    InsufficientLocked = 5,
    Overflow = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserBalance {
    pub withdrawable: i128,
    pub locked: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserMetrics {
    pub total_staked: i128,
    pub total_won: i128,
    pub total_lost: i128,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    BackendSigner,
    Balance(Address),
    Metrics(Address),
}

#[contract]
pub struct BalanceLedgerContract;

#[contractimpl]
impl BalanceLedgerContract {
    pub fn initialize(env: Env, backend_signer: Address) -> Result<(), BalanceLedgerError> {
        let storage = env.storage().persistent();

        if storage.has(&DataKey::BackendSigner) {
            return Err(BalanceLedgerError::AlreadyInitialized);
        }

        storage.set(&DataKey::BackendSigner, &backend_signer);
        Ok(())
    }

    pub fn set_balance(
        env: Env,
        user: Address,
        withdrawable: i128,
        locked: i128,
    ) -> Result<UserBalance, BalanceLedgerError> {
        Self::require_backend_auth(&env)?;
        validate_non_negative(withdrawable)?;
        validate_non_negative(locked)?;

        let previous = get_user_balance(&env, &user);
        let updated = UserBalance {
            withdrawable,
            locked,
        };

        store_user_balance(&env, &user, &updated);
        publish_balance_updated_event(&env, &user, &previous, &updated);

        Ok(updated)
    }

    pub fn apply_delta(
        env: Env,
        user: Address,
        withdrawable_delta: i128,
        locked_delta: i128,
    ) -> Result<UserBalance, BalanceLedgerError> {
        Self::require_backend_auth(&env)?;

        let previous = get_user_balance(&env, &user);
        let updated = apply_balance_delta(&previous, withdrawable_delta, locked_delta)?;

        store_user_balance(&env, &user, &updated);
        publish_balance_updated_event(&env, &user, &previous, &updated);

        Ok(updated)
    }

    pub fn lock_funds(
        env: Env,
        user: Address,
        amount: i128,
    ) -> Result<UserBalance, BalanceLedgerError> {
        Self::require_backend_auth(&env)?;
        validate_positive(amount)?;

        let previous = get_user_balance(&env, &user);
        if previous.withdrawable < amount {
            return Err(BalanceLedgerError::InsufficientWithdrawable);
        }

        let updated = apply_balance_delta(&previous, -amount, amount)?;

        store_user_balance(&env, &user, &updated);
        publish_balance_updated_event(&env, &user, &previous, &updated);

        Ok(updated)
    }

    pub fn unlock_funds(
        env: Env,
        user: Address,
        amount: i128,
    ) -> Result<UserBalance, BalanceLedgerError> {
        Self::require_backend_auth(&env)?;
        validate_positive(amount)?;

        let previous = get_user_balance(&env, &user);
        if previous.locked < amount {
            return Err(BalanceLedgerError::InsufficientLocked);
        }

        let updated = apply_balance_delta(&previous, amount, -amount)?;

        store_user_balance(&env, &user, &updated);
        publish_balance_updated_event(&env, &user, &previous, &updated);

        Ok(updated)
    }

    pub fn get_balance(env: Env, user: Address) -> UserBalance {
        get_user_balance(&env, &user)
    }

    pub fn get_withdrawable(env: Env, user: Address) -> i128 {
        get_user_balance(&env, &user).withdrawable
    }

    pub fn get_locked(env: Env, user: Address) -> i128 {
        get_user_balance(&env, &user).locked
    }

    pub fn get_total(env: Env, user: Address) -> Result<i128, BalanceLedgerError> {
        let balance = get_user_balance(&env, &user);
        checked_add(balance.withdrawable, balance.locked)
    }

    pub fn record_metrics(
        env: Env,
        user: Address,
        staked_delta: i128,
        won_delta: i128,
        lost_delta: i128,
    ) -> Result<UserMetrics, BalanceLedgerError> {
        Self::require_backend_auth(&env)?;
        validate_non_negative(staked_delta)?;
        validate_non_negative(won_delta)?;
        validate_non_negative(lost_delta)?;

        let previous = get_user_metrics(&env, &user);

        let updated = UserMetrics {
            total_staked: checked_add(previous.total_staked, staked_delta)?,
            total_won: checked_add(previous.total_won, won_delta)?,
            total_lost: checked_add(previous.total_lost, lost_delta)?,
        };

        store_user_metrics(&env, &user, &updated);
        publish_metrics_updated_event(&env, &user, staked_delta, won_delta, lost_delta, &updated);

        Ok(updated)
    }

    pub fn get_metrics(env: Env, user: Address) -> UserMetrics {
        get_user_metrics(&env, &user)
    }

    fn require_backend_auth(env: &Env) -> Result<(), BalanceLedgerError> {
        let storage = env.storage().persistent();
        let backend_signer: Address = storage
            .get(&DataKey::BackendSigner)
            .ok_or(BalanceLedgerError::Unauthorized)?;
        backend_signer.require_auth();
        Ok(())
    }
}

fn apply_balance_delta(
    current: &UserBalance,
    withdrawable_delta: i128,
    locked_delta: i128,
) -> Result<UserBalance, BalanceLedgerError> {
    let next_withdrawable = checked_add(current.withdrawable, withdrawable_delta)?;
    let next_locked = checked_add(current.locked, locked_delta)?;

    if next_withdrawable < 0 {
        return Err(BalanceLedgerError::InsufficientWithdrawable);
    }
    if next_locked < 0 {
        return Err(BalanceLedgerError::InsufficientLocked);
    }

    Ok(UserBalance {
        withdrawable: next_withdrawable,
        locked: next_locked,
    })
}

fn checked_add(a: i128, b: i128) -> Result<i128, BalanceLedgerError> {
    a.checked_add(b).ok_or(BalanceLedgerError::Overflow)
}

fn validate_non_negative(amount: i128) -> Result<(), BalanceLedgerError> {
    if amount < 0 {
        return Err(BalanceLedgerError::InvalidAmount);
    }
    Ok(())
}

fn validate_positive(amount: i128) -> Result<(), BalanceLedgerError> {
    if amount <= 0 {
        return Err(BalanceLedgerError::InvalidAmount);
    }
    Ok(())
}

fn get_user_balance(env: &Env, user: &Address) -> UserBalance {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(user.clone()))
        .unwrap_or(UserBalance {
            withdrawable: 0,
            locked: 0,
        })
}

fn store_user_balance(env: &Env, user: &Address, balance: &UserBalance) {
    env.storage()
        .persistent()
        .set(&DataKey::Balance(user.clone()), balance);
}

fn get_user_metrics(env: &Env, user: &Address) -> UserMetrics {
    env.storage()
        .persistent()
        .get(&DataKey::Metrics(user.clone()))
        .unwrap_or(UserMetrics {
            total_staked: 0,
            total_won: 0,
            total_lost: 0,
        })
}

fn store_user_metrics(env: &Env, user: &Address, metrics: &UserMetrics) {
    env.storage()
        .persistent()
        .set(&DataKey::Metrics(user.clone()), metrics);
}

fn publish_balance_updated_event(
    env: &Env,
    user: &Address,
    previous: &UserBalance,
    updated: &UserBalance,
) {
    env.events().publish(
        (Symbol::new(env, "balance_updated"), user.clone()),
        (
            previous.withdrawable,
            previous.locked,
            updated.withdrawable,
            updated.locked,
        ),
    );
}

fn publish_metrics_updated_event(
    env: &Env,
    user: &Address,
    staked_delta: i128,
    won_delta: i128,
    lost_delta: i128,
    totals: &UserMetrics,
) {
    env.events().publish(
        (Symbol::new(env, "metrics_updated"), user.clone()),
        (
            staked_delta,
            won_delta,
            lost_delta,
            totals.total_staked,
            totals.total_won,
            totals.total_lost,
        ),
    );
}

#[cfg(test)]
mod test;
