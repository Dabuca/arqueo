extern crate std;

use soroban_sdk::{
    auth::{Context, ContractContext},
    symbol_short,
    testutils::Address as _,
    Address, Env, IntoVal, String, Vec,
};
use stellar_accounts::{
    policies::Policy,
    smart_account::{ContextRule, ContextRuleType, Signer},
};

use crate::contract::{ControlParams, ControlPolicy};

// Each policy call runs in its own contract frame: `require_auth` on the same
// smart account cannot be authorized twice within one frame.

fn context_rule(e: &Env) -> ContextRule {
    ContextRule {
        id: 1,
        context_type: ContextRuleType::CallContract(Address::generate(e)),
        name: String::from_str(e, "ordinary"),
        signers: Vec::new(e),
        signer_ids: Vec::new(e),
        policies: Vec::new(e),
        policy_ids: Vec::new(e),
        valid_until: None,
    }
}

fn transfer_context(e: &Env, to: &Address, amount: i128) -> Context {
    let mut args = Vec::new(e);
    args.push_back(Address::generate(e).into_val(e));
    args.push_back(to.into_val(e));
    args.push_back(amount.into_val(e));
    Context::Contract(ContractContext {
        contract: Address::generate(e),
        fn_name: symbol_short!("transfer"),
        args,
    })
}

fn params(e: &Env, supplier: &Address, max: Option<i128>) -> ControlParams {
    let mut allowlist = Vec::new(e);
    allowlist.push_back(supplier.clone());
    ControlParams { allowlist, max_per_payment: max }
}

fn install(e: &Env, policy: &Address, params: ControlParams, rule: &ContextRule, sa: &Address) {
    e.as_contract(policy, || {
        ControlPolicy::install(e, params, rule.clone(), sa.clone());
    });
}

fn uninstall(e: &Env, policy: &Address, rule: &ContextRule, sa: &Address) {
    e.as_contract(policy, || {
        ControlPolicy::uninstall(e, rule.clone(), sa.clone());
    });
}

fn enforce(e: &Env, policy: &Address, rule: &ContextRule, sa: &Address, context: Context) {
    e.as_contract(policy, || {
        ControlPolicy::enforce(e, context, Vec::<Signer>::new(e), rule.clone(), sa.clone());
    });
}

#[test]
fn allowed_supplier_within_limit_passes() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(&e, &policy, params(&e, &supplier, Some(5_000_000)), &rule, &sa);
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, 2_000_000));
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn unknown_supplier_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let stranger = Address::generate(&e);
    let rule = context_rule(&e);

    install(&e, &policy, params(&e, &supplier, None), &rule, &sa);
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &stranger, 100));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn amount_over_max_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(&e, &policy, params(&e, &supplier, Some(5_000_000)), &rule, &sa);
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, 5_000_001));
}

#[test]
fn no_max_allows_any_amount_to_allowed_supplier() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(&e, &policy, params(&e, &supplier, None), &rule, &sa);
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, i128::MAX));
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn non_transfer_call_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(&e, &policy, params(&e, &supplier, None), &rule, &sa);

    let mut args = Vec::new(&e);
    args.push_back(supplier.clone().into_val(&e));
    args.push_back(100_i128.into_val(&e));
    let context = Context::Contract(ContractContext {
        contract: Address::generate(&e),
        fn_name: symbol_short!("approve"),
        args,
    });
    enforce(&e, &policy, &rule, &sa, context);
}

#[test]
#[should_panic(expected = "control policy already installed")]
fn installing_twice_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(&e, &policy, params(&e, &supplier, None), &rule, &sa);
    install(&e, &policy, params(&e, &supplier, None), &rule, &sa);
}

#[test]
#[should_panic(expected = "control policy not installed")]
fn enforce_after_uninstall_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(&e, &policy, params(&e, &supplier, None), &rule, &sa);
    uninstall(&e, &policy, &rule, &sa);
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, 100));
}
