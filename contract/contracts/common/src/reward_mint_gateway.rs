pub mod reward_mint_gateway {
    use std::collections::HashSet;

    #[derive(Debug)]
    pub struct RewardMintGateway {
        authorized_contracts: HashSet<String>,
        executed_rewards: HashSet<String>,
        token_counter: u64,
    }

    #[derive(Debug)]
    pub struct MintEvent {
        pub to: String,
        pub token_id: u64,
        pub reward_id: String,
        pub metadata_uri: String,
    }
}

impl RewardMintGateway {
    pub fn new() -> Self {
        RewardMintGateway {
            authorized_contracts: HashSet::new(),
            executed_rewards: HashSet::new(),
            token_counter: 0,
        }
    }

    pub fn authorize_contract(&mut self, contract: String) {
        self.authorized_contracts.insert(contract);
    }

    fn is_authorized(&self, contract: &String) -> bool {
        self.authorized_contracts.contains(contract)
    }
}
