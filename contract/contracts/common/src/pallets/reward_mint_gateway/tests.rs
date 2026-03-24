use crate::{mock::*, Error};
use frame_support::{assert_ok, assert_noop};

#[test]
fn unauthorized_contract_cannot_mint() {
    new_test_ext().execute_with(|| {
        // Caller is not authorized
        assert_noop!(
            RewardMintGateway::mint_reward(
                Origin::signed(1), // caller
                2,                 // recipient
                b"reward123".to_vec(),
                b"https://metadata".to_vec()
            ),
            Error::<TestRuntime>::UnauthorizedContract
        );
    });
}

#[test]
fn authorized_contract_can_mint() {
    new_test_ext().execute_with(|| {
        // Authorize caller (account 1)
        assert_ok!(RewardMintGateway::authorize_contract(Origin::root(), 1, true));

        // Mint reward
        assert_ok!(RewardMintGateway::mint_reward(
            Origin::signed(1),
            2,
            b"reward123".to_vec(),
            b"https://metadata".to_vec()
        ));

        // Verify event emitted
        let events = frame_system::Pallet::<TestRuntime>::events();
        assert!(events.iter().any(|e| {
            matches!(
                e.event,
                TestEvent::RewardMintGateway(crate::Event::RewardMinted(_, _, _, _))
            )
        }));
    });
}

#[test]
fn cannot_mint_same_reward_twice() {
    new_test_ext().execute_with(|| {
        assert_ok!(RewardMintGateway::authorize_contract(Origin::root(), 1, true));

        // First mint succeeds
        assert_ok!(RewardMintGateway::mint_reward(
            Origin::signed(1),
            2,
            b"reward123".to_vec(),
            b"https://metadata".to_vec()
        ));

        // Second mint with same rewardId fails
        assert_noop!(
            RewardMintGateway::mint_reward(
                Origin::signed(1),
                3,
                b"reward123".to_vec(),
                b"https://metadata".to_vec()
            ),
            Error::<TestRuntime>::RewardAlreadyExecuted
        );
    });
}

#[test]
fn invalid_metadata_rejected() {
    new_test_ext().execute_with(|| {
        assert_ok!(RewardMintGateway::authorize_contract(Origin::root(), 1, true));

        // Empty metadata should fail
        assert_noop!(
            RewardMintGateway::mint_reward(
                Origin::signed(1),
                2,
                b"reward456".to_vec(),
                b"".to_vec()
            ),
            Error::<TestRuntime>::InvalidMetadata
        );
    });
}
