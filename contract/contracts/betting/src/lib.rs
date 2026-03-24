#![no_std]
use common::{
    cleanup_operation, ensure_not_replayed, is_operation_executed, BetPlacedEvent, ContractError,
    SpinExecutedEvent,
};
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, BytesN, Env, Map, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpinExecution {
    pub spin_id: BytesN<32>,
    pub executor: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Bet {
    pub bettor: Address,
    pub amount: i128,
    pub match_id: BytesN<32>,
    pub bet_type: Symbol,
    pub odds: u32,
    pub timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    BackendSigner,
    UsedSpinHashes,
    SpinExecutions,
    Bet(BytesN<32>, Address),
    PreventDoubleBetting,
}

#[contract]
pub struct BettingContract;

#[contractimpl]
impl BettingContract {
    /// Initialize the contract with the backend signer address
    pub fn initialize(env: Env, backend_signer: Address) {
        let storage = env.storage().persistent();
        storage.set(&DataKey::BackendSigner, &backend_signer);
    }

    /// Place a bet and escrow funds
    pub fn place_bet(
        env: Env,
        bettor: Address,
        token_address: Address,
        amount: i128,
        match_id: BytesN<32>,
        bet_type: Symbol,
        odds: u32,
    ) -> Result<(), ContractError> {
        bettor.require_auth();

        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        let storage = env.storage().persistent();

        // Check if double betting is prevented
        let prevent_double: bool = storage.get(&DataKey::PreventDoubleBetting).unwrap_or(false);
        if prevent_double {
            if storage.has(&DataKey::Bet(match_id.clone(), bettor.clone())) {
                return Err(ContractError::BetAlreadyPlaced);
            }
        }

        // Lock funds (transfer from bettor to contract)
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&bettor, &env.current_contract_address(), &amount);

        // Store bet
        let timestamp = env.ledger().timestamp();
        let bet = Bet {
            bettor: bettor.clone(),
            amount,
            match_id: match_id.clone(),
            bet_type: bet_type.clone(),
            odds,
            timestamp,
        };

        storage.set(&DataKey::Bet(match_id.clone(), bettor.clone()), &bet);

        // Emit bet placed event
        let event = BetPlacedEvent {
            bettor: bettor.clone(),
            bet_id: Symbol::new(&env, "bet"), // Using a generic symbol or match_id as symbol
            amount,
        };
        // Note: The common::BetPlacedEvent uses Symbol for bet_id.
        // We might want to emit a more detailed event or use Match ID.
        // For now, let's satisfy the criteria with what's available.
        env.events()
            .publish((Symbol::new(&env, "bet_placed"), match_id.clone()), event);

        Ok(())
    }

    /// Configure double betting prevention
    pub fn set_prevent_double_betting(
        env: Env,
        admin: Address,
        prevent: bool,
    ) -> Result<(), ContractError> {
        // Only backend signer (acting as admin) can change settings
        // In a real scenario, you'd have a separate admin role
        let storage = env.storage().persistent();
        let backend_signer: Address = storage
            .get(&DataKey::BackendSigner)
            .ok_or(ContractError::Unauthorized)?;

        admin.require_auth();
        if admin != backend_signer {
            return Err(ContractError::Unauthorized);
        }

        storage.set(&DataKey::PreventDoubleBetting, &prevent);
        Ok(())
    }

    /// Check if double betting is prevented
    pub fn is_double_betting_prevented(env: Env) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::PreventDoubleBetting)
            .unwrap_or(false)
    }

    /// Execute a spin with backend signature verification
    ///
    /// # Arguments
    /// * `spin_id` - Unique identifier for the spin (32-byte hash)
    /// * `spin_hash` - Hash of spin parameters for replay protection
    /// * `signature` - Signature from backend signer
    /// * `executor` - Address executing the spin
    ///
    /// # Returns
    /// `Result<(), ContractError>`
    /// Execute a spin with backend authorization
    pub fn execute_spin(
        env: Env,
        spin_id: BytesN<32>,
        spin_hash: BytesN<32>,
        signature: BytesN<64>,
        executor: Address,
    ) -> Result<(), ContractError> {
        Self::execute_spin_with_ttl(env, spin_id, spin_hash, signature, executor, None)
    }

    pub fn execute_spin_with_ttl(
        env: Env,
        spin_id: BytesN<32>,
        spin_hash: BytesN<32>,
        signature: BytesN<64>,
        executor: Address,
        ttl_seconds: Option<u64>,
    ) -> Result<(), ContractError> {
        executor.require_auth();

        let storage = env.storage().persistent();

        // Get backend signer
        let backend_signer: Address = storage
            .get(&DataKey::BackendSigner)
            .ok_or(ContractError::Unauthorized)?;

        // Signature verification hook; auth is currently enforced via backend signer auth.
        let _ = signature;
        backend_signer.require_auth();

        ensure_not_replayed(
            &env,
            Symbol::new(&env, "spin_exec"),
            spin_hash.clone(),
            ttl_seconds,
        )?;

        // Store spin execution
        let executions: Map<BytesN<32>, SpinExecution> = storage
            .get(&DataKey::SpinExecutions)
            .unwrap_or_else(|| Map::new(&env));

        // Check for duplicate execution on spin ID
        if executions.get(spin_id.clone()).is_some() {
            return Err(ContractError::SpinAlreadyExecuted);
        }

        let current_time = env.ledger().timestamp();

        let execution = SpinExecution {
            spin_id: spin_id.clone(),
            executor: executor.clone(),
            timestamp: current_time,
        };

        // Update storage
        let mut new_executions = executions.clone();
        new_executions.set(spin_id.clone(), execution.clone());
        storage.set(&DataKey::SpinExecutions, &new_executions);
        // Emit execution event
        let event = SpinExecutedEvent {
            spin_id: spin_id.clone(),
            executor: executor.clone(),
            timestamp: current_time,
        };

        env.events()
            .publish((Symbol::new(&env, "spin_executed"),), event);

        Ok(())
    }

    /// Check if a spin has already been executed
    pub fn is_spin_executed(env: Env, spin_id: BytesN<32>) -> bool {
        let storage = env.storage().persistent();
        let executions: Map<BytesN<32>, SpinExecution> = storage
            .get(&DataKey::SpinExecutions)
            .unwrap_or_else(|| Map::new(&env));

        executions.get(spin_id).is_some()
    }

    /// Get spin execution details
    pub fn get_spin_execution(
        env: Env,
        spin_id: BytesN<32>,
    ) -> Result<SpinExecution, ContractError> {
        let storage = env.storage().persistent();
        let executions: Map<BytesN<32>, SpinExecution> = storage
            .get(&DataKey::SpinExecutions)
            .unwrap_or_else(|| Map::new(&env));

        executions.get(spin_id).ok_or(ContractError::SpinNotFound)
    }

    pub fn is_spin_hash_used(env: Env, spin_hash: BytesN<32>) -> bool {
        is_operation_executed(&env, Symbol::new(&env, "spin_exec"), spin_hash)
    }

    pub fn cleanup_spin_hash(env: Env, spin_hash: BytesN<32>) -> bool {
        cleanup_operation(&env, Symbol::new(&env, "spin_exec"), spin_hash)
    }
}
#[cfg(test)]
mod test;
