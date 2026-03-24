use soroban_sdk::{
    contract, contractimpl, 
    Env, Address, 
    symbol_short, Symbol, Event,
    map, Map
};
use common::storage_keys::*;

#[contract]
pub struct Treasury;

#[contractimpl]
impl Treasury {
    /// Initialize the treasury contract
    pub fn initialize(env: Env) {
        if env.storage().instance().has(&TREASURY_LOCK) {
            panic!("Treasury already initialized");
        }
        env.storage().instance().set(&TREASURY_LOCK, &false);
    }

    /// Deposit funds into the treasury
    /// 
    /// # Arguments
    /// * `from` - The address depositing funds
    /// * `amount` - The amount to deposit (must be > 0)
    /// 
    /// # Events
    /// Emits a Deposit event with from address, amount, and new balance
    pub fn deposit(env: Env, from: Address, amount: i128) {
        // Authentication: require caller to be the depositor
        from.require_auth();
        
        // Input validation
        if amount <= 0 {
            panic!("Deposit amount must be positive");
        }
        
        // Reentrancy protection
        Self::_enter_locked_section(&env);
        
        // Get current balance
        let balance_key = symbol_short!("balance");
        let current_balance: i128 = env.storage().persistent().get(&from, &balance_key)
            .unwrap_or(0);
        
        // Update balance (prevents overflow in Soroban)
        let new_balance = current_balance.checked_add(amount)
            .expect("Balance overflow");
        
        env.storage().persistent().set(&from, &balance_key, &new_balance);
        
        // Emit event
        env.events().publish(
            (Symbol::new(&env, "Deposit"), from.clone()),
            (amount, new_balance)
        );
        
        // Release lock
        Self::_exit_locked_section(&env);
    }

    /// Withdraw funds from the treasury
    /// 
    /// # Arguments
    /// * `to` - The address receiving funds (must be caller)
    /// * `amount` - The amount to withdraw (must be > 0)
    /// 
    /// # Events
    /// Emits a Withdraw event with to address, amount, and new balance
    pub fn withdraw(env: Env, to: Address, amount: i128) {
        // Authentication: require caller to be the withdrawer
        to.require_auth();
        
        // Input validation
        if amount <= 0 {
            panic!("Withdrawal amount must be positive");
        }
        
        // Reentrancy protection
        Self::_enter_locked_section(&env);
        
        // Get current balance
        let balance_key = symbol_short!("balance");
        let current_balance: i128 = env.storage().persistent().get(&to, &balance_key)
            .unwrap_or(0);
        
        // Check sufficient funds (prevents double spending)
        if current_balance < amount {
            panic!("Insufficient balance");
        }
        
        // Update balance
        let new_balance = current_balance - amount;
        env.storage().persistent().set(&to, &balance_key, &new_balance);
        
        // Emit event
        env.events().publish(
            (Symbol::new(&env, "Withdraw"), to.clone()),
            (amount, new_balance)
        );
        
        // Release lock
        Self::_exit_locked_section(&env);
    }

    /// Get the balance of a specific user
    /// 
    /// # Arguments
    /// * `user` - The address to query
    /// 
    /// # Returns
    /// The current balance of the user
    pub fn get_balance(env: Env, user: Address) -> i128 {
        let balance_key = symbol_short!("balance");
        env.storage().persistent().get(&user, &balance_key)
            .unwrap_or(0)
    }

    /// Get total balance held in treasury
    /// 
    /// # Returns
    /// Total balance across all users
    pub fn get_total_balance(env: Env) -> i128 {
        // Note: In a production environment, you might want to maintain
        // a separate total balance counter for efficiency
        let total = symbol_short!("total");
        env.storage().instance().get(&total)
            .unwrap_or(0)
    }

    /// Internal function for reentrancy protection - enter locked section
    fn _enter_locked_section(env: &Env) {
        let lock_key = TREASURY_LOCK;
        let is_locked: bool = env.storage().instance().get(&lock_key)
            .unwrap_or(false);
        
        if is_locked {
            panic!("Reentrancy detected");
        }
        
        env.storage().instance().set(&lock_key, &true);
    }

    /// Internal function for reentrancy protection - exit locked section
    fn _exit_locked_section(env: &Env) {
        let lock_key = TREASURY_LOCK;
        env.storage().instance().set(&lock_key, &false);
    }
}
