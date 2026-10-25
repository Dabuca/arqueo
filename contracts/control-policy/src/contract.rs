//! Control policy for Arqueo smart accounts.
//!
//! Only allows `transfer(from, to, amount)` calls whose `to` is on an
//! allowlist of suppliers, whose `amount` does not exceed an optional
//! per-payment maximum, and whose running total does not pass an optional cap
//! per period. Parameters are stored per (smart account, context rule). What
//! was spent is stored per smart account only, so it survives retiring a rule
//! and installing its replacement (AGENTS.md §3.1).

use soroban_sdk::{
    Address, Env, TryFromVal, Vec,
    auth::{Context, ContractContext},
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short,
};
use stellar_accounts::{
    policies::Policy,
    smart_account::{ContextRule, ContextRuleType, Signer},
};

/// Installation parameters. Amounts are in stroops; `None` means no maximum
/// or no cap. `period_ledgers` is the length of the cap period and is ignored
/// when there is no cap.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ControlParams {
    pub allowlist: Vec<Address>,
    pub cap_per_period: Option<i128>,
    pub max_per_payment: Option<i128>,
    pub period_ledgers: u32,
}

/// What a smart account has spent in the current cap period.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct SpendState {
    /// Stroops spent since `period_start`.
    pub spent: i128,
    /// Ledger sequence at which the current period started.
    pub period_start: u32,
}

/// Enforcement errors. Codes are part of the B <-> A interface (AGENTS.md §6.2).
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum ControlError {
    SupplierNotAllowed = 1,
    AmountOverLimit = 2,
    NotATransfer = 3,
    /// Install: the new cap is below what was already spent in the period.
    CapBelowSpent = 4,
    /// Enforce: this payment would take the period total over the cap.
    CapExceeded = 5,
}

/// Storage keys.
#[contracttype]
pub enum ControlStorageKey {
    /// Parameters of one context rule of one smart account.
    AccountContext(Address, u32),
    /// Spend state of one smart account, shared by all of its rules.
    Spent(Address),
}

const DAY_IN_LEDGERS: u32 = 17280;
const TTL_EXTEND_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const TTL_THRESHOLD: u32 = TTL_EXTEND_AMOUNT - DAY_IN_LEDGERS;

fn load_params(e: &Env, context_rule_id: u32, smart_account: &Address) -> Option<ControlParams> {
    let key = ControlStorageKey::AccountContext(smart_account.clone(), context_rule_id);
    e.storage().persistent().get(&key).inspect(|_| {
        e.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_AMOUNT)
    })
}

fn load(e: &Env, context_rule_id: u32, smart_account: &Address) -> ControlParams {
    load_params(e, context_rule_id, smart_account)
        .unwrap_or_else(|| panic!("control policy not installed"))
}

/// The spend state of the current period: the stored one, or a fresh one when
/// nothing was spent yet or the stored period has ended.
fn current_spend(e: &Env, smart_account: &Address, period_ledgers: u32) -> SpendState {
    let key = ControlStorageKey::Spent(smart_account.clone());
    let now = e.ledger().sequence();
    let stored: Option<SpendState> = e.storage().persistent().get(&key);
    match stored {
        Some(state) if now < state.period_start.saturating_add(period_ledgers) => {
            e.storage()
                .persistent()
                .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_AMOUNT);
            state
        }
        _ => SpendState {
            spent: 0,
            period_start: now,
        },
    }
}

fn save_spend(e: &Env, smart_account: &Address, state: &SpendState) {
    let key = ControlStorageKey::Spent(smart_account.clone());
    e.storage().persistent().set(&key, state);
    e.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_AMOUNT);
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
        if amount < 0 {
            panic_with_error!(e, ControlError::NotATransfer)
        }

        if !params.allowlist.iter().any(|supplier| supplier == to) {
            panic_with_error!(e, ControlError::SupplierNotAllowed)
        }
        if params.max_per_payment.is_some_and(|max| amount > max) {
            panic_with_error!(e, ControlError::AmountOverLimit)
        }

        if let Some(cap) = params.cap_per_period {
            let mut state = current_spend(e, &smart_account, params.period_ledgers);
            let Some(total) = state.spent.checked_add(amount) else {
                panic_with_error!(e, ControlError::CapExceeded)
            };
            if total > cap {
                panic_with_error!(e, ControlError::CapExceeded)
            }
            state.spent = total;
            save_spend(e, &smart_account, &state);
        }
    }

    fn install(
        e: &Env,
        install_params: Self::AccountParams,
        context_rule: ContextRule,
        smart_account: Address,
    ) {
        smart_account.require_auth();

        // Pin the policy to one token contract, so amounts always share a unit.
        if !matches!(context_rule.context_type, ContextRuleType::CallContract(_)) {
            panic!("control policy requires a CallContract rule");
        }
        if install_params.max_per_payment.is_some_and(|max| max <= 0) {
            panic!("max_per_payment must be positive");
        }
        if let Some(cap) = install_params.cap_per_period {
            if cap <= 0 {
                panic!("cap_per_period must be positive");
            }
            if install_params.period_ledgers == 0 {
                panic!("period_ledgers must be positive when there is a cap");
            }
            if install_params.max_per_payment.is_some_and(|max| max > cap) {
                panic!("max_per_payment cannot be above cap_per_period");
            }
            // A new cap can never be set below what is already spent in the
            // current period, so changing limits cannot get around the cap.
            let state = current_spend(e, &smart_account, install_params.period_ledgers);
            if cap < state.spent {
                panic_with_error!(e, ControlError::CapBelowSpent)
            }
        }

        let key = ControlStorageKey::AccountContext(smart_account, context_rule.id);
        if e.storage().persistent().has(&key) {
            panic!("control policy already installed");
        }
        e.storage().persistent().set(&key, &install_params);
        e.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_AMOUNT);
    }

    fn uninstall(e: &Env, context_rule: ContextRule, smart_account: Address) {
        smart_account.require_auth();

        let key = ControlStorageKey::AccountContext(smart_account, context_rule.id);
        if !e.storage().persistent().has(&key) {
            panic!("control policy not installed");
        }
        // Only the rule's parameters go. The spend state belongs to the
        // account and stays, so the replacement rule keeps counting from it.
        e.storage().persistent().remove(&key);
    }
}

/// Read-only views, so the app shows what the chain enforces.
#[contractimpl]
impl ControlPolicy {
    /// The parameters installed on one rule of a smart account, if any.
    pub fn get_params(
        e: &Env,
        smart_account: Address,
        context_rule_id: u32,
    ) -> Option<ControlParams> {
        load_params(e, context_rule_id, &smart_account)
    }

    /// What the smart account has spent in the current period of
    /// `period_ledgers` ledgers. A finished period reads as zero spent.
    pub fn spend_state(e: &Env, smart_account: Address, period_ledgers: u32) -> SpendState {
        current_spend(e, &smart_account, period_ledgers)
    }
}
