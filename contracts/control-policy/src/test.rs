extern crate std;

use soroban_sdk::{
    Address, Env, IntoVal, String, Vec,
    auth::{Context, ContractContext},
    symbol_short,
    testutils::{Address as _, Ledger as _},
};
use stellar_accounts::{
    policies::{Policy, PolicyClient},
    smart_account::{ContextRule, ContextRuleType, Signer},
};

use crate::contract::{ControlParams, ControlPolicy, ControlPolicyClient};

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
    ControlParams {
        allowlist,
        cap_per_period: None,
        max_per_payment: max,
        period_ledgers: 0,
    }
}

fn capped_params(
    e: &Env,
    supplier: &Address,
    max: Option<i128>,
    cap: i128,
    period_ledgers: u32,
) -> ControlParams {
    ControlParams {
        cap_per_period: Some(cap),
        period_ledgers,
        ..params(e, supplier, max)
    }
}

fn rule_with_id(e: &Env, id: u32) -> ContextRule {
    ContextRule {
        id,
        ..context_rule(e)
    }
}

fn advance_ledgers(e: &Env, ledgers: u32) {
    e.ledger().with_mut(|l| l.sequence_number += ledgers);
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

    install(
        &e,
        &policy,
        params(&e, &supplier, Some(5_000_000)),
        &rule,
        &sa,
    );
    enforce(
        &e,
        &policy,
        &rule,
        &sa,
        transfer_context(&e, &supplier, 2_000_000),
    );
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
    enforce(
        &e,
        &policy,
        &rule,
        &sa,
        transfer_context(&e, &stranger, 100),
    );
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

    install(
        &e,
        &policy,
        params(&e, &supplier, Some(5_000_000)),
        &rule,
        &sa,
    );
    enforce(
        &e,
        &policy,
        &rule,
        &sa,
        transfer_context(&e, &supplier, 5_000_001),
    );
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
    enforce(
        &e,
        &policy,
        &rule,
        &sa,
        transfer_context(&e, &supplier, i128::MAX),
    );
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
#[should_panic(expected = "Error(Contract, #3)")]
fn negative_amount_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(&e, &policy, params(&e, &supplier, None), &rule, &sa);
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, -1));
}

#[test]
#[should_panic(expected = "control policy requires a CallContract rule")]
fn install_on_default_rule_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let mut rule = context_rule(&e);
    rule.context_type = ContextRuleType::Default;

    install(&e, &policy, params(&e, &supplier, None), &rule, &sa);
}

#[test]
#[should_panic(expected = "max_per_payment must be positive")]
fn install_with_non_positive_max_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(&e, &policy, params(&e, &supplier, Some(0)), &rule, &sa);
}

// The smart account calls the policy through `PolicyClient` with the install
// params as a raw `Val`; these tests exercise that exact path.

#[test]
fn policy_client_install_and_enforce_accept_allowed_payment() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let client = PolicyClient::new(&e, &policy);
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    client.install(
        &params(&e, &supplier, Some(5_000_000)).into_val(&e),
        &rule,
        &sa,
    );
    client.enforce(
        &transfer_context(&e, &supplier, 5_000_000),
        &Vec::new(&e),
        &rule,
        &sa,
    );
}

#[test]
fn policy_client_enforce_returns_table_error_codes() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let client = PolicyClient::new(&e, &policy);
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let stranger = Address::generate(&e);
    let rule = context_rule(&e);
    let no_signers = Vec::new(&e);

    client.install(
        &params(&e, &supplier, Some(5_000_000)).into_val(&e),
        &rule,
        &sa,
    );

    let unknown = client.try_enforce(
        &transfer_context(&e, &stranger, 100),
        &no_signers,
        &rule,
        &sa,
    );
    assert_eq!(unknown, Err(Ok(soroban_sdk::Error::from_contract_error(1))));

    let too_big = client.try_enforce(
        &transfer_context(&e, &supplier, 5_000_001),
        &no_signers,
        &rule,
        &sa,
    );
    assert_eq!(too_big, Err(Ok(soroban_sdk::Error::from_contract_error(2))));
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
    enforce(
        &e,
        &policy,
        &rule,
        &sa,
        transfer_context(&e, &supplier, 100),
    );
}

// Cap per period (AGENTS.md §3.1). Spent is kept per smart account, not per
// rule, so a replacement rule keeps counting from it.

const PERIOD: u32 = 1_000;

#[test]
fn payments_within_the_cap_accumulate() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let view = ControlPolicyClient::new(&e, &policy);
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(
        &e,
        &policy,
        capped_params(&e, &supplier, Some(500), 1_000, PERIOD),
        &rule,
        &sa,
    );
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, 400));
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, 400));

    assert_eq!(view.spend_state(&sa, &PERIOD).spent, 800);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn payment_over_the_remaining_cap_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(
        &e,
        &policy,
        capped_params(&e, &supplier, Some(500), 1_000, PERIOD),
        &rule,
        &sa,
    );
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, 500));
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, 400));
    // 900 spent: 101 more would pass 1,000 while staying under the maximum.
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, 101));
}

#[test]
fn per_payment_maximum_is_checked_before_the_cap() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let client = PolicyClient::new(&e, &policy);
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    client.install(
        &capped_params(&e, &supplier, Some(500), 1_000, PERIOD).into_val(&e),
        &rule,
        &sa,
    );
    // Scene 2 of the demo: over the maximum, within the cap -> error 2, so the
    // "manager approval required" message is shown and not a cap message.
    let over_max = client.try_enforce(
        &transfer_context(&e, &supplier, 800),
        &Vec::new(&e),
        &rule,
        &sa,
    );
    assert_eq!(over_max, Err(Ok(soroban_sdk::Error::from_contract_error(2))));
}

#[test]
fn a_rejected_payment_is_not_counted() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let view = ControlPolicyClient::new(&e, &policy);
    let client = PolicyClient::new(&e, &policy);
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let stranger = Address::generate(&e);
    let rule = context_rule(&e);

    install(
        &e,
        &policy,
        capped_params(&e, &supplier, Some(500), 1_000, PERIOD),
        &rule,
        &sa,
    );
    let _ = client.try_enforce(
        &transfer_context(&e, &stranger, 100),
        &Vec::new(&e),
        &rule,
        &sa,
    );
    assert_eq!(view.spend_state(&sa, &PERIOD).spent, 0);
}

#[test]
fn the_period_resets_when_it_ends() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let view = ControlPolicyClient::new(&e, &policy);
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(
        &e,
        &policy,
        capped_params(&e, &supplier, Some(500), 1_000, PERIOD),
        &rule,
        &sa,
    );
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, 500));
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, 500));
    assert_eq!(view.spend_state(&sa, &PERIOD).spent, 1_000);

    advance_ledgers(&e, PERIOD);
    assert_eq!(view.spend_state(&sa, &PERIOD).spent, 0);
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, 500));
    assert_eq!(view.spend_state(&sa, &PERIOD).spent, 500);
}

#[test]
fn spent_survives_replacing_the_rule() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let view = ControlPolicyClient::new(&e, &policy);
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let old_rule = rule_with_id(&e, 1);
    let new_rule = rule_with_id(&e, 2);

    install(
        &e,
        &policy,
        capped_params(&e, &supplier, Some(500), 1_000, PERIOD),
        &old_rule,
        &sa,
    );
    enforce(&e, &policy, &old_rule, &sa, transfer_context(&e, &supplier, 500));
    let before = view.spend_state(&sa, &PERIOD);

    // Raise the cap: add the replacement first, then retire the old rule.
    install(
        &e,
        &policy,
        capped_params(&e, &supplier, Some(500), 1_500, PERIOD),
        &new_rule,
        &sa,
    );
    uninstall(&e, &policy, &old_rule, &sa);

    // 500 spent and 1,500 allowed leaves 1,000, and the period did not restart.
    assert_eq!(view.spend_state(&sa, &PERIOD), before);
    enforce(&e, &policy, &new_rule, &sa, transfer_context(&e, &supplier, 500));
    enforce(&e, &policy, &new_rule, &sa, transfer_context(&e, &supplier, 500));
    assert_eq!(view.spend_state(&sa, &PERIOD).spent, 1_500);
}

#[test]
fn both_rules_count_against_the_same_cap_while_they_overlap() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let view = ControlPolicyClient::new(&e, &policy);
    let client = PolicyClient::new(&e, &policy);
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let old_rule = rule_with_id(&e, 1);
    let new_rule = rule_with_id(&e, 2);

    for rule in [&old_rule, &new_rule] {
        install(
            &e,
            &policy,
            capped_params(&e, &supplier, Some(500), 1_000, PERIOD),
            rule,
            &sa,
        );
    }
    enforce(&e, &policy, &old_rule, &sa, transfer_context(&e, &supplier, 500));
    enforce(&e, &policy, &new_rule, &sa, transfer_context(&e, &supplier, 500));
    // The cap is 1,000 in total, not 1,000 per rule.
    let third = client.try_enforce(
        &transfer_context(&e, &supplier, 1),
        &Vec::new(&e),
        &old_rule,
        &sa,
    );
    assert_eq!(third, Err(Ok(soroban_sdk::Error::from_contract_error(5))));
    assert_eq!(view.spend_state(&sa, &PERIOD).spent, 1_000);
}

#[test]
fn a_cap_below_what_was_spent_cannot_be_installed() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let client = PolicyClient::new(&e, &policy);
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let old_rule = rule_with_id(&e, 1);
    let new_rule = rule_with_id(&e, 2);

    install(
        &e,
        &policy,
        capped_params(&e, &supplier, Some(500), 1_000, PERIOD),
        &old_rule,
        &sa,
    );
    enforce(&e, &policy, &old_rule, &sa, transfer_context(&e, &supplier, 500));
    enforce(&e, &policy, &old_rule, &sa, transfer_context(&e, &supplier, 300));

    let lowered = client.try_install(
        &capped_params(&e, &supplier, Some(500), 700, PERIOD).into_val(&e),
        &new_rule,
        &sa,
    );
    assert_eq!(lowered, Err(Ok(soroban_sdk::Error::from_contract_error(4))));

    // Exactly what was spent is allowed: the cap is not below it.
    client.install(
        &capped_params(&e, &supplier, Some(500), 800, PERIOD).into_val(&e),
        &new_rule,
        &sa,
    );
}

#[test]
fn a_cap_below_what_was_spent_is_allowed_once_the_period_ended() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let old_rule = rule_with_id(&e, 1);
    let new_rule = rule_with_id(&e, 2);

    install(
        &e,
        &policy,
        capped_params(&e, &supplier, Some(500), 1_000, PERIOD),
        &old_rule,
        &sa,
    );
    enforce(&e, &policy, &old_rule, &sa, transfer_context(&e, &supplier, 500));
    advance_ledgers(&e, PERIOD);

    install(
        &e,
        &policy,
        capped_params(&e, &supplier, Some(300), 400, PERIOD),
        &new_rule,
        &sa,
    );
}

#[test]
fn spent_is_kept_per_account() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let view = ControlPolicyClient::new(&e, &policy);
    let sa = Address::generate(&e);
    let other = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    for account in [&sa, &other] {
        install(
            &e,
            &policy,
            capped_params(&e, &supplier, Some(500), 1_000, PERIOD),
            &rule,
            account,
        );
    }
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, 500));
    assert_eq!(view.spend_state(&other, &PERIOD).spent, 0);
}

#[test]
fn a_rule_without_a_cap_does_not_touch_the_spend_state() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let view = ControlPolicyClient::new(&e, &policy);
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(&e, &policy, params(&e, &supplier, None), &rule, &sa);
    enforce(&e, &policy, &rule, &sa, transfer_context(&e, &supplier, 10_000));
    assert_eq!(view.spend_state(&sa, &PERIOD).spent, 0);
}

#[test]
#[should_panic(expected = "cap_per_period must be positive")]
fn install_with_non_positive_cap_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(
        &e,
        &policy,
        capped_params(&e, &supplier, None, 0, PERIOD),
        &rule,
        &sa,
    );
}

#[test]
#[should_panic(expected = "period_ledgers must be positive when there is a cap")]
fn install_with_a_cap_and_no_period_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(
        &e,
        &policy,
        capped_params(&e, &supplier, None, 1_000, 0),
        &rule,
        &sa,
    );
}

#[test]
#[should_panic(expected = "max_per_payment cannot be above cap_per_period")]
fn install_with_a_maximum_above_the_cap_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = context_rule(&e);

    install(
        &e,
        &policy,
        capped_params(&e, &supplier, Some(2_000), 1_000, PERIOD),
        &rule,
        &sa,
    );
}

#[test]
fn get_params_reads_what_is_installed() {
    let e = Env::default();
    e.mock_all_auths();
    let policy = e.register(ControlPolicy, ());
    let view = ControlPolicyClient::new(&e, &policy);
    let sa = Address::generate(&e);
    let supplier = Address::generate(&e);
    let rule = rule_with_id(&e, 7);
    let installed = capped_params(&e, &supplier, Some(500), 1_000, PERIOD);

    assert_eq!(view.get_params(&sa, &7), None);
    install(&e, &policy, installed.clone(), &rule, &sa);
    assert_eq!(view.get_params(&sa, &7), Some(installed));
    uninstall(&e, &policy, &rule, &sa);
    assert_eq!(view.get_params(&sa, &7), None);
}
