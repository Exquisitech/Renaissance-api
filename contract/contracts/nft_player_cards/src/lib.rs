use soroban_sdk::{contract, contractimpl, Env, Address};
use common::{types::PlayerId, storage_keys::*};

#[contract]
pub struct NFTPlayerCards;

#[contractimpl]
impl NFTPlayerCards {
    pub fn register_player(env: Env, player_id: PlayerId, metadata_uri: String) {
        let key = format!("{}{}", NFT_PLAYER, player_id.0);
        env.storage().set(&key, &metadata_uri);
    }

    pub fn get_player(env: Env, player_id: PlayerId) -> Option<String> {
        let key = format!("{}{}", NFT_PLAYER, player_id.0);
        env.storage().get(&key)
    }
}
