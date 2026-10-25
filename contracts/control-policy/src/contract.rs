//! Control policy for Arqueo smart accounts.
//!
//! Only allows `transfer(from, to, amount)` calls whose `to` is on an
//! allowlist of suppliers and whose `amount` does not exceed an optional
//! per-payment maximum. Parameters are stored per (smart account, context rule).

use soroban_sdk::{
    auth::{Context, ContractContext},
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short,
    Address, Env, TryFromVal, Vec,
};
use stellar_accounts::{
    policies::Policy,
    smart_account::{ContextRule, Signer},
};

/// Installation parameters. Amounts are in stroops; `None` means no maximum.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ControlParams {
    pub allowlist: Vec<Address>,
    pub max_per_payment: Option<i128>,
}

/// Enforcement errors. Codes are part of the B <-> A interface (AGENTS.md §6.2).
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum ControlError {
    SupplierNotAllowed = 1,
    AmountOverLimit = 2,
    NotATransfer = 3,
}

/// Storage key for the parameters of one context rule of one smart account.
#[contracttype]
pub enum ControlStorageKey {
    AccountContext(Address, u32),
}

const DAY_IN_LEDGERS: u32 = 17280;
const TTL_EXTEND_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const TTL_THRESHOLD: u32 = TTL_EXTEND_AMOUNT - DAY_IN_LEDGERS;

fn load(e: &Env, context_rule_id: u32, smart_account: &Address) -> ControlParams {
    let key = ControlStorageKey::AccountContext(smart_account.clone(), context_rule_id);
    e.storage()
        .persistent()
        .get(&key)
        .inspect(|_| e.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_AMOUNT))
        .unwrap_or_else(|| panic!("control policy not installed"))
}

#[contract]
pub struct ControlPolicy;

#[contractimpl]
impl Policy for ControlPolicy {
    type AccountParams = ControlParams;

    fn enforce(
        e: &Env,
        context: Context,
        _authenticated_signers: Vec<Signer>,
        context_rule: ContextRule,
        smart_account: Address,
    ) {
        smart_account.require_auth();
        let params = load(e, context_rule.id, &smart_account);

        let Context::Contract(ContractContext { fn_name, args, .. }) = context else {
            panic_with_error!(e, ControlError::NotATransfer)
        };
        if fn_name != symbol_short!("transfer") {
            panic_with_error!(e, ControlError::NotATransfer)
        }

        let to = args.get(1).and_then(|v| Address::try_from_val(e, &v).ok());
        let amount = args.get(2).and_then(|v| i128::try_from_val(e, &v).ok());
        let (Some(to), Some(amount)) = (to, amount) else {
            panic_with_error!(e, ControlError::NotATransfer)
        };

        if !params.allowlist.iter().any(|supplier| supplier == to) {
            panic_with_error!(e, ControlError::SupplierNotAllowed)
        }
        if let Some(max) = params.max_per_payment {
            if amount > max {
                panic_with_error!(e, ControlError::AmountOverLimit)
            }
        }
    }

    fn install(
        e: &Env,
        install_params: Self::AccountParams,
        context_rule: ContextRule,
        smart_account: Address,
    ) {
        smart_account.require_auth();

        let key = ControlStorageKey::AccountContext(smart_account, context_rule.id);
        if e.storage().persistent().has(&key) {
            panic!("control policy already installed");
        }
        e.storage().persistent().set(&key, &install_params);
        e.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_AMOUNT);
    }

    fn uninstall(e: &Env, context_rule: ContextRule, smart_account: Address) {
        smart_account.require_auth();

        let key = ControlStorageKey::AccountContext(smart_account, context_rule.id);
        if !e.storage().persistent().has(&key) {
            panic!("control policy not installed");
        }
        e.storage().persistent().remove(&key);
    }
}
