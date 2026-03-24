#![cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Ledger;
    use soroban_sdk::{Env, Address, Symbol};

    #[test]
    fn test_tier_upgrade() {
        let env = Env::default();
        env.ledger().set(Ledger {
            timestamp: 0,
            ..Default::default()
        });

        let mut contract = StakingContract::init(env.clone());
        let user = Address::random(&env);

        contract.stake(env.clone(), user.clone(), 600);
        env.ledger().set(Ledger {
            timestamp: 8*24*3600,
            ..Default::default()
        });

        contract.recalculate_tier(env.clone(), user.clone());
        let tier = contract.get_tier(user.clone()).unwrap();
        assert_eq!(tier, Symbol::short("Silver"));
    }
}