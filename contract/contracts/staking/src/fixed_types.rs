use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone)]
pub struct FixedStakePosition {
    pub staker: Address,
    pub amount: i128,
    pub start_time: u64,
    pub lock_duration: u64,
    pub multiplier: u32,
}