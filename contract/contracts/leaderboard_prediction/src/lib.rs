#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, symbol_short};

#[contract]
pub struct LeaderboardPredictionMarket;

#[contracttype]
#[derive(Clone)]
pub struct Bet {
    pub bettor: Address,
    pub player_id: u32,
    pub predicted_rank: u32,
    pub amount: i128,
    pub odds: u32, // Multiplier in basis points (e.g., 20000 = 2x)
    pub has_insurance: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct UserStreak {
    pub streak_count: u32,
    pub last_bet_day: u64,
}

#[contractimpl]
impl LeaderboardPredictionMarket {
    /// Initialize the prediction market for a specific timeframe or event.
    pub fn init(env: Env) {
        let bets: Map<u64, Bet> = Map::new(&env);
        env.storage().instance().set(&symbol_short!("bets"), &bets);
        env.storage().instance().set(&symbol_short!("open"), &true);
        env.storage().instance().set(&symbol_short!("nxt_id"), &0u64);
        env.storage().instance().set(&symbol_short!("ins_pool"), &0i128);
    }

    /// Place a bet on a player's future rank.
    /// Odds are dynamically calculated based on current position and volatility.
    pub fn place_bet(
        env: Env,
        bettor: Address,
        player_id: u32,
        predicted_rank: u32,
        amount: i128,
        current_rank: u32,
        volatility_index: u32,
        expected_odds: u32,
        max_slippage_bps: u32,
        has_insurance: bool,
    ) -> u64 {
        bettor.require_auth();

        let is_open: bool = env.storage().instance().get(&symbol_short!("open")).unwrap_or(false);
        assert!(is_open, "Market is currently closed");

        // Calculate odds (simplified):
        // Higher rank difference = higher odds.
        // Higher volatility = lower predictability, so odds could be adjusted up or down.
        let rank_diff = current_rank.abs_diff(predicted_rank);
        
        let current_day = env.ledger().timestamp() / 86400;
        let mut streaks: Map<Address, UserStreak> = env.storage().instance().get(&symbol_short!("streaks")).unwrap_or_else(|| Map::new(&env));
        let mut user_streak = streaks.get(bettor.clone()).unwrap_or(UserStreak { streak_count: 0, last_bet_day: 0 });

        if current_day == user_streak.last_bet_day + 1 {
            user_streak.streak_count += 1; // Consecutive day
        } else if current_day > user_streak.last_bet_day + 1 {
            user_streak.streak_count = 1; // Streak broken
        } else if user_streak.streak_count == 0 {
            user_streak.streak_count = 1; // First bet ever
        }
        // If current_day == last_bet_day, streak is maintained but not incremented

        user_streak.last_bet_day = current_day;
        streaks.set(bettor.clone(), user_streak.clone());
        env.storage().instance().set(&symbol_short!("streaks"), &streaks);

        // Base odds of 1.0x (10000 bps) + diff bonus + volatility factor
        let base_odds = 10000 + (rank_diff * 500) + (volatility_index * 100);

        // Streak bonus: +5% per consecutive day (starting from day 2), max 50%
        let bonus_pct = core::cmp::min(user_streak.streak_count.saturating_sub(1) * 5, 50);
        let odds = base_odds + (base_odds * bonus_pct / 100);

        // Slippage protection: ensure calculated odds do not deviate beyond the threshold
        let slippage = if expected_odds > odds { expected_odds - odds } else { odds - expected_odds };
        assert!(slippage <= max_slippage_bps, "Slippage exceeded: odds changed beyond threshold");

        let mut actual_amount = amount;
        if has_insurance {
            // 2% insurance fee deducted from stake
            let fee = amount * 2 / 100;
            actual_amount = amount - fee;
            
            let mut ins_pool: i128 = env.storage().instance().get(&symbol_short!("ins_pool")).unwrap_or(0);
            ins_pool += fee;
            env.storage().instance().set(&symbol_short!("ins_pool"), &ins_pool);
        }

        let bet = Bet {
            bettor,
            player_id,
            predicted_rank,
            amount: actual_amount,
            odds,
            has_insurance,
        };

        // Note: Escrow logic (transferring user funds to contract) would be implemented here 
        // via standard soroban token client interfaces.

        let mut bets: Map<u64, Bet> = env.storage().instance().get(&symbol_short!("bets")).unwrap();
        let mut next_id: u64 = env.storage().instance().get(&symbol_short!("nxt_id")).unwrap();
        
        let bet_id = next_id;
        bets.set(bet_id, bet);
        next_id += 1;
        
        env.storage().instance().set(&symbol_short!("bets"), &bets);
        env.storage().instance().set(&symbol_short!("nxt_id"), &next_id);

        bet_id
    }

    /// Settle the market using the final actual rankings and distribute payouts.
    pub fn settle(env: Env, final_rankings: Map<u32, u32>) {
        // Note: Admin authorization should be checked here to prevent unauthorized settlement.

        // Close the market to prevent new bets
        env.storage().instance().set(&symbol_short!("open"), &false);

        let bets: Map<u64, Bet> = env.storage().instance().get(&symbol_short!("bets")).unwrap();
        let mut ins_pool: i128 = env.storage().instance().get(&symbol_short!("ins_pool")).unwrap_or(0);

        for (_id, bet) in bets.into_iter() {
            if let Some(actual_rank) = final_rankings.get(bet.player_id) {
                if actual_rank == bet.predicted_rank {
                    // Win condition
                    let payout = (bet.amount * bet.odds as i128) / 10000;
                    
                    // Note: Payout logic (transferring funds back to bet.bettor) 
                    // would be implemented here using token client.
                    let _ = payout; // suppress unused warning
                } else if bet.has_insurance && actual_rank.abs_diff(bet.predicted_rank) == 1 {
                    // Insurance payout: missed by narrow margin (1 rank difference)
                    // Refund the stake from the insurance pool (up to available funds)
                    let refund = core::cmp::min(bet.amount, ins_pool);
                    ins_pool -= refund;
                    
                    // Note: Refund transfer logic goes here
                    let _ = refund;
                }
            }
        }
        
        env.storage().instance().set(&symbol_short!("ins_pool"), &ins_pool);
    }

    /// Display streak in rankings / UI. Retrieves the user's active streak.
    pub fn get_user_streak(env: Env, bettor: Address) -> u32 {
        let streaks: Map<Address, UserStreak> = env.storage().instance().get(&symbol_short!("streaks")).unwrap_or_else(|| Map::new(&env));
        if let Some(user_streak) = streaks.get(bettor) {
            let current_day = env.ledger().timestamp() / 86400;
            // If more than 1 day has passed without betting, streak is broken
            if current_day > user_streak.last_bet_day + 1 {
                return 0;
            }
            return user_streak.streak_count;
        }
        0
    }
}
