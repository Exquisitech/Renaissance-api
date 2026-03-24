use soroban_sdk::{Address, Env, String, Vec};

use crate::{storage, Error};

pub trait TokenInterface {
    fn initialize(env: Env, admin: Address);
    fn mint(env: Env, to: Address, token_uri: String) -> u64;
    fn transfer(env: Env, from: Address, to: Address, token_id: u64);
    fn owner_of(env: Env, token_id: u64) -> Address;
    fn token_uri(env: Env, token_id: u64) -> String;
    fn total_supply(env: Env) -> u64;
    fn tokens_of_owner(env: Env, owner: Address) -> Vec<u64>;
}

pub struct PlayerCardToken;

impl PlayerCardToken {
    pub fn burn(_env: Env, _from: Address, _token_id: u64) -> Result<(), Error> {
        Err(Error::BurnDisabled)
    }

    pub fn approve(env: Env, approved: Address, token_id: u64) {
        let owner = storage::get_owner(&env, token_id);
        owner.require_auth();

        let key = ("approval", token_id);
        env.storage().instance().set(&key, &approved);
    }

    pub fn get_approved(env: Env, token_id: u64) -> Option<Address> {
        let key = ("approval", token_id);
        env.storage().instance().get(&key)
    }

    pub fn is_approved_or_owner(env: Env, spender: Address, token_id: u64) -> bool {
        let owner = storage::get_owner(&env, token_id);
        if spender == owner {
            return true;
        }

        if let Some(approved) = Self::get_approved(env, token_id) {
            return spender == approved;
        }

        false
    }
}
