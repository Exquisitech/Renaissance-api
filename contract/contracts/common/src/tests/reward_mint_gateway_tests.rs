#[cfg(test)]
mod tests {
    use super::reward_mint_gateway::*;

    #[test]
    fn test_authorization() {
        let mut gateway = RewardMintGateway::new();
        gateway.authorize_contract("spin_contract".into());

        let result = gateway.mint_reward(
            "spin_contract".into(),
            "user1".into(),
            "reward123".into(),
            "ipfs://metadata".into(),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_duplicate_reward() {
        let mut gateway = RewardMintGateway::new();
        gateway.authorize_contract("promo_contract".into());

        let _ = gateway.mint_reward(
            "promo_contract".into(),
            "user1".into(),
            "reward123".into(),
            "https://metadata".into(),
        );

        let result = gateway.mint_reward(
            "promo_contract".into(),
            "user2".into(),
            "reward123".into(),
            "https://metadata".into(),
        );

        assert!(result.is_err());
    }
}
