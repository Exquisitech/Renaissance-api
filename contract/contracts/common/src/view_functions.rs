use crate::getters::*;
use soroban_sdk::{Address, Env, Map, String, Vec, U256};

// ===== USER BALANCE GETTERS =====

/// Get user balance for a specific token
/// Returns: UserBalance struct with current and locked amounts
pub fn get_user_balance(env: &Env, user: Address, token_address: Address) -> UserBalance {
    let key = (
        String::from_str(env, USER_BALANCE_PREFIX),
        user.clone(),
        token_address.clone(),
    );
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| UserBalance {
            user: user.clone(),
            token_address: token_address.clone(),
            balance: 0i128,
            locked_balance: 0i128,
            last_updated: 0u64,
        })
}

/// Get all token balances for a user
/// Returns: Map of token_address -> UserBalance
pub fn get_user_all_balances(env: &Env, _user: Address) -> Map<Address, UserBalance> {
    // In a real implementation, you would iterate through storage
    // For now, return empty map - actual implementation would need storage scanning
    Map::new(env)
}

/// Get token balance information
/// Returns: TokenBalance with total supply and locked amounts
pub fn get_token_balance(env: &Env, token_address: Address) -> TokenBalance {
    let key = (
        String::from_str(env, TOKEN_BALANCE_PREFIX),
        token_address.clone(),
    );
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| TokenBalance {
            token_address: token_address.clone(),
            total_supply: 0i128,
            circulating_supply: 0i128,
            locked_total: 0i128,
        })
}

/// Get user's available balance (excluding locked amounts)
/// Returns: i128 available balance
pub fn get_user_available_balance(env: &Env, user: Address, token_address: Address) -> i128 {
    let balance = get_user_balance(env, user, token_address);
    balance.balance - balance.locked_balance
}

/// Get user's locked balance
/// Returns: i128 locked balance
pub fn get_user_locked_balance(env: &Env, user: Address, token_address: Address) -> i128 {
    let balance = get_user_balance(env, user, token_address);
    balance.locked_balance
}

// ===== ACTIVE STAKES GETTERS =====

/// Get specific active stake by ID
/// Returns: ActiveStake struct or panics if not found
pub fn get_active_stake(env: &Env, stake_id: U256) -> ActiveStake {
    let key = (String::from_str(env, ACTIVE_STAKE_PREFIX), stake_id);
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| panic!("stake not found"))
}

/// Get all active stakes for a user
/// Returns: Vec<ActiveStake> of user's active stakes
pub fn get_user_active_stakes(env: &Env, user: Address) -> Vec<ActiveStake> {
    let prefix = String::from_str(env, USER_STAKE_INFO_PREFIX);
    let key = (prefix, user.clone());

    if let Some(_stake_info) = env.storage().instance().get::<_, UserStakeInfo>(&key) {
        // In a real implementation, you would fetch actual stakes
        // For now, return empty vec - actual implementation would need storage scanning
        Vec::new(env)
    } else {
        Vec::new(env)
    }
}

/// Get user stake information summary
/// Returns: UserStakeInfo with aggregated stake data
pub fn get_user_stake_info(env: &Env, user: Address) -> UserStakeInfo {
    let key = (String::from_str(env, USER_STAKE_INFO_PREFIX), user.clone());
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| UserStakeInfo {
            user: user.clone(),
            total_staked: 0i128,
            active_stakes_count: 0u32,
            pending_rewards: 0, // Fix: changed type to i128
            total_rewards_earned: 0i128,
        })
}

/// Get total amount staked by a user
/// Returns: i128 total staked amount
pub fn get_user_total_staked(env: &Env, user: Address) -> i128 {
    let stake_info = get_user_stake_info(env, user);
    stake_info.total_staked
}

/// Get pending rewards for a user
/// Returns: i128 pending rewards amount
pub fn get_user_pending_rewards(env: &Env, user: Address) -> i128 {
    let stake_info = get_user_stake_info(env, user);
    stake_info.pending_rewards
}

/// Get all active stakes in the system
/// Returns: Vec<ActiveStake> of all active stakes (gas intensive)
pub fn get_all_active_stakes(env: &Env) -> Vec<ActiveStake> {
    // This is gas-intensive and should be used carefully
    // In a real implementation, you would scan storage
    Vec::new(env)
}

// ===== LOCKED BETS GETTERS =====

/// Get specific locked bet by ID
/// Returns: LockedBet struct or panics if not found
pub fn get_locked_bet(env: &Env, bet_id: U256) -> LockedBet {
    let key = (String::from_str(env, LOCKED_BET_PREFIX), bet_id);
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| panic!("bet not found"))
}

/// Get all locked bets for a user
/// Returns: Vec<LockedBet> of user's locked bets
pub fn get_user_locked_bets(env: &Env, user: Address) -> Vec<LockedBet> {
    let prefix = String::from_str(env, USER_BET_INFO_PREFIX);
    let key = (prefix, user.clone());

    if let Some(_bet_info) = env.storage().instance().get::<_, UserBetInfo>(&key) {
        // In a real implementation, you would fetch actual bets
        // For now, return empty vec - actual implementation would need storage scanning
        Vec::new(env)
    } else {
        Vec::new(env)
    }
}

/// Get user bet information summary
/// Returns: UserBetInfo with aggregated betting data
pub fn get_user_bet_info(env: &Env, user: Address) -> UserBetInfo {
    let key = (String::from_str(env, USER_BET_INFO_PREFIX), user.clone());
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| UserBetInfo {
            user: user.clone(),
            total_bets: 0i128,
            active_bets_count: 0u32,
            total_wagered: 0i128,
            total_won: 0i128,
            pending_bets: 0i128,
        })
}

/// Get total amount locked in bets for a user
/// Returns: i128 total locked bet amount
pub fn get_user_locked_bets_amount(env: &Env, user: Address) -> i128 {
    let bet_info = get_user_bet_info(env, user);
    bet_info.pending_bets
}

/// Get all locked bets in the system
/// Returns: Vec<LockedBet> of all locked bets (gas intensive)
pub fn get_all_locked_bets(env: &Env) -> Vec<LockedBet> {
    // This is gas-intensive and should be used carefully
    // In a real implementation, you would scan storage
    Vec::new(env)
}

// ===== AGGREGATED PORTFOLIO GETTERS =====

/// Get complete user portfolio snapshot
/// Returns: UserPortfolio with all user data
pub fn get_user_portfolio(env: &Env, user: Address) -> UserPortfolio {
    let key = (String::from_str(env, USER_PORTFOLIO_PREFIX), user.clone());
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| UserPortfolio {
            user: user.clone(),
            balances: Map::new(env),
            active_stakes: Vec::new(env),
            locked_bets: Vec::new(env),
            total_value_locked: 0i128,
            last_updated: 0u64,
        })
}

/// Get user's total value locked across all contracts
/// Returns: i128 total TVL for user
pub fn get_user_total_locked(env: &Env, user: Address) -> i128 {
    let portfolio = get_user_portfolio(env, user);
    portfolio.total_value_locked
}

// ===== GAS-EFFICIENT BATCH GETTERS =====

/// Get user's key metrics in one call
/// Returns: (available_balance, total_staked, locked_bets, pending_rewards)
pub fn get_user_key_metrics(
    env: &Env,
    user: Address,
    token_address: Address,
) -> (i128, i128, i128, i128) {
    let available = get_user_available_balance(env, user.clone(), token_address.clone());
    let staked = get_user_total_staked(env, user.clone());
    let locked_bets = get_user_locked_bets_amount(env, user.clone());
    let rewards = get_user_pending_rewards(env, user);

    (available, staked, locked_bets, rewards)
}

/// Get contract-level statistics
/// Returns: (total_users, total_staked, total_locked_bets, total_supply)
pub fn get_contract_stats(env: &Env, token_address: Address) -> (u32, i128, i128, i128) {
    let token_balance = get_token_balance(env, token_address);

    // These would be actual counts in a real implementation
    let total_users = 0u32;
    let total_staked = 0i128;
    let total_locked_bets = 0i128;

    (
        total_users,
        total_staked,
        total_locked_bets,
        token_balance.total_supply,
    )
}
