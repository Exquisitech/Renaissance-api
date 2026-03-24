use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq)]
#[repr(u32)]
pub enum FixedStakingError {
    InvalidDuration = 1,
    StakeAlreadyExists = 2,
    NoActiveStake = 3,
    LockNotExpired = 4,
}