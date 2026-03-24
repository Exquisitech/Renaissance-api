use soroban_sdk::{contracttype, Address};

#[contracttype]
pub enum FixedDataKey {
    FixedStake(Address),
    FixedTotalStaked,
}