use soroban_sdk::{contract, contractimpl, Env, Address};
use common::{types::BetId, storage_keys::*};

#[contract]
pub struct BettingEscrow;

#[contractimpl]
impl BettingEscrow {
    pub fn create_bet(env: Env, bet_id: BetId, player: Address, amount: i128) {
        let key = format!("{}{}", BET_ESCROW, bet_id.0);
        env.storage().set(&key, &amount);
    }

    pub fn settle_bet(env: Env, bet_id: BetId, winner: Address) {
        let key = format!("{}{}", BET_ESCROW, bet_id.0);
        env.storage().remove(&key);
        // Treasury payout logic would be invoked here
    }
}
