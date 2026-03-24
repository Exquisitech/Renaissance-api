use soroban_sdk::{contracttype, Address, Map, String, Vec, U256};

// ===== USER BALANCE DATA STRUCTURES =====

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserBalance {
    pub user: Address,
    pub token_address: Address,
    pub balance: i128,
    pub locked_balance: i128,
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenBalance {
    pub token_address: Address,
    pub total_supply: i128,
    pub circulating_supply: i128,
    pub locked_total: i128,
}

// ===== STAKING DATA STRUCTURES =====

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActiveStake {
    pub stake_id: U256,
    pub user: Address,
    pub token_address: Address,
    pub amount: i128,
    pub start_time: u64,
    pub end_time: Option<u64>,
    pub rewards_earned: i128,
    pub apy: u32, // Annual Percentage Yield * 100
    pub staking_contract: Address,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserStakeInfo {
    pub user: Address,
    pub total_staked: i128,
    pub active_stakes_count: u32,
    pub pending_rewards: i128,
    pub total_rewards_earned: i128,
}

// ===== BETTING DATA STRUCTURES =====

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LockedBet {
    pub bet_id: U256,
    pub bettor: Address,
    pub amount: i128,
    pub token_address: Address,
    pub betting_contract: Address,
    pub bet_type: String,
    pub odds: u32,
    pub placed_at: u64,
    pub settles_at: u64,
    pub is_settled: bool,
    pub potential_payout: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserBetInfo {
    pub user: Address,
    pub total_bets: i128,
    pub active_bets_count: u32,
    pub total_wagered: i128,
    pub total_won: i128,
    pub pending_bets: i128,
}

// ===== AGGREGATED USER DATA =====

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserPortfolio {
    pub user: Address,
    pub balances: Map<Address, UserBalance>,
    pub active_stakes: Vec<ActiveStake>,
    pub locked_bets: Vec<LockedBet>,
    pub total_value_locked: i128,
    pub last_updated: u64,
}

// ===== GETTER CONSTANTS =====

pub const USER_BALANCE_PREFIX: &str = "USER_BALANCE";
pub const TOKEN_BALANCE_PREFIX: &str = "TOKEN_BALANCE";
pub const ACTIVE_STAKE_PREFIX: &str = "ACTIVE_STAKE";
pub const USER_STAKE_INFO_PREFIX: &str = "USER_STAKE_INFO";
pub const LOCKED_BET_PREFIX: &str = "LOCKED_BET";
pub const USER_BET_INFO_PREFIX: &str = "USER_BET_INFO";
pub const USER_PORTFOLIO_PREFIX: &str = "USER_PORTFOLIO";
