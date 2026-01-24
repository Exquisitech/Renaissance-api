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
}
