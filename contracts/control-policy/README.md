# `control-policy`

The payment rules of an Arqueo treasury, enforced by the smart account itself
(`AGENTS.md` §3, §3.1 and §6.2). It is an OpenZeppelin `Policy` installed on a
`CallContract` rule of the token (native XLM on testnet).

## What it enforces

A call must be `transfer(from, to, amount)` and:

1. `to` is on the **allowlist** (error 1),
2. `amount` is not above `max_per_payment`, if set (error 2),
3. the total spent in the period plus `amount` is not above `cap_per_period`,
   if set (error 5).

Anything that is not a `transfer` fails with error 3. The maximum per payment is
checked before the cap, so demo scene 2 shows "manager approval required".

## Install parameters

`ControlParams { allowlist, cap_per_period, max_per_payment, period_ledgers }`.
Amounts in stroops, `None` = no maximum or no cap. At most 50 suppliers and a
period of at most 30 days (518,400 ledgers). As an `ScVal` it is a map with the
keys in alphabetical order; the app builds it in `controlPolicyParams`
(`app/src/lib/payments.ts`).

| Rule | `allowlist` | `max_per_payment` | `cap_per_period` |
| --- | --- | --- | --- |
| `ordinary` | suppliers | 500 XLM by default | 1,000 XLM by default |
| `large` | suppliers | none | none |

## What was spent

Kept **per smart account**, not per rule, with the ledger the period started in.
Uninstalling a rule removes only its parameters. That lets a settings change add
the new rule before retiring the old one without restarting the cap. A new cap
below what was spent in the current period is refused at install (error 4).

## Views and events

- `get_params(smart_account, context_rule_id) -> Option<ControlParams>`
- `spend_state(smart_account, period_ledgers) -> SpendState { spent, period_start }`
- Events: `PolicyInstalled` (with the parameters), `PolicyUninstalled` and
  `PaymentApproved` (`to`, `amount`, `spent`). A rejected payment reverts, so it
  emits nothing: its failed transaction is the record.

## Errors

| Code | Name | Where |
| --- | --- | --- |
| 1 | `SupplierNotAllowed` | enforce |
| 2 | `AmountOverLimit` | enforce |
| 3 | `NotATransfer` | enforce |
| 4 | `CapBelowSpent` | install |
| 5 | `CapExceeded` | enforce |

## Build, test and deploy (testnet only)

```bash
cargo test -p control-policy
cargo clippy -p control-policy --all-targets
stellar contract build --package control-policy
```

```bash
stellar keys generate arqueo-deployer --network testnet --fund
stellar contract deploy --wasm target/wasm32v1-none/release/control_policy.wasm --source arqueo-deployer --network testnet
```

Put the contract id in `PUBLIC_CONTROL_POLICY_ADDRESS` (`app/.env.example`).
A new deployment is a new contract: rules created with the old one are moved
from Settings ("Migrate").

Stored data lives 30 days after its last use. A treasury that is idle for longer
has to restore it (`stellar contract restore`) before paying again; until then
the policy fails closed.

## Testnet deployment

| | |
| --- | --- |
| Contract | `CBPCC6AT3756K43DGTRKLIZFOY5TODHZXGBJS4X4KZ64TFWUQDPEWU4L` |
| Wasm hash | `46e95a0e5e0ef2f1756f694d7c8e888c010eb1f72b9c202d0d9c7e57ce8e9910` |
| Deploy tx | `f72f8142978d59f9f3907ace6686f87f7f6adfa844cc04389bb495dab282c216` |

The contract has no upgrade function: a new version is a new deployment.
