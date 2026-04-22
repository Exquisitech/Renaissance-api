#[cfg(test)]
mod tests {
    use soroban_sdk::{Env, Address, String as SorobanString};
    use crate::TeamGovernance;

    #[test]
    fn test_full_flow() {
        let env = Env::default();
        let contract_id = env.register_contract(None, TeamGovernance);
        let client = TeamGovernanceClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        // create a team
        client.create_team(&admin, &1).unwrap();

        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        // mint tokens to user1
        client.mint(&admin, &1, &user1, &100).unwrap();
        assert_eq!(client.balance_of(&user1, &1), 100);

        // transfer
        client.transfer(&user1, &user2, &1, &40).unwrap();
        assert_eq!(client.balance_of(&user1, &1), 60);
        assert_eq!(client.balance_of(&user2, &1), 40);

        // stake
        client.stake(&user1, &1, &10).unwrap();
        assert_eq!(client.staked_of(&user1, &1), 10);
        assert_eq!(client.balance_of(&user1, &1), 50);

        // distribute reward to user2
        client.distribute_reward(&admin, &1, &user2, &5).unwrap();
        assert_eq!(client.balance_of(&user2, &1), 45);

        // propose
        let meta = SorobanString::from_str(&env, "increase_budget");
        let proposal_id = client.propose(&user1, &1, &meta).unwrap();

        // vote (user1 has 10 staked)
        client.vote(&user1, &1, &proposal_id, &true).unwrap();
        let proposal = client.proposal_of(&1, &proposal_id).unwrap().unwrap();
        assert_eq!(proposal.yes, 10);

        // execute
        client.execute_proposal(&admin, &1, &proposal_id).unwrap();
        let executed = client.proposal_of(&1, &proposal_id).unwrap().unwrap();
        assert!(executed.executed);
    }
}
