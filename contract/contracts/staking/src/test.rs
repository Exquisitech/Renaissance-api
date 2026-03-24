use crate::{StakingContract, StakingContractClient};
use common::errors::ContractError;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, Address, Env};
// use common::events::{STAKE_EVENT, UNSTAKE_EVENT}; // for event checking

fn setup_test() -> (
    Env,
    StakingContractClient<'static>,
    Address,
    Address,
    token::Client<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_client = token::Client::new(&env, &token_contract_id.address());

    // Mint tokens to user for staking
    token::StellarAssetClient::new(&env, &token_contract_id.address()).mint(&user, &100_000_000);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    (env, client, admin, user, token_client)
}

#[test]
fn test_initialize() {
    let (_env, client, admin, _user, token_client) = setup_test();
    let min_stake = 1000;
    let cooldown_period = 86400; // 1 day in seconds

    client.initialize(&admin, &token_client.address, &min_stake, &cooldown_period);

    // Test double initialize
    let res = client.try_initialize(&admin, &token_client.address, &min_stake, &cooldown_period);
    assert!(res.is_err());
}

#[test]
fn test_stake_and_unstake() {
    let (env, client, admin, user, token_client) = setup_test();
    let min_stake = 1000;
    let cooldown_period = 86400; // 1 day in seconds

    client.initialize(&admin, &token_client.address, &min_stake, &cooldown_period);

    let amount = 5000;

    env.ledger().with_mut(|li| {
        li.timestamp = 100000;
    });

    // Stake
    let stake_id = client.stake(&user, &amount);

    assert_eq!(token_client.balance(&user), 100_000_000 - amount);
    assert_eq!(token_client.balance(&client.address), amount);
    assert_eq!(client.get_total_stake(&user), amount);

    // Attempt early unstake
    env.ledger().with_mut(|li| {
        li.timestamp = 100000 + 40000; // Less than 86400 cooldown
    });

    let try_early = client.try_unstake(&user, &stake_id);
    assert_eq!(try_early, Err(Ok(ContractError::CooldownNotMet)));

    // Unstake successful
    env.ledger().with_mut(|li| {
        li.timestamp = 100000 + 90000; // Passed 86400 cooldown
    });

    client.unstake(&user, &stake_id);
    assert_eq!(client.get_total_stake(&user), 0);
    assert_eq!(token_client.balance(&user), 100_000_000); // Returned to original balance
    assert_eq!(token_client.balance(&client.address), 0);
}

#[test]
fn test_below_min_stake() {
    let (_env, client, admin, user, token_client) = setup_test();
    let min_stake = 1000;
    let cooldown_period = 86400;

    client.initialize(&admin, &token_client.address, &min_stake, &cooldown_period);

    let amount = 500;
    let res = client.try_stake(&user, &amount);
    assert_eq!(res, Err(Ok(ContractError::BelowMinStake)));
}

#[test]
fn test_stake_not_found() {
    let (env, client, admin, user, token_client) = setup_test();
    let min_stake = 1000;
    let cooldown_period = 86400;

    client.initialize(&admin, &token_client.address, &min_stake, &cooldown_period);

    // Attempt to unstake a non-existent stake ID
    let fake_id = soroban_sdk::U256::from_u32(&env, 999);
    let res = client.try_unstake(&user, &fake_id);
    assert_eq!(res, Err(Ok(ContractError::StakeNotFound)));
}
