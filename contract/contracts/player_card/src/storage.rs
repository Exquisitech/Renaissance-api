use soroban_sdk::{Address, Env, String, Vec};

const ADMIN: &str = "ADMIN";
const NEXT_TOKEN_ID: &str = "NEXT_TOKEN_ID";
const TOKEN_OWNER: &str = "TOKEN_OWNER";
const TOKEN_URI: &str = "TOKEN_URI";
const OWNER_TOKENS: &str = "OWNER_TOKENS";

pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&String::from_str(env, ADMIN))
}

pub fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&String::from_str(env, ADMIN))
        .unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage()
        .instance()
        .set(&String::from_str(env, ADMIN), admin);
}

pub fn get_next_token_id(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&String::from_str(env, NEXT_TOKEN_ID))
        .unwrap_or(1u64)
}

pub fn set_next_token_id(env: &Env, token_id: u64) {
    env.storage()
        .instance()
        .set(&String::from_str(env, NEXT_TOKEN_ID), &token_id);
}

pub fn increment_next_token_id(env: &Env) {
    let current_id = get_next_token_id(env);
    set_next_token_id(env, current_id + 1);
}

pub fn get_owner(env: &Env, token_id: u64) -> Address {
    let key = (String::from_str(env, TOKEN_OWNER), token_id);
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| panic!("token not found"))
}

pub fn set_owner(env: &Env, token_id: u64, owner: &Address) {
    let key = (String::from_str(env, TOKEN_OWNER), token_id);

    if let Some(old_owner) = env.storage().instance().get::<_, Address>(&key) {
        remove_token_from_owner(env, &old_owner, token_id);
    }

    env.storage().instance().set(&key, owner);
    add_token_to_owner(env, owner, token_id);
}

pub fn get_token_uri(env: &Env, token_id: u64) -> String {
    let key = (String::from_str(env, TOKEN_URI), token_id);
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| panic!("token not found"))
}

pub fn set_token_uri(env: &Env, token_id: u64, token_uri: &String) {
    let key = (String::from_str(env, TOKEN_URI), token_id);
    env.storage().instance().set(&key, token_uri);
}

pub fn get_tokens_of_owner(env: &Env, owner: Address) -> Vec<u64> {
    let key = (String::from_str(env, OWNER_TOKENS), owner);
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env))
}

pub fn add_token_to_owner(env: &Env, owner: &Address, token_id: u64) {
    let key = (String::from_str(env, OWNER_TOKENS), owner);
    let mut tokens = get_tokens_of_owner(env, owner.clone());
    tokens.push_back(token_id);
    env.storage().instance().set(&key, &tokens);
}

pub fn remove_token_from_owner(env: &Env, owner: &Address, token_id: u64) {
    let key = (String::from_str(env, OWNER_TOKENS), owner);
    let mut tokens = get_tokens_of_owner(env, owner.clone());

    let index = tokens.iter().position(|id| id == token_id);
    if let Some(index) = index {
        tokens.remove(index as u32);
        env.storage().instance().set(&key, &tokens);
    }
}
