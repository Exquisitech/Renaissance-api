#![no_std]
use soroban_sdk::{contract, contractimpl};

#[contract]
pub struct BettingContract;

#[contractimpl]
impl BettingContract {
    // Contract implementation will go here
}

#[cfg(test)]
mod test;
