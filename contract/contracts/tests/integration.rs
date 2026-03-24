#[test]
fn staking_triggers_treasury_payout() {
    let env = Env::default();
    let treasury = Treasury {};
    let staking = Staking {};

    let user = Address::random(&env);

    // Deposit funds into treasury
    treasury.deposit(env.clone(), user.clone(), 1000);

    // Stake some funds
    staking.stake(env.clone(), user.clone(), StakeId("stake1".into()), 500);

    // Unstake triggers treasury withdrawal
    staking.unstake(env.clone(), user.clone(), StakeId("stake1".into()));

    // Verify treasury balance decreased
    let key = format!("{}{}", TREASURY_BALANCE, user.clone());
    let balance: i128 = env.storage().get(&key).unwrap_or(0);
    assert_eq!(balance, 500);
}


#[test]
fn betting_escrow_releases_to_winner() {
    let env = Env::default();
    let treasury = Treasury {};
    let escrow = BettingEscrow {};

    let player1 = Address::random(&env);
    let player2 = Address::random(&env);

    // Player1 creates bet
    escrow.create_bet(env.clone(), BetId("bet1".into()), player1.clone(), 200);

    // Settle bet in favor of player2
    escrow.settle_bet(env.clone(), BetId("bet1".into()), player2.clone());

    // Verify escrow storage cleared
    let key = format!("{}{}", BET_ESCROW, "bet1");
    assert!(env.storage().get::<i128>(&key).is_none());
}


#[test]
fn nft_player_cards_used_in_betting() {
    let env = Env::default();
    let nft = NFTPlayerCards {};
    let escrow = BettingEscrow {};

    let player = Address::random(&env);
    let player_id = PlayerId("player123".into());

    // Register player NFT
    nft.register_player(env.clone(), player_id.clone(), "ipfs://metadata".into());

    // Verify player metadata exists
    let metadata = nft.get_player(env.clone(), player_id.clone());
    assert_eq!(metadata.unwrap(), "ipfs://metadata");

    // Player enters bet
    escrow.create_bet(env.clone(), BetId("bet2".into()), player.clone(), 300);

    // Verify bet escrow recorded
    let key = format!("{}{}", BET_ESCROW, "bet2");
    let amount: i128 = env.storage().get(&key).unwrap();
    assert_eq!(amount, 300);
}


