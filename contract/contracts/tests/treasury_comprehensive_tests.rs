use soroban_sdk::testutils::{Address as _};
use soroban_sdk::{token, Address, Env};

fn setup_treasury_test() -> (Env, Address, Address, token::Client<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Create token for treasury operations
    let token_admin = Address::generate(&env);
    let token_contract_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_client = token::Client::new(&env, &token_contract_id.address());

    // Mint tokens to user
    token::StellarAssetClient::new(&env, &token_contract_id.address()).mint(&user, &1_000_000);

    (env, admin, user, token_client)
}

#[cfg(test)]
mod treasury_comprehensive_tests {
    use super::*;
    use soroban_sdk::{contract, contractimpl, symbol_short, Symbol, Event};

    // Define a test treasury contract for comprehensive testing
    #[contract]
    pub struct TestTreasury;

    #[contractimpl]
    impl TestTreasury {
        pub fn initialize(env: Env) {
            if env.storage().instance().has(&symbol_short!("LOCK")) {
                panic!("Treasury already initialized");
            }
            env.storage().instance().set(&symbol_short!("LOCK"), &false);
        }

        pub fn deposit(env: Env, from: Address, amount: i128) {
            from.require_auth();

            if amount <= 0 {
                panic!("Deposit amount must be positive");
            }

            Self::enter_lock(&env);

            let balance_key = symbol_short!("balance");
            let current_balance: i128 = env.storage().persistent().get(&from, &balance_key).unwrap_or(0);
            let new_balance = current_balance.checked_add(amount).expect("Balance overflow");

            env.storage().persistent().set(&from, &balance_key, &new_balance);

            env.events().publish(
                (Symbol::new(&env, "Deposit"), from.clone()),
                (amount, new_balance)
            );

            Self::exit_lock(&env);
        }

        pub fn withdraw(env: Env, to: Address, amount: i128) {
            to.require_auth();

            if amount <= 0 {
                panic!("Withdrawal amount must be positive");
            }

            Self::enter_lock(&env);

            let balance_key = symbol_short!("balance");
            let current_balance: i128 = env.storage().persistent().get(&to, &balance_key).unwrap_or(0);

            if current_balance < amount {
                panic!("Insufficient balance");
            }

            let new_balance = current_balance - amount;
            env.storage().persistent().set(&to, &balance_key, &new_balance);

            env.events().publish(
                (Symbol::new(&env, "Withdraw"), to.clone()),
                (amount, new_balance)
            );

            Self::exit_lock(&env);
        }

        pub fn get_balance(env: Env, user: Address) -> i128 {
            let balance_key = symbol_short!("balance");
            env.storage().persistent().get(&user, &balance_key).unwrap_or(0)
        }

        fn enter_lock(env: &Env) {
            let lock_key = symbol_short!("LOCK");
            let is_locked: bool = env.storage().instance().get(&lock_key).unwrap_or(false);

            if is_locked {
                panic!("Reentrancy detected");
            }

            env.storage().instance().set(&lock_key, &true);
        }

        fn exit_lock(env: &Env) {
            let lock_key = symbol_short!("LOCK");
            env.storage().instance().set(&lock_key, &false);
        }
    }

    use soroban_sdk::contractclient;

    #[contractclient(name = "TestTreasuryClient")]
    pub trait TestTreasuryTrait {
        fn initialize(env: Env);
        fn deposit(env: Env, from: Address, amount: i128);
        fn withdraw(env: Env, to: Address, amount: i128);
        fn get_balance(env: Env, user: Address) -> i128;
    }

    #[test]
    fn test_comprehensive_treasury_operations() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TestTreasury, ());
        let client = TestTreasuryClient::new(&env, &contract_id);

        let user = Address::generate(&env);

        // Initialize
        client.initialize();

        // Test deposits
        client.deposit(&user, &1000);
        assert_eq!(client.get_balance(&user), 1000);

        client.deposit(&user, &500);
        assert_eq!(client.get_balance(&user), 1500);

        // Test withdrawals
        client.withdraw(&user, &300);
        assert_eq!(client.get_balance(&user), 1200);

        client.withdraw(&user, &200);
        assert_eq!(client.get_balance(&user), 1000);
    }

    #[test]
    fn test_treasury_edge_cases() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TestTreasury, ());
        let client = TestTreasuryClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        client.initialize();

        // Test zero balance
        assert_eq!(client.get_balance(&user), 0);

        // Test large deposits
        let large_amount = i128::MAX / 2;
        client.deposit(&user, &large_amount);
        assert_eq!(client.get_balance(&user), large_amount);
    }

    #[test]
    #[should_panic(expected = "Deposit amount must be positive")]
    fn test_invalid_deposit() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TestTreasury, ());
        let client = TestTreasuryClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        client.initialize();

        client.deposit(&user, &0);
    }

    #[test]
    #[should_panic(expected = "Insufficient balance")]
    fn test_insufficient_withdrawal() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TestTreasury, ());
        let client = TestTreasuryClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        client.initialize();

        client.deposit(&user, &100);
        client.withdraw(&user, &200);
    }
}