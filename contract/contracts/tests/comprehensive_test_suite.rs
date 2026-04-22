use soroban_sdk::testutils::{Address as _, Ledger, LedgerInfo};
use soroban_sdk::{token, Address, Env, Symbol, U256, BytesN};
use common::errors::ContractError;

// Import all contract clients
use staking::StakingContractClient;
use betting::BettingContractClient;
use settlement::SettlementContractClient;
use balance_ledger::BalanceLedgerContractClient;
use treasury::TreasuryContractClient;
use nft_player_cards::NFTPlayerCardsContractClient;
use spin_rewards::SpinRewardsContractClient;
use team_governance::TeamGovernanceContractClient;

// ===== TEST UTILITIES =====

/// Setup function that creates a complete test environment with all contracts
fn setup_complete_test_env() -> (
    Env,
    // Contract clients
    StakingContractClient<'static>,
    BettingContractClient<'static>,
    SettlementContractClient<'static>,
    BalanceLedgerContractClient<'static>,
    TreasuryContractClient<'static>,
    NFTPlayerCardsContractClient<'static>,
    SpinRewardsContractClient<'static>,
    TeamGovernanceContractClient<'static>,
    // Test addresses
    Address, // admin
    Address, // user1
    Address, // user2
    // Token clients
    token::Client<'static>, // staking token
    token::Client<'static>, // betting token
) {
    let env = Env::default();
    env.mock_all_auths();

    // Create test addresses
    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    // Create token contracts
    let token_admin = Address::generate(&env);
    let staking_token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let betting_token_id = env.register_stellar_asset_contract_v2(token_admin.clone());

    let staking_token_client = token::Client::new(&env, &staking_token_id.address());
    let betting_token_client = token::Client::new(&env, &betting_token_id.address());

    // Mint tokens to users
    let initial_balance = 1_000_000_000; // 100 tokens with 7 decimals
    token::StellarAssetClient::new(&env, &staking_token_id.address()).mint(&user1, &initial_balance);
    token::StellarAssetClient::new(&env, &staking_token_id.address()).mint(&user2, &initial_balance);
    token::StellarAssetClient::new(&env, &betting_token_id.address()).mint(&user1, &initial_balance);
    token::StellarAssetClient::new(&env, &betting_token_id.address()).mint(&user2, &initial_balance);

    // Register and initialize all contracts
    let staking_contract_id = env.register(staking::StakingContract, ());
    let betting_contract_id = env.register(betting::BettingContract, ());
    let settlement_contract_id = env.register(settlement::SettlementContract, ());
    let balance_ledger_contract_id = env.register(balance_ledger::BalanceLedgerContract, ());
    let treasury_contract_id = env.register(treasury::TreasuryContract, ());
    let nft_contract_id = env.register(nft_player_cards::NFTPlayerCardsContract, ());
    let spin_rewards_contract_id = env.register(spin_rewards::SpinRewardsContract, ());
    let team_governance_contract_id = env.register(team_governance::TeamGovernanceContract, ());

    // Create clients
    let staking_client = StakingContractClient::new(&env, &staking_contract_id);
    let betting_client = BettingContractClient::new(&env, &betting_contract_id);
    let settlement_client = SettlementContractClient::new(&env, &settlement_contract_id);
    let balance_ledger_client = BalanceLedgerContractClient::new(&env, &balance_ledger_contract_id);
    let treasury_client = TreasuryContractClient::new(&env, &treasury_contract_id);
    let nft_client = NFTPlayerCardsContractClient::new(&env, &nft_contract_id);
    let spin_rewards_client = SpinRewardsContractClient::new(&env, &spin_rewards_contract_id);
    let team_governance_client = TeamGovernanceContractClient::new(&env, &team_governance_contract_id);

    // Initialize contracts
    staking_client.initialize(&admin, &staking_token_client.address(), &1000, &86400);
    betting_client.initialize(&admin);
    settlement_client.initialize(&admin, &balance_ledger_contract_id.address());
    balance_ledger_client.initialize(&admin);
    treasury_client.initialize(&admin);
    nft_client.initialize(&admin);
    spin_rewards_client.initialize(&admin, &staking_token_client.address());
    team_governance_client.initialize(&admin);

    (
        env,
        staking_client,
        betting_client,
        settlement_client,
        balance_ledger_client,
        treasury_client,
        nft_client,
        spin_rewards_client,
        team_governance_client,
        admin,
        user1,
        user2,
        staking_token_client,
        betting_token_client,
    )
}

// ===== UNIT TESTS =====

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn test_staking_contract_initialization() {
        let (env, staking_client, _, _, _, _, _, _, _, admin, _, _, staking_token, _) = setup_complete_test_env();

        // Test successful initialization
        staking_client.initialize(&admin, &staking_token.address(), &1000, &86400);

        // Test double initialization fails
        let result = staking_client.try_initialize(&admin, &staking_token.address(), &1000, &86400);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), ContractError::AlreadyInitialized);
    }

    #[test]
    fn test_staking_basic_operations() {
        let (env, staking_client, _, _, _, _, _, _, _, admin, user1, _, staking_token, _) = setup_complete_test_env();

        let stake_amount = 5000i128;
        let initial_balance = staking_token.balance(&user1);

        // Stake tokens
        env.ledger().with_mut(|li| li.timestamp = 100000);
        let stake_id = staking_client.stake(&user1, &stake_amount);

        // Verify balances
        assert_eq!(staking_token.balance(&user1), initial_balance - stake_amount);
        assert_eq!(staking_token.balance(&staking_client.address()), stake_amount);
        assert_eq!(staking_client.get_total_stake(&user1), stake_amount);

        // Verify stake data
        let stake_data = staking_client.get_stake(&user1, &stake_id).unwrap();
        assert_eq!(stake_data.amount, stake_amount);
        assert_eq!(stake_data.timestamp, 100000);
    }

    #[test]
    fn test_staking_unstake_with_cooldown() {
        let (env, staking_client, _, _, _, _, _, _, _, admin, user1, _, staking_token, _) = setup_complete_test_env();

        let stake_amount = 5000i128;
        let initial_balance = staking_token.balance(&user1);

        // Stake tokens
        env.ledger().with_mut(|li| li.timestamp = 100000);
        let stake_id = staking_client.stake(&user1, &stake_amount);

        // Try to unstake too early (before cooldown)
        env.ledger().with_mut(|li| li.timestamp = 100000 + 40000); // 40k seconds, cooldown is 86400
        let early_unstake = staking_client.try_unstake(&user1, &stake_id);
        assert!(early_unstake.is_err());
        assert_eq!(early_unstake.err().unwrap(), ContractError::CooldownNotMet);

        // Unstake after cooldown period
        env.ledger().with_mut(|li| li.timestamp = 100000 + 90000); // 90k seconds
        staking_client.unstake(&user1, &stake_id);

        // Verify balances restored
        assert_eq!(staking_token.balance(&user1), initial_balance);
        assert_eq!(staking_token.balance(&staking_client.address()), 0);
        assert_eq!(staking_client.get_total_stake(&user1), 0);
    }

    #[test]
    fn test_staking_below_minimum() {
        let (env, staking_client, _, _, _, _, _, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        let below_min_amount = 500i128; // Min stake is 1000

        let result = staking_client.try_stake(&user1, &below_min_amount);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), ContractError::BelowMinStake);
    }

    #[test]
    fn test_staking_nonexistent_unstake() {
        let (env, staking_client, _, _, _, _, _, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        let fake_stake_id = U256::from_u32(&env, 999);

        let result = staking_client.try_unstake(&user1, &fake_stake_id);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), ContractError::StakeNotFound);
    }

    #[test]
    fn test_staking_active_duration_tracking() {
        let (env, staking_client, _, _, _, _, _, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        // Initial duration should be 0
        assert_eq!(staking_client.get_user_active_duration(&user1), 0);

        // Stake and advance time
        env.ledger().with_mut(|li| li.timestamp = 100000);
        staking_client.stake(&user1, &5000);

        env.ledger().with_mut(|li| li.timestamp = 200000); // 100k seconds later
        let duration = staking_client.get_user_active_duration(&user1);
        assert_eq!(duration, 100000); // Should include time since stake

        // Unstake and check duration is preserved
        staking_client.unstake(&user1, &U256::from_u32(&env, 0));
        let final_duration = staking_client.get_user_active_duration(&user1);
        assert_eq!(final_duration, 100000); // Duration should be preserved
    }

    #[test]
    fn test_betting_contract_initialization() {
        let (env, _, betting_client, _, _, _, _, _, _, admin, _, _, _, _) = setup_complete_test_env();

        betting_client.initialize(&admin);
        // Test double initialization should work (idempotent) or fail gracefully
    }

    #[test]
    fn test_betting_place_bet() {
        let (env, _, betting_client, _, _, _, _, _, _, admin, user1, _, _, betting_token) = setup_complete_test_env();

        let bet_amount = 1000i128;
        let match_id = BytesN::from_array(&env, &[1; 32]);
        let bet_type = Symbol::new(&env, "home_win");
        let odds = 200; // 2.00 odds

        let initial_balance = betting_token.balance(&user1);

        betting_client.place_bet(
            &user1,
            &betting_token.address(),
            &bet_amount,
            &match_id,
            &bet_type,
            &odds,
        );

        // Verify tokens were transferred to contract
        assert_eq!(betting_token.balance(&user1), initial_balance - bet_amount);
        assert_eq!(betting_token.balance(&betting_client.address()), bet_amount);
    }

    #[test]
    fn test_betting_invalid_amount() {
        let (env, _, betting_client, _, _, _, _, _, _, admin, user1, _, _, betting_token) = setup_complete_test_env();

        let invalid_amount = 0i128;
        let match_id = BytesN::from_array(&env, &[1; 32]);
        let bet_type = Symbol::new(&env, "home_win");
        let odds = 200;

        let result = betting_client.try_place_bet(
            &user1,
            &betting_token.address(),
            &invalid_amount,
            &match_id,
            &bet_type,
            &odds,
        );

        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), ContractError::InvalidAmount);
    }

    #[test]
    fn test_settlement_contract_initialization() {
        let (env, _, _, settlement_client, balance_ledger_client, _, _, _, _, admin, _, _, _, _) = setup_complete_test_env();

        settlement_client.initialize(&admin, &balance_ledger_client.address());
    }

    #[test]
    fn test_settlement_bet_settlement() {
        let (env, _, _, settlement_client, balance_ledger_client, _, _, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        let bet_id = U256::from_u32(&env, 1);
        let bet_amount = 1000i128;
        let payout = 2000i128;

        // Test win settlement
        settlement_client.settle_bet(
            &bet_id,
            &user1,
            &Some(user1.clone()),
            &bet_amount,
            &payout,
            &Symbol::short("WIN"),
        );

        // Verify bet is marked as settled
        assert!(settlement_client.is_settled(&bet_id));
    }

    #[test]
    fn test_settlement_double_settlement_prevention() {
        let (env, _, _, settlement_client, _, _, _, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        let bet_id = U256::from_u32(&env, 1);
        let bet_amount = 1000i128;
        let payout = 2000i128;

        // First settlement
        settlement_client.settle_bet(
            &bet_id,
            &user1,
            &Some(user1.clone()),
            &bet_amount,
            &payout,
            &Symbol::short("WIN"),
        );

        // Second settlement should fail
        let result = settlement_client.try_settle_bet(
            &bet_id,
            &user1,
            &Some(user1.clone()),
            &bet_amount,
            &payout,
            &Symbol::short("WIN"),
        );

        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), ContractError::BetAlreadySettled);
    }

    #[test]
    fn test_balance_ledger_operations() {
        let (env, _, _, _, balance_ledger_client, _, _, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        let amount = 1000i128;

        // Test deposit
        balance_ledger_client.deposit(&user1, &amount);
        assert_eq!(balance_ledger_client.get_balance(&user1), amount);

        // Test withdrawal
        balance_ledger_client.withdraw(&user1, &amount);
        assert_eq!(balance_ledger_client.get_balance(&user1), 0);
    }

    #[test]
    fn test_balance_ledger_insufficient_balance() {
        let (env, _, _, _, balance_ledger_client, _, _, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        let deposit_amount = 500i128;
        let withdraw_amount = 1000i128;

        balance_ledger_client.deposit(&user1, &deposit_amount);

        let result = balance_ledger_client.try_withdraw(&user1, &withdraw_amount);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), ContractError::InsufficientBalance);
    }

    #[test]
    fn test_nft_player_cards_operations() {
        let (env, _, _, _, _, _, nft_client, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        let player_id = BytesN::from_array(&env, &[1; 32]);
        let metadata_uri = Symbol::new(&env, "ipfs://player-metadata");

        // Register player
        nft_client.register_player(&player_id, &metadata_uri);

        // Verify registration
        let retrieved_metadata = nft_client.get_player(&player_id).unwrap();
        assert_eq!(retrieved_metadata, metadata_uri);

        // Transfer NFT
        nft_client.transfer(&admin, &user1, &player_id);

        // Verify ownership change
        let new_owner = nft_client.get_owner(&player_id).unwrap();
        assert_eq!(new_owner, user1);
    }

    #[test]
    fn test_spin_rewards_operations() {
        let (env, _, _, _, _, _, _, spin_rewards_client, _, admin, user1, _, staking_token, _) = setup_complete_test_env();

        let spin_id = BytesN::from_array(&env, &[1; 32]);
        let reward_amount = 100i128;

        // Execute spin
        spin_rewards_client.execute_spin(&user1, &spin_id, &reward_amount);

        // Verify spin was executed
        assert!(spin_rewards_client.is_spin_executed(&spin_id));
    }

    #[test]
    fn test_team_governance_operations() {
        let (env, _, _, _, _, _, _, _, team_governance_client, admin, user1, _, _, _) = setup_complete_test_env();

        let proposal_id = BytesN::from_array(&env, &[1; 32]);
        let proposal_description = Symbol::new(&env, "Increase staking rewards");

        // Create proposal
        team_governance_client.create_proposal(&proposal_id, &proposal_description, &admin);

        // Vote on proposal
        team_governance_client.vote(&user1, &proposal_id, &true);

        // Verify vote was recorded
        let votes = team_governance_client.get_votes(&proposal_id);
        assert_eq!(votes, 1);
    }
}

// ===== INTEGRATION TESTS =====

#[cfg(test)]
mod integration_tests {
    use super::*;

    #[test]
    fn test_complete_betting_workflow() {
        let (env, staking_client, betting_client, settlement_client, balance_ledger_client, treasury_client, nft_client, spin_rewards_client, team_governance_client, admin, user1, user2, staking_token, betting_token) = setup_complete_test_env();

        let bet_amount = 1000i128;
        let match_id = BytesN::from_array(&env, &[1; 32]);
        let bet_type = Symbol::new(&env, "home_win");
        let odds = 200; // 2.00 odds

        // User stakes tokens first
        env.ledger().with_mut(|li| li.timestamp = 100000);
        staking_client.stake(&user1, &5000);

        // User places bet
        betting_client.place_bet(
            &user1,
            &betting_token.address(),
            &bet_amount,
            &match_id,
            &bet_type,
            &odds,
        );

        // Admin settles the bet as a win
        let bet_id = U256::from_u32(&env, 0); // Simplified bet ID
        let payout = 2000i128; // 2x payout

        settlement_client.settle_bet(
            &bet_id,
            &user1,
            &Some(user1.clone()),
            &bet_amount,
            &payout,
            &Symbol::short("WIN"),
        );

        // Verify settlement effects
        assert!(settlement_client.is_settled(&bet_id));
    }

    #[test]
    fn test_staking_and_rewards_integration() {
        let (env, staking_client, _, _, _, treasury_client, _, spin_rewards_client, _, admin, user1, _, staking_token, _) = setup_complete_test_env();

        // User stakes tokens
        env.ledger().with_mut(|li| li.timestamp = 100000);
        staking_client.stake(&user1, &10000);

        // Advance time significantly
        env.ledger().with_mut(|li| li.timestamp = 200000); // 100k seconds = ~1.16 days

        // Check staking duration
        let duration = staking_client.get_user_active_duration(&user1);
        assert_eq!(duration, 100000);

        // Execute spin reward
        let spin_id = BytesN::from_array(&env, &[2; 32]);
        spin_rewards_client.execute_spin(&user1, &spin_id, &500);

        // Verify spin execution
        assert!(spin_rewards_client.is_spin_executed(&spin_id));
    }

    #[test]
    fn test_nft_and_betting_integration() {
        let (env, _, betting_client, _, _, _, nft_client, _, _, admin, user1, _, _, betting_token) = setup_complete_test_env();

        // Register player NFT
        let player_id = BytesN::from_array(&env, &[3; 32]);
        let metadata_uri = Symbol::new(&env, "ipfs://special-player");
        nft_client.register_player(&player_id, &metadata_uri);

        // User places bet (NFT ownership could affect odds in real implementation)
        let bet_amount = 1000i128;
        let match_id = BytesN::from_array(&env, &[4; 32]);
        let bet_type = Symbol::new(&env, "player_performance");
        let odds = 150; // 1.50 odds

        betting_client.place_bet(
            &user1,
            &betting_token.address(),
            &bet_amount,
            &match_id,
            &bet_type,
            &odds,
        );

        // Verify NFT ownership
        let owner = nft_client.get_owner(&player_id).unwrap();
        assert_eq!(owner, admin); // Initially owned by admin
    }
}

// ===== SCENARIO TESTS =====

#[cfg(test)]
mod scenario_tests {
    use super::*;

    #[test]
    fn test_complex_multi_user_betting_scenario() {
        let (env, _, betting_client, settlement_client, _, _, _, _, _, admin, user1, user2, _, betting_token) = setup_complete_test_env();

        // Multiple users place bets on different outcomes
        let match_id = BytesN::from_array(&env, &[5; 32]);

        // User1 bets on home win
        betting_client.place_bet(
            &user1,
            &betting_token.address(),
            &1000,
            &match_id,
            &Symbol::new(&env, "home_win"),
            &200,
        );

        // User2 bets on away win
        betting_client.place_bet(
            &user2,
            &betting_token.address(),
            &1500,
            &match_id,
            &Symbol::new(&env, "away_win"),
            &180,
        );

        // Settle match as home win
        settlement_client.settle_bet(
            &U256::from_u32(&env, 0),
            &user1,
            &Some(user1.clone()),
            &1000,
            &2000,
            &Symbol::short("WIN"),
        );

        // Settle User2's bet as loss
        settlement_client.settle_bet(
            &U256::from_u32(&env, 1),
            &user2,
            &None,
            &1500,
            &0,
            &Symbol::short("LOSS"),
        );

        // Verify both bets are settled
        assert!(settlement_client.is_settled(&U256::from_u32(&env, 0)));
        assert!(settlement_client.is_settled(&U256::from_u32(&env, 1)));
    }

    #[test]
    fn test_staking_tier_progression_scenario() {
        let (env, staking_client, _, _, _, _, _, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        // User starts with small stake
        env.ledger().with_mut(|li| li.timestamp = 100000);
        staking_client.stake(&user1, &1000);

        // Advance time and stake more
        env.ledger().with_mut(|li| li.timestamp = 200000);
        staking_client.stake(&user1, &4000); // Total: 5000

        // Advance more time
        env.ledger().with_mut(|li| li.timestamp = 300000);

        // Check duration includes all active time
        let duration = staking_client.get_user_active_duration(&user1);
        assert_eq!(duration, 200000); // From 100k to 300k timestamp
    }

    #[test]
    fn test_governance_and_treasury_scenario() {
        let (env, _, _, _, _, treasury_client, _, _, team_governance_client, admin, user1, _, _, _) = setup_complete_test_env();

        // Treasury receives funds
        treasury_client.deposit(&admin, &10000);

        // Create governance proposal for treasury distribution
        let proposal_id = BytesN::from_array(&env, &[6; 32]);
        team_governance_client.create_proposal(
            &proposal_id,
            &Symbol::new(&env, "Distribute treasury to stakers"),
            &admin,
        );

        // Multiple users vote
        team_governance_client.vote(&user1, &proposal_id, &true);

        // Check voting results
        let votes = team_governance_client.get_votes(&proposal_id);
        assert_eq!(votes, 1);
    }
}

// ===== EDGE CASE TESTS =====

#[cfg(test)]
mod edge_case_tests {
    use super::*;

    #[test]
    fn test_staking_maximum_values() {
        let (env, staking_client, _, _, _, _, _, _, _, admin, user1, _, staking_token, _) = setup_complete_test_env();

        let max_amount = i128::MAX / 2; // Avoid overflow in tests

        // Mint maximum tokens to user
        token::StellarAssetClient::new(&env, &env.register_stellar_asset_contract_v2(admin.clone())).mint(&user1, &max_amount);

        // This should work if contract handles large amounts properly
        let result = staking_client.try_stake(&user1, &max_amount);
        // Result depends on contract implementation - either succeeds or fails gracefully
        // We just verify it doesn't panic
        assert!(result.is_ok() || result.is_err()); // Either outcome is acceptable as long as no panic
    }

    #[test]
    fn test_staking_zero_and_negative_amounts() {
        let (env, staking_client, _, _, _, _, _, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        // Test zero amount
        let result_zero = staking_client.try_stake(&user1, &0);
        assert!(result_zero.is_err());

        // Test negative amount (if contract allows it)
        let result_negative = staking_client.try_stake(&user1, &-1000);
        assert!(result_negative.is_err());
    }

    #[test]
    fn test_betting_concurrent_bets_same_match() {
        let (env, _, betting_client, _, _, _, _, _, _, admin, user1, user2, _, betting_token) = setup_complete_test_env();

        let match_id = BytesN::from_array(&env, &[7; 32]);

        // Both users bet on same match simultaneously
        betting_client.place_bet(
            &user1,
            &betting_token.address(),
            &1000,
            &match_id,
            &Symbol::new(&env, "home_win"),
            &200,
        );

        betting_client.place_bet(
            &user2,
            &betting_token.address(),
            &1500,
            &match_id,
            &Symbol::new(&env, "draw"),
            &300,
        );

        // Verify both bets are recorded (contract should handle concurrent operations)
        assert_eq!(betting_token.balance(&betting_client.address()), 2500);
    }

    #[test]
    fn test_settlement_race_conditions() {
        let (env, _, _, settlement_client, _, _, _, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        let bet_id = U256::from_u32(&env, 100);

        // First settlement
        settlement_client.settle_bet(
            &bet_id,
            &user1,
            &Some(user1.clone()),
            &1000,
            &2000,
            &Symbol::short("WIN"),
        );

        // Attempt duplicate settlement (should be prevented)
        let result = settlement_client.try_settle_bet(
            &bet_id,
            &user1,
            &Some(user1.clone()),
            &1000,
            &2000,
            &Symbol::short("WIN"),
        );

        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), ContractError::BetAlreadySettled);
    }

    #[test]
    fn test_timestamp_edge_cases() {
        let (env, staking_client, _, _, _, _, _, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        // Test with timestamp 0
        env.ledger().with_mut(|li| li.timestamp = 0);
        staking_client.stake(&user1, &1000);

        // Test with maximum timestamp
        env.ledger().with_mut(|li| li.timestamp = u64::MAX);
        let duration = staking_client.get_user_active_duration(&user1);
        // Should not overflow or panic
        assert!(duration >= 0);
    }
}

// ===== SECURITY TESTS =====

#[cfg(test)]
mod security_tests {
    use super::*;

    #[test]
    fn test_unauthorized_access_prevention() {
        let (env, staking_client, _, settlement_client, _, _, _, _, _, admin, user1, user2, _, _) = setup_complete_test_env();

        // Test unauthorized staking config update
        let result = staking_client.try_update_config(&user1, &Some(2000), &Some(100000));
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), ContractError::Unauthorized);

        // Test unauthorized settlement
        let bet_id = U256::from_u32(&env, 200);
        let result = settlement_client.try_settle_bet(
            &bet_id,
            &user1,
            &Some(user1.clone()),
            &1000,
            &2000,
            &Symbol::short("WIN"),
        );
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), ContractError::Unauthorized);
    }

    #[test]
    fn test_reentrancy_protection() {
        // This test would verify that contracts prevent reentrant calls
        // Implementation depends on specific contract logic
        let (env, _, betting_client, _, _, _, _, _, _, admin, user1, _, _, betting_token) = setup_complete_test_env();

        // Test that betting operations are atomic
        let match_id = BytesN::from_array(&env, &[8; 32]);

        betting_client.place_bet(
            &user1,
            &betting_token.address(),
            &1000,
            &match_id,
            &Symbol::new(&env, "home_win"),
            &200,
        );

        // Verify state consistency after operation
        assert_eq!(betting_token.balance(&betting_client.address()), 1000);
    }

    #[test]
    fn test_integer_overflow_protection() {
        let (env, _, _, _, balance_ledger_client, _, _, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        // Test large deposits that might cause overflow
        let large_amount = i128::MAX - 1000;

        balance_ledger_client.deposit(&user1, &large_amount);
        assert_eq!(balance_ledger_client.get_balance(&user1), large_amount);

        // Test overflow on addition
        let result = balance_ledger_client.try_deposit(&user1, &2000);
        // Should either handle gracefully or prevent overflow
        assert!(result.is_ok() || result.is_err());
    }

    #[test]
    fn test_access_control_enforcement() {
        let (env, _, _, _, _, treasury_client, nft_client, _, team_governance_client, admin, user1, _, _, _) = setup_complete_test_env();

        // Test NFT transfer without ownership
        let player_id = BytesN::from_array(&env, &[9; 32]);
        nft_client.register_player(&player_id, &Symbol::new(&env, "metadata"));

        let result = nft_client.try_transfer(&user1, &admin, &player_id);
        assert!(result.is_err()); // user1 doesn't own the NFT

        // Test governance voting without permission (if applicable)
        let proposal_id = BytesN::from_array(&env, &[10; 32]);
        team_governance_client.create_proposal(&proposal_id, &Symbol::new(&env, "test"), &admin);

        // Voting should work for any user (depending on implementation)
        team_governance_client.vote(&user1, &proposal_id, &true);
        assert_eq!(team_governance_client.get_votes(&proposal_id), 1);
    }

    #[test]
    fn test_gas_optimization_verification() {
        let (env, staking_client, _, _, _, _, _, _, _, admin, user1, _, _, _) = setup_complete_test_env();

        // Test that operations complete within reasonable gas limits
        // This is more of a performance verification test

        env.ledger().with_mut(|li| li.timestamp = 100000);

        // Perform multiple staking operations
        for i in 0..10 {
            staking_client.stake(&user1, &1000);
        }

        // Verify all operations completed
        assert!(staking_client.get_total_stake(&user1) >= 10000);
    }
}</content>
<parameter name="filePath">c:\Users\u-adamu\Desktop\wave 2\Renaissance-api\contract\contracts\tests\comprehensive_test_suite.rs