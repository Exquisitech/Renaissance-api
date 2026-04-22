#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Address, Env, Vec, String, symbol_short, Symbol};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SpinError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    InvalidPrize = 3,
    InsufficientPool = 4,
    NoPrizesConfigured = 5,
}

#[contracttype]
#[derive(Clone)]
pub struct Prize {
    pub id: u64,
    pub label: String,
    pub amount: i128,
    pub weight: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct SpinResult {
    pub user: Address,
    pub prize_id: u64,
    pub prize_label: String,
    pub prize_amount: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    PrizeList,
    PoolBalance,
    SpinHistory(Address, u64), // user, index -> SpinResult
    SpinHistoryLen(Address),
}

#[contract]
pub struct SpinToWin;

#[contractimpl]
impl SpinToWin {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!(SpinError::AlreadyInitialized)
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PoolBalance, &0i128);
        env.storage().instance().set(&DataKey::PrizeList, &Vec::<Prize>::new(&env));
    }

    pub fn add_prize(env: Env, admin: Address, prize: Prize) -> Result<(), SpinError> {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(SpinError::Unauthorized)?;
        if admin != stored_admin { return Err(SpinError::Unauthorized); }
        if prize.weight == 0 || prize.amount <= 0 { return Err(SpinError::InvalidPrize); }
        let mut list: Vec<Prize> = env.storage().instance().get(&DataKey::PrizeList).unwrap_or(Vec::new(&env));
        list.push_back(prize.clone());
        env.storage().instance().set(&DataKey::PrizeList, &list);
        Ok(())
    }

    pub fn fund_pool(env: Env, admin: Address, amount: i128) -> Result<(), SpinError> {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(SpinError::Unauthorized)?;
        if admin != stored_admin { return Err(SpinError::Unauthorized); }
        if amount <= 0 { return Err(SpinError::InsufficientPool); }
        let bal: i128 = env.storage().instance().get(&DataKey::PoolBalance).unwrap_or(0);
        env.storage().instance().set(&DataKey::PoolBalance, &(bal + amount));
        Ok(())
    }

    pub fn spin(env: Env, user: Address) -> Result<SpinResult, SpinError> {
        user.require_auth();
        let prizes: Vec<Prize> = env.storage().instance().get(&DataKey::PrizeList).unwrap_or(Vec::new(&env));
        if prizes.len() == 0 { return Err(SpinError::NoPrizesConfigured); }

        // compute total weight
        let mut total_weight: u128 = 0;
        for p in prizes.iter() { total_weight += p.weight as u128; }

        // generate pseudo-random number from ledger timestamp + tx hash
        let seed = env.ledger().timestamp() as u128;
        let tx_hash = env.invoker().to_string();
        let mut rnd = (seed.wrapping_add(tx_hash.len() as u128)) % total_weight;

        // pick prize by weight
        let mut cumulative: u128 = 0;
        let mut selected: Option<Prize> = None;
        for p in prizes.iter() {
            cumulative += p.weight as u128;
            if rnd < cumulative {
                selected = Some(p.clone());
                break;
            }
        }

        let prize = selected.ok_or(SpinError::NoPrizesConfigured)?;

        // check pool
        let pool: i128 = env.storage().instance().get(&DataKey::PoolBalance).unwrap_or(0);
        if pool < prize.amount { return Err(SpinError::InsufficientPool); }

        // deduct pool
        env.storage().instance().set(&DataKey::PoolBalance, &(pool - prize.amount));

        // credit user's balance in this contract's storage (simple ledger)
        let key = DataKey::SpinHistoryLen(user.clone());
        let len: u64 = env.storage().instance().get(&key).unwrap_or(0u64);
        let result = SpinResult { user: user.clone(), prize_id: prize.id, prize_label: prize.label.clone(), prize_amount: prize.amount, timestamp: env.ledger().timestamp() };
        env.storage().instance().set(&DataKey::SpinHistory(user.clone(), len), &result);
        env.storage().instance().set(&key, &(len + 1));

        // emit event
        env.events().publish((Symbol::new(&env, "spin"), user.clone()), (prize.id, prize.label.clone(), prize.amount));

        Ok(result)
    }

    pub fn get_pool_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::PoolBalance).unwrap_or(0)
    }

    pub fn get_prizes(env: Env) -> Vec<Prize> {
        env.storage().instance().get(&DataKey::PrizeList).unwrap_or(Vec::new(&env))
    }

    pub fn get_history_len(env: Env, user: Address) -> u64 {
        env.storage().instance().get(&DataKey::SpinHistoryLen(user)).unwrap_or(0u64)
    }

    pub fn get_history(env: Env, user: Address, idx: u64) -> Option<SpinResult> {
        env.storage().instance().get(&DataKey::SpinHistory(user, idx))
    }
}
