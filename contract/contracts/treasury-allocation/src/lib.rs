#![no_std]

use soroban_sdk::{contractimpl, symbol, Address, Env, Map};

#[derive(Clone)]
pub struct TreasuryAllocation;

#[derive(Debug)]
pub struct Pool {
    balance: i128,
}

#[derive(Debug)]
pub struct AllocationRatios {
    betting_pool: u32,   // percentage (0-100)
    spin_rewards: u32,
    staking_rewards: u32,
    emergency_reserve: u32,
}

#[contractimpl]
impl TreasuryAllocation {
    // Initialize pools with starting balances
    pub fn init(env: Env, admin: Address, total_reserve: i128) {
        env.storage().set(&symbol!("admin"), &admin);
        env.storage().set(&symbol!("total_reserve"), &total_reserve);
        env.storage().set(&symbol!("betting_pool"), &0i128);
        env.storage().set(&symbol!("spin_rewards"), &0i128);
        env.storage().set(&symbol!("staking_rewards"), &0i128);
        env.storage().set(&symbol!("emergency_reserve"), &0i128);
        
        // default allocation ratios
        env.storage().set(&symbol!("allocation_ratios"), &AllocationRatios {
            betting_pool: 40,
            spin_rewards: 30,
            staking_rewards: 20,
            emergency_reserve: 10,
        });
    }

    // Update allocation ratios (only admin)
    pub fn update_ratios(env: Env, sender: Address, ratios: AllocationRatios) {
        let admin: Address = env.storage().get(&symbol!("admin")).unwrap().unwrap();
        if sender != admin {
            panic!("Unauthorized");
        }
        let total: u32 = ratios.betting_pool + ratios.spin_rewards + ratios.staking_rewards + ratios.emergency_reserve;
        if total != 100 {
            panic!("Ratios must sum to 100");
        }
        env.storage().set(&symbol!("allocation_ratios"), &ratios);
    }

    // Rebalance funds across pools
    pub fn rebalance(env: Env, sender: Address) {
        let admin: Address = env.storage().get(&symbol!("admin")).unwrap().unwrap();
        if sender != admin {
            panic!("Unauthorized");
        }

        let total_reserve: i128 = env.storage().get(&symbol!("total_reserve")).unwrap().unwrap();
        let ratios: AllocationRatios = env.storage().get(&symbol!("allocation_ratios")).unwrap().unwrap();

        let betting_amount = total_reserve * (ratios.betting_pool as i128) / 100;
        let spin_amount = total_reserve * (ratios.spin_rewards as i128) / 100;
        let staking_amount = total_reserve * (ratios.staking_rewards as i128) / 100;
        let emergency_amount = total_reserve * (ratios.emergency_reserve as i128) / 100;

        env.storage().set(&symbol!("betting_pool"), &betting_amount);
        env.storage().set(&symbol!("spin_rewards"), &spin_amount);
        env.storage().set(&symbol!("staking_rewards"), &staking_amount);
        env.storage().set(&symbol!("emergency_reserve"), &emergency_amount);

        env.events().publish(
            (symbol!("reallocation"),),
            Map::from([
                (symbol!("betting_pool"), betting_amount.into()),
                (symbol!("spin_rewards"), spin_amount.into()),
                (symbol!("staking_rewards"), staking_amount.into()),
                (symbol!("emergency_reserve"), emergency_amount.into()),
            ]),
        );
    }

    // Get pool balance
    pub fn get_pool_balance(env: Env, pool: symbol::Symbol) -> i128 {
        env.storage().get(&pool).unwrap().unwrap_or(0)
    }
}