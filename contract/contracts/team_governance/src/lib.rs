#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Address, Env, Symbol, Vec, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GovernanceError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    TeamAlreadyExists = 3,
    TeamNotFound = 4,
    InsufficientBalance = 5,
    InvalidAmount = 6,
    ProposalNotFound = 7,
    VoteAlreadyCast = 8,
}

#[contracttype]
#[derive(Clone)]
pub struct Proposal {
    pub proposer: Address,
    pub metadata: String,
    pub yes: i128,
    pub no: i128,
    pub executed: bool,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    TeamCreated(u64),
    Balance(u64, Address),
    Stake(u64, Address),
    Proposal(u64, u64), // team_id, proposal_id
    Voted(u64, u64, Address), // team_id, proposal_id, voter
    NextProposalId(u64), // team_id -> next id stored under this key
}

#[contract]
pub struct TeamGovernance;

#[contractimpl]
impl TeamGovernance {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!(GovernanceError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn create_team(env: Env, admin: Address, team_id: u64) -> Result<(), GovernanceError> {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(GovernanceError::Unauthorized)?;
        if admin != stored_admin {
            return Err(GovernanceError::Unauthorized);
        }
        if env.storage().instance().has(&DataKey::TeamCreated(team_id)) {
            return Err(GovernanceError::TeamAlreadyExists);
        }
        env.storage().instance().set(&DataKey::TeamCreated(team_id), &true);
        // initialize next proposal id
        env.storage().instance().set(&DataKey::NextProposalId(team_id), &0u64);
        Ok(())
    }

    pub fn mint(
        env: Env,
        admin: Address,
        team_id: u64,
        to: Address,
        amount: i128,
    ) -> Result<(), GovernanceError> {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(GovernanceError::Unauthorized)?;
        if admin != stored_admin {
            return Err(GovernanceError::Unauthorized);
        }
        if amount <= 0 {
            return Err(GovernanceError::InvalidAmount);
        }
        if !env.storage().instance().has(&DataKey::TeamCreated(team_id)) {
            return Err(GovernanceError::TeamNotFound);
        }
        let key = DataKey::Balance(team_id, to.clone());
        let bal: i128 = env.storage().instance().get(&key).unwrap_or(0);
        env.storage().instance().set(&key, &(bal + amount));
        Ok(())
    }

    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        team_id: u64,
        amount: i128,
    ) -> Result<(), GovernanceError> {
        from.require_auth();
        if amount <= 0 {
            return Err(GovernanceError::InvalidAmount);
        }
        let from_key = DataKey::Balance(team_id, from.clone());
        let from_bal: i128 = env.storage().instance().get(&from_key).unwrap_or(0);
        if from_bal < amount {
            return Err(GovernanceError::InsufficientBalance);
        }
        env.storage().instance().set(&from_key, &(from_bal - amount));
        let to_key = DataKey::Balance(team_id, to.clone());
        let to_bal: i128 = env.storage().instance().get(&to_key).unwrap_or(0);
        env.storage().instance().set(&to_key, &(to_bal + amount));
        Ok(())
    }

    pub fn balance_of(env: Env, who: Address, team_id: u64) -> i128 {
        env.storage().instance().get(&DataKey::Balance(team_id, who)).unwrap_or(0)
    }

    // Staking: move from balance -> stake
    pub fn stake(env: Env, who: Address, team_id: u64, amount: i128) -> Result<(), GovernanceError> {
        who.require_auth();
        if amount <= 0 {
            return Err(GovernanceError::InvalidAmount);
        }
        let bal_key = DataKey::Balance(team_id, who.clone());
        let bal: i128 = env.storage().instance().get(&bal_key).unwrap_or(0);
        if bal < amount {
            return Err(GovernanceError::InsufficientBalance);
        }
        env.storage().instance().set(&bal_key, &(bal - amount));
        let stake_key = DataKey::Stake(team_id, who.clone());
        let staked: i128 = env.storage().instance().get(&stake_key).unwrap_or(0);
        env.storage().instance().set(&stake_key, &(staked + amount));
        Ok(())
    }

    pub fn unstake(env: Env, who: Address, team_id: u64, amount: i128) -> Result<(), GovernanceError> {
        who.require_auth();
        if amount <= 0 {
            return Err(GovernanceError::InvalidAmount);
        }
        let stake_key = DataKey::Stake(team_id, who.clone());
        let staked: i128 = env.storage().instance().get(&stake_key).unwrap_or(0);
        if staked < amount {
            return Err(GovernanceError::InsufficientBalance);
        }
        env.storage().instance().set(&stake_key, &(staked - amount));
        let bal_key = DataKey::Balance(team_id, who.clone());
        let bal: i128 = env.storage().instance().get(&bal_key).unwrap_or(0);
        env.storage().instance().set(&bal_key, &(bal + amount));
        Ok(())
    }

    pub fn staked_of(env: Env, who: Address, team_id: u64) -> i128 {
        env.storage().instance().get(&DataKey::Stake(team_id, who)).unwrap_or(0)
    }

    // Simple reward distribution: admin mints rewards to a user for a team
    pub fn distribute_reward(env: Env, admin: Address, team_id: u64, to: Address, amount: i128) -> Result<(), GovernanceError> {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(GovernanceError::Unauthorized)?;
        if admin != stored_admin {
            return Err(GovernanceError::Unauthorized);
        }
        if amount <= 0 {
            return Err(GovernanceError::InvalidAmount);
        }
        // Reward distribution is implemented as a mint to the receiver's balance
        let key = DataKey::Balance(team_id, to.clone());
        let bal: i128 = env.storage().instance().get(&key).unwrap_or(0);
        env.storage().instance().set(&key, &(bal + amount));
        Ok(())
    }

    // Governance proposals
    pub fn propose(env: Env, proposer: Address, team_id: u64, metadata: String) -> Result<u64, GovernanceError> {
        proposer.require_auth();
        // ensure team exists
        if !env.storage().instance().has(&DataKey::TeamCreated(team_id)) {
            return Err(GovernanceError::TeamNotFound);
        }
        // get next proposal id
        let next_key = DataKey::NextProposalId(team_id);
        let next: u64 = env.storage().instance().get(&next_key).unwrap_or(0u64);
        let proposal = Proposal { proposer: proposer.clone(), metadata: metadata.clone(), yes: 0, no: 0, executed: false };
        env.storage().instance().set(&DataKey::Proposal(team_id, next), &proposal);
        env.storage().instance().set(&next_key, &(next + 1));
        Ok(next)
    }

    pub fn vote(env: Env, voter: Address, team_id: u64, proposal_id: u64, support: bool) -> Result<(), GovernanceError> {
        voter.require_auth();
        // load proposal
        let key = DataKey::Proposal(team_id, proposal_id);
        let mut proposal: Proposal = env.storage().instance().get(&key).ok_or(GovernanceError::ProposalNotFound)?;
        // ensure not already voted
        let voted_key = DataKey::Voted(team_id, proposal_id, voter.clone());
        if env.storage().instance().has(&voted_key) {
            return Err(GovernanceError::VoteAlreadyCast);
        }
        // weight = staked amount for team
        let weight: i128 = env.storage().instance().get(&DataKey::Stake(team_id, voter.clone())).unwrap_or(0);
        if support {
            proposal.yes = proposal.yes + weight;
        } else {
            proposal.no = proposal.no + weight;
        }
        env.storage().instance().set(&key, &proposal);
        env.storage().instance().set(&voted_key, &true);
        Ok(())
    }

    pub fn proposal_of(env: Env, team_id: u64, proposal_id: u64) -> Option<Proposal> {
        env.storage().instance().get(&DataKey::Proposal(team_id, proposal_id))
    }

    pub fn execute_proposal(env: Env, admin: Address, team_id: u64, proposal_id: u64) -> Result<(), GovernanceError> {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(GovernanceError::Unauthorized)?;
        if admin != stored_admin {
            return Err(GovernanceError::Unauthorized);
        }
        let key = DataKey::Proposal(team_id, proposal_id);
        let mut proposal: Proposal = env.storage().instance().get(&key).ok_or(GovernanceError::ProposalNotFound)?;
        if proposal.executed {
            return Ok(());
        }
        // naive execution: mark executed. Real execution would be application-specific.
        proposal.executed = true;
        env.storage().instance().set(&key, &proposal);
        Ok(())
    }
}
