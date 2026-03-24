use crate::{ContractError, ReplayRejectedEvent};
use soroban_sdk::{contracttype, BytesN, Env, Symbol};

const REPLAY_REJECTED_TOPIC: &str = "replay_rejected";

#[contracttype]
#[derive(Clone)]
enum DataKey {
    ExecutedOp(Symbol, BytesN<32>),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExecutionRecord {
    pub executed_at: u64,
    pub ttl_seconds: Option<u64>,
}

pub fn ensure_not_replayed(
    env: &Env,
    scope: Symbol,
    operation_hash: BytesN<32>,
    ttl_seconds: Option<u64>,
) -> Result<(), ContractError> {
    let key = DataKey::ExecutedOp(scope.clone(), operation_hash.clone());
    let storage = env.storage().persistent();

    if let Some(record) = storage.get::<_, ExecutionRecord>(&key) {
        if is_expired(env, &record) {
            storage.remove(&key);
        } else {
            emit_replay_rejected(env, scope, operation_hash);
            return Err(ContractError::DuplicateOperation);
        }
    }

    let record = ExecutionRecord {
        executed_at: env.ledger().timestamp(),
        ttl_seconds,
    };
    storage.set(&key, &record);
    Ok(())
}

pub fn cleanup_operation(env: &Env, scope: Symbol, operation_hash: BytesN<32>) -> bool {
    let key = DataKey::ExecutedOp(scope, operation_hash);
    let storage = env.storage().persistent();

    if let Some(record) = storage.get::<_, ExecutionRecord>(&key) {
        if is_expired(env, &record) {
            storage.remove(&key);
            return true;
        }
    }

    false
}

pub fn is_operation_executed(env: &Env, scope: Symbol, operation_hash: BytesN<32>) -> bool {
    let key = DataKey::ExecutedOp(scope, operation_hash);
    if let Some(record) = env.storage().persistent().get::<_, ExecutionRecord>(&key) {
        !is_expired(env, &record)
    } else {
        false
    }
}

fn is_expired(env: &Env, record: &ExecutionRecord) -> bool {
    match record.ttl_seconds {
        Some(ttl) => env.ledger().timestamp().saturating_sub(record.executed_at) >= ttl,
        None => false,
    }
}

#[allow(deprecated)] // keep (topic, payload) format for indexer compatibility
fn emit_replay_rejected(env: &Env, scope: Symbol, operation_hash: BytesN<32>) {
    let event = ReplayRejectedEvent {
        operation_hash,
        scope,
        timestamp: env.ledger().timestamp(),
    };

    env.events()
        .publish((Symbol::new(env, REPLAY_REJECTED_TOPIC),), event);
}
