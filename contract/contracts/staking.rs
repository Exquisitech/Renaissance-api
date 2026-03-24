#![no_std]

use soroban_sdk::{contractimpl, Env, Symbol, Map, Vec, Address};

#[derive(Clone)]
pub struct Tier {
    pub name: Symbol,
    pub min_stake: i128,      // Minimum stake to reach this tier
    pub min_duration: u64,    // Minimum lock duration in seconds
    pub multiplier: i128,     // Integer multiplier (e.g., 150 = 1.5x)
}

#[derive(Clone)]
pub struct Stake {
    pub amount: i128,
    pub start_time: u64,
}

pub struct StakingContract {
    pub tiers: Vec<Tier>,
    pub stakes: Map<Address, Stake>,
    pub tier_map: Map<Address, Symbol>,
}

#[contractimpl]
impl StakingContract {
    // Initialize contract with tiers
    pub fn init(env: Env) -> StakingContract {
        let tiers = vec![
            Tier { name: Symbol::short("Bronze"), min_stake: 100, min_duration: 0, multiplier: 100 },
            Tier { name: Symbol::short("Silver"), min_stake: 500, min_duration: 7*24*3600, multiplier: 125 },
            Tier { name: Symbol::short("Gold"), min_stake: 1000, min_duration: 14*24*3600, multiplier: 150 },
            Tier { name: Symbol::short("Platinum"), min_stake: 5000, min_duration: 30*24*3600, multiplier: 200 },
        ];
        StakingContract {
            tiers: Vec::from_array(&env, tiers),
            stakes: Map::new(&env),
            tier_map: Map::new(&env),
        }
    }

    // Stake tokens
    pub fn stake(&mut self, env: Env, user: Address, amount: i128) {
        let now = env.ledger().timestamp();
        self.stakes.set(user.clone(), Stake { amount, start_time: now });
        self.recalculate_tier(env, user);
    }

    // Recalculate tier
    pub fn recalculate_tier(&mut self, env: Env, user: Address) {
        let stake = self.stakes.get(user.clone()).unwrap();
        let now = env.ledger().timestamp();
        let mut best_tier = Symbol::short("Bronze");

        for t in self.tiers.iter() {
            if stake.amount >= t.min_stake && (now - stake.start_time) >= t.min_duration {
                best_tier = t.name.clone();
            }
        }

        let current_tier = self.tier_map.get(user.clone());
        if current_tier.is_none() || current_tier.unwrap() != best_tier {
            self.tier_map.set(user.clone(), best_tier.clone());
            env.events().publish((Symbol::short("tier_upgraded"), user.clone()), best_tier);
        }
    }

    // Query user's tier
    pub fn get_tier(&self, user: Address) -> Option<Symbol> {
        self.tier_map.get(user)
    }
}