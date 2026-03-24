use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    Unauthorized = 1,
    InvalidAmount = 2,
    InvalidBet = 3,
    BetNotFound = 4,
    BetAlreadySettled = 5,
    InsufficientBalance = 6,
    TransferFailed = 7,
    InvalidStatus = 8,
    SpinAlreadyExecuted = 9,
    InvalidSignature = 10,
    InvalidSpinHash = 11,
    SpinNotFound = 12,
    BelowMinStake = 13,
    CooldownNotMet = 14,
    StakeNotFound = 15,
    NotInitialized = 16,
    AlreadyInitialized = 17,
    BetAlreadyPlaced = 18,
    DuplicateOperation = 19,
}
