use soroban_sdk::Env;
use drip_contracts::profitability_tracker::ProfitabilityTracker;

#[test]
fn test_profitability_counters() {
    let env = Env::default();
    ProfitabilityTracker::init(env.clone());

    ProfitabilityTracker::add_deposit(env.clone(), 1000);
    ProfitabilityTracker::add_payout(env.clone(), 300);

    let deposits = ProfitabilityTracker::total_deposits(env.clone());
    let payouts = ProfitabilityTracker::total_payouts(env.clone());
    let net = ProfitabilityTracker::net_surplus(env.clone());

    assert_eq!(deposits, 1000);
    assert_eq!(payouts, 300);
    assert_eq!(net, 700);

    // Test snapshot emits
    ProfitabilityTracker::snapshot(env.clone());
}