# `src/controls` — the controls matrix as code (R1)

Owner: D. Contract for other people: `AGENTS.md` §6.4. Product rules:
`AGENTS.md` §3 and §3.1.

This folder holds the rules of the treasury as plain TypeScript: limits,
suppliers, which rule a payment needs, and the trail of settings changes. It is
pure and tested. **It never talks to the network**: anything that needs Stellar
is passed in (`SupplierDeps`) and implemented by B in `app/src/lib/stellar.ts`,
the only door to the network.

The account on chain is still the authority. This code gives the app the same
rules so it can explain them, prepare the parameters, and keep the audit trail.

## Modules

| File            | Use it for                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`      | `Limits`, `Supplier`, `ControlsConfig`, `ControlChange`, `CheckResult`. `Role` and `RuleName` are re-exported from `stellar.ts` (one definition for the app). |
| `defaults.ts`   | `DEFAULT_LIMITS` (500 XLM per payment, 1,000 XLM every 30 days), `DEFAULT_CONFIG` (no suppliers), `DEMO_AMOUNTS` (200 / 800 / 100).                           |
| `units.ts`      | `xlmToStroops` (exact, `bigint`; use it for anything that goes on chain), `stroopsToXlm`, `roundToStroops` (only to compare amounts held as floats).          |
| `rules.ts`      | `signersFor(rule)`, `ruleForSigners(signers)`, `requiredRule(amount, limits, spentInPeriod)`.                                                                 |
| `validation.ts` | `looksLikeStellarAddress` (format only), `isSupplier`, `validateLimitsChange(next, spentInPeriod)`.                                                           |
| `params.ts`     | `toControlParams(config, rule)` → `{ allowlist, maxPerPayment }`, matching `ControlParams` in `contracts/control-policy`.                                     |
| `suppliers.ts`  | `addRealSupplier`, `addDemoSupplier`, `removeSupplier`, `createOutsiderAccount`, with injected `SupplierDeps`.                                                |
| `changeLog.ts`  | `createChangeLog(storage?)` → `record` / `list` / `clear`; `changesToCsv`.                                                                                    |

## Rules every caller must keep

- **Amounts are not fixed.** Read limits from the current `ControlsConfig`;
  never hard-code 500, 1,000, 200, 800 or 100 elsewhere.
- **`requiredRule` is a hint, not a gate.** Show "Needs manager approval" when
  it returns `large`, but still let the employee try alone: scene 2 must show
  the account itself rejecting the payment.
- **The 30-day cap can never go below what was spent**, and the per-payment
  maximum can never be above the cap. `validateLimitsChange` checks both; call
  it before sending any change.
- **Every Settings change is recorded** with `changeLog.record(...)` after the
  remove and add transactions have their hashes. Cap changes also carry
  `spentAtChange` and `periodStart`.
- **Config objects are immutable.** Supplier functions return a new config; they
  never change the one you pass.
- **Suppliers must exist on testnet.** `addRealSupplier` checks it through
  `deps.accountExists`. The scene 3 account comes from `createOutsiderAccount`:
  it exists but is not in the list.

## How B uses it

- Building rules (R4, R6, R7, R17):
  `toControlParams(config, 'ordinary' | 'large')`, then convert `allowlist` and
  `maxPerPayment` (stroops) to `xdr.ScVal`.
- Payments: `xlmToStroops` for the transfer amount.
- R17 / R14: implement `SupplierDeps` in `stellar.ts` (`isValidAddress` with the
  SDK's StrKey, `accountExists` against testnet, `createFundedAccount` with
  Friendbot). This extends the §6.1 interface: agree it in the PR.

## How C uses it

- Payment screen (R8): show the limits from the config and the `requiredRule`
  hint; the recipient can be any address (scene 3).
- Auditor (R9, R13): a "Rule changes" section from `createChangeLog().list()`;
  `changesToCsv` for the export.
- Settings (R17): `validateLimitsChange` before saving; the supplier functions
  for the list.

## Tests

```bash
npm test --workspace app
```

Each module has a `*.test.ts` next to it. No test touches the network or the
real `localStorage`.

## Still open

- Keeping the amount spent when the 30-day cap changes **on chain** needs the
  cap inside `control-policy` (A and B to agree; see `AGENTS.md` §3.1). Until
  then the cap is OpenZeppelin's `spending_limit`, and this folder only keeps
  the record.
