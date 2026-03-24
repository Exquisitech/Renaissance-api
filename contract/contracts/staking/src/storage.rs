use soroban_sdk::{contracttype, Address, U256};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,                       // Address: Contract admin
    StakingToken,                // Address: Token allowed for staking (XLM)
    MinStake,                    // i128: Minimum amount required to stake
    CooldownPeriod,              // u64: Time in seconds before a stake can be withdrawn
    TotalStake(Address),         // i128: Current total amount staked by a user
    UserStake(Address, U256),    // StakeData: Details of a specific stake
    StakeNonce(Address),         // u32: Nonce used for generating unique stake IDs
    TotalStakeDuration(Address), // u64: Cumulative active staking duration for a user (seconds)
    ActiveSince(Address),        // u64: Timestamp when user last became an active staker
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StakeData {
    pub amount: i128,
    pub timestamp: u64,
}
