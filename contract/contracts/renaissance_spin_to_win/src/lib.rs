#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token, vec, Address, Env, Symbol, Vec, Map,
    log, events,
};

// ─── Data Structures ────────────────────────────────────────────────────────

/// Prize tier definition stored in contract state
#[contracttype]
#[derive(Clone, Debug)]
pub struct Prize {
    pub id: u32,
    pub name: Symbol,
    pub token_address: Address,
    pub amount: i128,
    pub weight: u32,       // relative weight for probability (out of total_weight)
    pub is_jackpot: bool,
}

/// Result of a single spin
#[contracttype]
#[derive(Clone, Debug)]
pub struct SpinResult {
    pub spin_id: u64,
    pub player: Address,
    pub prize_id: u32,
    pub prize_name: Symbol,
    pub amount_won: i128,
    pub timestamp: u64,
    pub seed_used: u64,
}

/// Per-player statistics
#[contracttype]
#[derive(Clone, Debug)]
pub struct PlayerStats {
    pub total_spins: u64,
    pub total_won: i128,
    pub last_spin_timestamp: u64,
}

/// Contract configuration / admin settings
#[contracttype]
#[derive(Clone, Debug)]
pub struct Config {
    pub admin: Address,
    pub spin_cost: i128,
    pub spin_token: Address,   // token used to pay for spins
    pub min_balance: i128,     // minimum reserve that must stay in contract
    pub paused: bool,
    pub cooldown_seconds: u64, // seconds a player must wait between spins
}

// ─── Storage Keys ────────────────────────────────────────────────────────────

const CONFIG_KEY: Symbol = symbol_short!("CONFIG");
const PRIZE_MAP_KEY: Symbol = symbol_short!("PRIZES");
const PRIZE_COUNT_KEY: Symbol = symbol_short!("PCNT");
const TOTAL_WEIGHT_KEY: Symbol = symbol_short!("TWEIGHT");
const SPIN_COUNTER_KEY: Symbol = symbol_short!("SCNT");
const HISTORY_KEY: Symbol = symbol_short!("HISTORY");

fn player_stats_key(env: &Env, player: &Address) -> soroban_sdk::Bytes {
    let mut key = soroban_sdk::Bytes::new(env);
    key.extend_from_slice(b"ps_");
    key.extend_from_array(&player.to_string().as_bytes());
    key
}

// ─── Events ──────────────────────────────────────────────────────────────────

const EVT_SPIN: Symbol = symbol_short!("SPIN");
const EVT_PRIZE: Symbol = symbol_short!("PRIZE");
const EVT_PRIZE_ADD: Symbol = symbol_short!("PRIZE_ADD");
const EVT_WITHDRAW: Symbol = symbol_short!("WITHDRAW");
const EVT_PAUSE: Symbol = symbol_short!("PAUSE");
const EVT_CONFIG: Symbol = symbol_short!("CONFIG_UPD");

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct SpinToWin;

#[contractimpl]
impl SpinToWin {
    // ── Initialisation ───────────────────────────────────────────────────────

    /// Initialise the contract. Must be called once by the deployer.
    pub fn initialize(
        env: Env,
        admin: Address,
        spin_cost: i128,
        spin_token: Address,
        cooldown_seconds: u64,
        min_balance: i128,
    ) {
        if env.storage().instance().has(&CONFIG_KEY) {
            panic!("already initialised");
        }

        admin.require_auth();

        let config = Config {
            admin: admin.clone(),
            spin_cost,
            spin_token,
            min_balance,
            paused: false,
            cooldown_seconds,
        };

        env.storage().instance().set(&CONFIG_KEY, &config);
        env.storage().instance().set(&PRIZE_COUNT_KEY, &0u32);
        env.storage().instance().set(&TOTAL_WEIGHT_KEY, &0u32);
        env.storage().instance().set(&SPIN_COUNTER_KEY, &0u64);

        // initialise empty history list
        let history: Vec<SpinResult> = vec![&env];
        env.storage().instance().set(&HISTORY_KEY, &history);

        env.events().publish((EVT_CONFIG, symbol_short!("INIT")), admin);
    }

    // ── Admin: prize management ──────────────────────────────────────────────

    /// Add a new prize tier. Only admin.
    pub fn add_prize(
        env: Env,
        name: Symbol,
        token_address: Address,
        amount: i128,
        weight: u32,
        is_jackpot: bool,
    ) -> u32 {
        let config: Config = env.storage().instance().get(&CONFIG_KEY).unwrap();
        config.admin.require_auth();

        if amount <= 0 { panic!("prize amount must be > 0"); }
        if weight == 0 { panic!("weight must be > 0"); }

        let prize_count: u32 = env.storage().instance().get(&PRIZE_COUNT_KEY).unwrap();
        let id = prize_count;

        let prize = Prize { id, name: name.clone(), token_address, amount, weight, is_jackpot };

        let mut prize_map: Map<u32, Prize> = env
            .storage().instance()
            .get(&PRIZE_MAP_KEY)
            .unwrap_or(Map::new(&env));

        prize_map.set(id, prize);
        env.storage().instance().set(&PRIZE_MAP_KEY, &prize_map);
        env.storage().instance().set(&PRIZE_COUNT_KEY, &(prize_count + 1));

        let total_weight: u32 = env.storage().instance().get(&TOTAL_WEIGHT_KEY).unwrap();
        env.storage().instance().set(&TOTAL_WEIGHT_KEY, &(total_weight + weight));

        env.events().publish(
            (EVT_PRIZE_ADD, symbol_short!("id")),
            (id, name, weight),
        );

        id
    }

    /// Remove a prize by id. Only admin.
    pub fn remove_prize(env: Env, prize_id: u32) {
        let config: Config = env.storage().instance().get(&CONFIG_KEY).unwrap();
        config.admin.require_auth();

        let mut prize_map: Map<u32, Prize> = env
            .storage().instance()
            .get(&PRIZE_MAP_KEY)
            .unwrap();

        let prize: Prize = prize_map.get(prize_id).expect("prize not found");
        let total_weight: u32 = env.storage().instance().get(&TOTAL_WEIGHT_KEY).unwrap();

        prize_map.remove(prize_id);
        env.storage().instance().set(&PRIZE_MAP_KEY, &prize_map);
        env.storage().instance().set(&TOTAL_WEIGHT_KEY, &(total_weight - prize.weight));
    }

    // ── Admin: config management ─────────────────────────────────────────────

    pub fn update_spin_cost(env: Env, new_cost: i128) {
        let mut config: Config = env.storage().instance().get(&CONFIG_KEY).unwrap();
        config.admin.require_auth();
        config.spin_cost = new_cost;
        env.storage().instance().set(&CONFIG_KEY, &config);
        env.events().publish((EVT_CONFIG, symbol_short!("COST")), new_cost);
    }

    pub fn set_paused(env: Env, paused: bool) {
        let mut config: Config = env.storage().instance().get(&CONFIG_KEY).unwrap();
        config.admin.require_auth();
        config.paused = paused;
        env.storage().instance().set(&CONFIG_KEY, &config);
        env.events().publish((EVT_PAUSE, symbol_short!("state")), paused);
    }

    /// Admin withdraws collected spin fees (above min_balance).
    pub fn admin_withdraw(env: Env, amount: i128, to: Address) {
        let config: Config = env.storage().instance().get(&CONFIG_KEY).unwrap();
        config.admin.require_auth();

        let contract_id = env.current_contract_address();
        let token_client = token::Client::new(&env, &config.spin_token);
        let balance = token_client.balance(&contract_id);

        if balance - amount < config.min_balance {
            panic!("withdrawal would breach min_balance reserve");
        }

        token_client.transfer(&contract_id, &to, &amount);
        env.events().publish((EVT_WITHDRAW, symbol_short!("amt")), (to, amount));
    }

    // ── Core: spin ────────────────────────────────────────────────────────────

    /// Execute a spin for the caller.
    /// Returns the SpinResult.
    pub fn spin(env: Env, player: Address) -> SpinResult {
        player.require_auth();

        let config: Config = env.storage().instance().get(&CONFIG_KEY).unwrap();

        if config.paused {
            panic!("contract is paused");
        }

        // Cooldown enforcement
        let stats_key = player_stats_key(&env, &player);
        let stats: PlayerStats = env
            .storage().persistent()
            .get(&stats_key)
            .unwrap_or(PlayerStats {
                total_spins: 0,
                total_won: 0,
                last_spin_timestamp: 0,
            });

        let now = env.ledger().timestamp();
        if stats.total_spins > 0
            && now < stats.last_spin_timestamp + config.cooldown_seconds
        {
            panic!("cooldown period not elapsed");
        }

        // Deduct spin cost from player
        let token_client = token::Client::new(&env, &config.spin_token);
        let contract_id = env.current_contract_address();
        token_client.transfer(&player, &contract_id, &config.spin_cost);

        // Generate random outcome
        let spin_counter: u64 = env.storage().instance().get(&SPIN_COUNTER_KEY).unwrap();
        let new_spin_id = spin_counter + 1;
        env.storage().instance().set(&SPIN_COUNTER_KEY, &new_spin_id);

        let seed = Self::generate_seed(&env, &player, new_spin_id, now);
        let prize = Self::select_prize(&env, seed);

        // Distribute prize
        let prize_token_client = token::Client::new(&env, &prize.token_address);

        // Safety: check contract has enough balance for payout
        let prize_balance = prize_token_client.balance(&contract_id);
        if prize_balance < prize.amount {
            panic!("insufficient prize reserve");
        }

        prize_token_client.transfer(&contract_id, &player, &prize.amount);

        // Build result
        let result = SpinResult {
            spin_id: new_spin_id,
            player: player.clone(),
            prize_id: prize.id,
            prize_name: prize.name.clone(),
            amount_won: prize.amount,
            timestamp: now,
            seed_used: seed,
        };

        // Update player stats
        let updated_stats = PlayerStats {
            total_spins: stats.total_spins + 1,
            total_won: stats.total_won + prize.amount,
            last_spin_timestamp: now,
        };
        env.storage().persistent().set(&stats_key, &updated_stats);

        // Append to global history (keep last 500 entries)
        let mut history: Vec<SpinResult> = env
            .storage().instance()
            .get(&HISTORY_KEY)
            .unwrap_or(vec![&env]);

        if history.len() >= 500 {
            // trim oldest entry
            let mut new_history: Vec<SpinResult> = vec![&env];
            for i in 1..history.len() {
                new_history.push_back(history.get(i).unwrap());
            }
            new_history.push_back(result.clone());
            history = new_history;
        } else {
            history.push_back(result.clone());
        }
        env.storage().instance().set(&HISTORY_KEY, &history);

        // Emit events
        env.events().publish(
            (EVT_SPIN, symbol_short!("player")),
            (player.clone(), new_spin_id),
        );
        env.events().publish(
            (EVT_PRIZE, symbol_short!("won")),
            (player, prize.name, prize.amount),
        );

        log!(&env, "Spin #{}: player won {} tokens (prize_id={})",
            new_spin_id, prize.amount, prize.id);

        result
    }

    // ── Read-only queries ─────────────────────────────────────────────────────

    pub fn get_config(env: Env) -> Config {
        env.storage().instance().get(&CONFIG_KEY).unwrap()
    }

    pub fn get_prizes(env: Env) -> Vec<Prize> {
        let prize_map: Map<u32, Prize> = env
            .storage().instance()
            .get(&PRIZE_MAP_KEY)
            .unwrap_or(Map::new(&env));

        let mut list: Vec<Prize> = vec![&env];
        for key in prize_map.keys() {
            list.push_back(prize_map.get(key).unwrap());
        }
        list
    }

    pub fn get_player_stats(env: Env, player: Address) -> PlayerStats {
        let key = player_stats_key(&env, &player);
        env.storage().persistent().get(&key).unwrap_or(PlayerStats {
            total_spins: 0,
            total_won: 0,
            last_spin_timestamp: 0,
        })
    }

    pub fn get_spin_history(env: Env) -> Vec<SpinResult> {
        env.storage().instance().get(&HISTORY_KEY).unwrap_or(vec![&env])
    }

    pub fn get_spin_count(env: Env) -> u64 {
        env.storage().instance().get(&SPIN_COUNTER_KEY).unwrap_or(0)
    }

    pub fn get_contract_balance(env: Env) -> i128 {
        let config: Config = env.storage().instance().get(&CONFIG_KEY).unwrap();
        let token_client = token::Client::new(&env, &config.spin_token);
        token_client.balance(&env.current_contract_address())
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /// Deterministic seed from ledger randomness + player + spin id.
    /// Soroban provides `env.prng()` for verifiable randomness via VRF.
    fn generate_seed(env: &Env, player: &Address, spin_id: u64, timestamp: u64) -> u64 {
        // Use Soroban PRNG (seeded by the ledger's VRF randomness)
        let mut rng = env.prng();

        // Mix in player address bytes and spin id for uniqueness
        let player_str = player.to_string();
        let player_bytes = player_str.as_bytes();

        // XOR fold the player bytes into a u64
        let mut player_hash: u64 = 0;
        for (i, b) in player_bytes.iter().enumerate() {
            player_hash ^= (b as u64).wrapping_shl((i % 8) as u32 * 8);
        }

        // Get a random u64 from the PRNG and mix with our additional entropy
        let base: u64 = rng.u64();
        base
            .wrapping_add(player_hash)
            .wrapping_add(spin_id)
            .wrapping_add(timestamp)
    }

    /// Weighted random prize selection using the seed.
    fn select_prize(env: &Env, seed: u64) -> Prize {
        let total_weight: u32 = env.storage().instance().get(&TOTAL_WEIGHT_KEY).unwrap();
        if total_weight == 0 {
            panic!("no prizes configured");
        }

        let roll = (seed % total_weight as u64) as u32;

        let prize_map: Map<u32, Prize> = env
            .storage().instance()
            .get(&PRIZE_MAP_KEY)
            .unwrap();

        let mut cumulative: u32 = 0;
        for key in prize_map.keys() {
            let prize: Prize = prize_map.get(key).unwrap();
            cumulative += prize.weight;
            if roll < cumulative {
                return prize;
            }
        }

        // Fallback (should not reach here if weights are consistent)
        let last_key = prize_map.keys().last().expect("prize_map empty");
        prize_map.get(last_key).unwrap()
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, token, Env};

    fn setup() -> (Env, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let player = Address::generate(&env);

        // Deploy a test token for spin cost
        let token_id = env.register_stellar_asset_contract(admin.clone());
        let spin_token = Address::from_contract_id(&token_id);

        // Deploy contract
        let contract_id = env.register_contract(None, SpinToWin);
        let contract = Address::from_contract_id(&contract_id);

        // Mint spin cost tokens to player
        let token_client = token::StellarAssetClient::new(&env, &spin_token);
        token_client.mint(&player, &1_000_000_000);

        // Mint prize pool to contract
        token_client.mint(&contract, &100_000_000_000);

        (env, admin, player, spin_token, contract)
    }

    #[test]
    fn test_initialize_and_spin() {
        let (env, admin, player, spin_token, contract) = setup();

        let client = SpinToWinClient::new(&env, &contract);

        client.initialize(
            &admin,
            &1_000_000,       // spin cost = 1 XLM (stroops)
            &spin_token,
            &10,              // 10 second cooldown
            &10_000_000_000,  // min_balance
        );

        // Add two prizes
        client.add_prize(
            &symbol_short!("SMALL"),
            &spin_token,
            &500_000,   // 0.05 XLM
            &70,        // 70% chance
            &false,
        );

        client.add_prize(
            &symbol_short!("JACKPOT"),
            &spin_token,
            &10_000_000, // 1 XLM
            &30,         // 30% chance
            &true,
        );

        // Advance ledger timestamp
        env.ledger().with_mut(|li| { li.timestamp = 1000; });

        let result = client.spin(&player);
        assert!(result.spin_id == 1);
        assert!(result.amount_won > 0);

        let stats = client.get_player_stats(&player);
        assert_eq!(stats.total_spins, 1);

        let history = client.get_spin_history();
        assert_eq!(history.len(), 1);
    }

    #[test]
    #[should_panic(expected = "cooldown period not elapsed")]
    fn test_cooldown_enforced() {
        let (env, admin, player, spin_token, contract) = setup();
        let client = SpinToWinClient::new(&env, &contract);

        client.initialize(&admin, &1_000_000, &spin_token, &30, &0);
        client.add_prize(&symbol_short!("P1"), &spin_token, &500_000, &100, &false);

        env.ledger().with_mut(|li| { li.timestamp = 1000; });
        client.spin(&player);

        // Immediately spin again — should panic
        env.ledger().with_mut(|li| { li.timestamp = 1010; }); // only 10s elapsed, need 30
        client.spin(&player);
    }
}