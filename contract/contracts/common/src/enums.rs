use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BetStatus {
    Pending = 0,
    Active = 1,
    Settled = 2,
    Cancelled = 3,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BetOutcome {
    Win = 0,
    Lose = 1,
    Draw = 2,
}
