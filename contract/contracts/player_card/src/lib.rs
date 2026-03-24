#![no_std]

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Symbol, Vec, U256};

mod errors;
mod events;
mod storage;
mod token;

pub use errors::*;
pub use events::*;
pub use storage::*;
pub use token::*;

use common::{
    cleanup_operation, create_nft_mint_event, ensure_not_replayed, is_operation_executed,
    ContractError, NFTMintEvent, NFT_MINT_EVENT,
};

#[contract]
pub struct PlayerCardContract;

#[contractimpl]
impl PlayerCardContract {
    /// Initialize the contract with the given admin
    pub fn initialize(env: Env, admin: Address) {
        if storage::has_admin(&env) {
            panic!("already initialized");
        }

        storage::set_admin(&env, &admin);
        storage::set_next_token_id(&env, 1);

        let event = NFTMintEvent {
            token_id: U256::from_u32(&env, 0),
            to: admin.clone(),
            token_uri: String::from_str(&env, "contract_initialized"),
            nft_contract: env.current_contract_address(),
            timestamp: env.ledger().timestamp(),
            mint_type: Symbol::short("INIT"),
            metadata: soroban_sdk::Map::new(&env),
            price: None,
        };

        env.events().publish((NFT_MINT_EVENT,), event);
    }

    /// Mint a new player card NFT to the specified recipient.
    /// operation_hash must be unique to guarantee idempotent execution.
    pub fn mint(
        env: Env,
        operation_hash: BytesN<32>,
        to: Address,
        token_uri: String,
        ttl_seconds: Option<u64>,
    ) -> Result<u64, ContractError> {
        let admin = storage::get_admin(&env);
        admin.require_auth();
        ensure_not_replayed(
            &env,
            Symbol::new(&env, "nft_mint"),
            operation_hash,
            ttl_seconds,
        )?;

        let token_id = storage::get_next_token_id(&env);
        storage::increment_next_token_id(&env);

        storage::set_owner(&env, token_id, &to);
        storage::set_token_uri(&env, token_id, &token_uri);

        let event = create_nft_mint_event(
            &env,
            U256::from_u32(&env, token_id as u32),
            to.clone(),
            token_uri.clone(),
            env.current_contract_address(),
            Symbol::short("PLAYER_CARD"),
            None,
        );

        let mut event_with_timestamp = event;
        event_with_timestamp.timestamp = env.ledger().timestamp();

        env.events()
            .publish((NFT_MINT_EVENT,), event_with_timestamp);

        Ok(token_id)
    }

    pub fn is_mint_operation_executed(env: Env, operation_hash: BytesN<32>) -> bool {
        is_operation_executed(&env, Symbol::new(&env, "nft_mint"), operation_hash)
    }

    pub fn cleanup_mint_operation(env: Env, operation_hash: BytesN<32>) -> bool {
        cleanup_operation(&env, Symbol::new(&env, "nft_mint"), operation_hash)
    }

    /// Transfer ownership of a token from one address to another
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u64) {
        from.require_auth();

        let current_owner = storage::get_owner(&env, token_id);
        if current_owner != from {
            panic!("not token owner");
        }

        storage::set_owner(&env, token_id, &to);

        let event = NFTMintEvent {
            token_id: U256::from_u32(&env, token_id as u32),
            to: to.clone(),
            token_uri: storage::get_token_uri(&env, token_id),
            nft_contract: env.current_contract_address(),
            timestamp: env.ledger().timestamp(),
            mint_type: Symbol::short("TRANSFER"),
            metadata: soroban_sdk::Map::new(&env),
            price: None,
        };

        env.events().publish((NFT_MINT_EVENT,), event);
    }

    /// Get the owner of a specific token
    pub fn owner_of(env: Env, token_id: u64) -> Address {
        storage::get_owner(&env, token_id)
    }

    /// Get the metadata URI for a specific token
    pub fn token_uri(env: Env, token_id: u64) -> String {
        storage::get_token_uri(&env, token_id)
    }

    /// Get total number of tokens minted
    pub fn total_supply(env: Env) -> u64 {
        storage::get_next_token_id(&env) - 1
    }

    /// Get all tokens owned by a specific address
    pub fn tokens_of_owner(env: Env, owner: Address) -> Vec<u64> {
        storage::get_tokens_of_owner(&env, owner)
    }

    // ===== BACKEND VERIFICATION GETTERS =====

    /// Get user's NFT balance (number of tokens owned)
    /// Read-only getter for backend verification
    pub fn get_user_nft_balance(env: Env, user: Address) -> u64 {
        let tokens = storage::get_tokens_of_owner(&env, user.clone());
        tokens.len() as u64
    }

    /// Get user's NFT portfolio summary
    /// Read-only getter for backend verification
    pub fn get_user_nft_portfolio(env: Env, user: Address) -> Vec<u64> {
        storage::get_tokens_of_owner(&env, user)
    }

    /// Get NFT contract statistics
    /// Read-only getter for backend verification
    pub fn get_nft_contract_stats(env: Env) -> (u64, Address) {
        let total_supply = storage::get_next_token_id(&env) - 1;
        let admin = storage::get_admin(&env);
        (total_supply, admin)
    }

    /// Check if a token exists
    /// Read-only getter for backend verification
    pub fn token_exists(env: Env, token_id: u64) -> bool {
        let key = (String::from_str(&env, "TOKEN_OWNER"), token_id);
        env.storage().instance().has(&key)
    }

    /// Get token metadata in a structured format
    /// Read-only getter for backend verification
    pub fn get_token_metadata(env: Env, token_id: u64) -> (Address, String) {
        let owner = storage::get_owner(&env, token_id);
        let uri = storage::get_token_uri(&env, token_id);
        (owner, uri)
    }

    /// Get multiple token owners efficiently
    /// Read-only getter for backend verification (gas-efficient batch operation)
    pub fn get_multiple_token_owners(env: Env, token_ids: Vec<u64>) -> Vec<Address> {
        let mut owners = Vec::new(&env);
        for token_id in token_ids.iter() {
            let owner = storage::get_owner(&env, token_id);
            owners.push_back(owner);
        }
        owners
    }

    /// Get user's NFT balance with metadata
    /// Read-only getter for backend verification
    pub fn get_user_nft_balance_md(env: Env, user: Address) -> (u64, Vec<(u64, String)>) {
        let token_ids = storage::get_tokens_of_owner(&env, user.clone());
        let balance = token_ids.len() as u64;

        let mut token_metadata = Vec::new(&env);
        for token_id in token_ids.iter() {
            let uri = storage::get_token_uri(&env, token_id);
            token_metadata.push_back((token_id, uri));
        }

        (balance, token_metadata)
    }
}
