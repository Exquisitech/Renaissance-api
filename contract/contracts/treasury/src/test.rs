#[cfg(test)]
mod tests {
    use soroban_sdk::{Env, Address};
    use crate::Treasury;

    #[test]
    fn test_initialization() {
        let env = Env::default();
        let contract_id = env.register_contract(None, Treasury);
        let client = TreasuryClient::new(&env, &contract_id);
        
        // Should initialize successfully
        client.initialize();
        
        // Should panic on second initialization
        let result = std::panic::catch_unwind(|| {
            client.initialize();
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_deposit_and_withdraw() {
        let env = Env::default();
        let contract_id = env.register_contract(None, Treasury);
        let client = TreasuryClient::new(&env, &contract_id);
        
        client.initialize();
        
        let user = Address::generate(&env);
        
        // Test deposit
        client.deposit(&user, &100);
        assert_eq!(client.get_balance(&user), 100);
        
        // Test withdraw
        client.withdraw(&user, &50);
        assert_eq!(client.get_balance(&user), 50);
        
        // Test insufficient balance
        let result = std::panic::catch_unwind(|| {
            client.withdraw(&user, &100);
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_amounts() {
        let env = Env::default();
        let contract_id = env.register_contract(None, Treasury);
        let client = TreasuryClient::new(&env, &contract_id);
        
        client.initialize();
        let user = Address::generate(&env);
        
        // Test zero deposit
        let result = std::panic::catch_unwind(|| {
            client.deposit(&user, &0);
        });
        assert!(result.is_err());
        
        // Test negative deposit
        let result = std::panic::catch_unwind(|| {
            client.deposit(&user, &-10);
        });
        assert!(result.is_err());
    }
}
