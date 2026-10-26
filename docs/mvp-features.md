# Arqueo — MVP Features

Arqueo is an internal-controls layer for stablecoin treasuries on Stellar. The company's treasury is an OpenZeppelin smart account. Payment rules are enforced by the account itself: a payment that breaks a rule cannot be executed.

This document details what the MVP must do, in product terms. The requirement IDs (R#) and the build order come from `AGENTS.md` §7 and [mvp-roadmap.md](mvp-roadmap.md). The control structure comes from `AGENTS.md` §3; limits and suppliers are set by the admin (`AGENTS.md` §3.1).

> **Testnet only.** Arqueo runs on Stellar testnet with test funds. Passkeys are used for the admin and manager in production; the employee key lives in the browser for the demo only.

---

## 1. The problem and the MVP goal

A small company, startup or association holds stablecoins behind a single key. One person can move all the money, approvals happen in chat, and the auditor receives screenshots.

The MVP is finished when the four scenes below run end to end on testnet:

| # | Scene | Expected result |
|---|---|---|
| 1 | Pay **below the per-payment maximum** to an authorized supplier, signed by the employee | Accepted. Transaction hash shown with a link to stellar.expert |
| 2 | Pay **above the per-payment maximum**, signed by the employee alone | Rejected: "Amount exceeds the per-payment limit: manager approval required" |
| 2b | Same payment, signed by employee **and** manager | Accepted |
| 3 | Pay to an account **that is not in the supplier list** | Rejected: "Supplier not authorized" |
| 4 | Auditor opens the payments view and downloads a CSV | Sees every payment, including rejected attempts |

Scene 2 has two parts: the single-signature attempt above the per-payment maximum is rejected, and the same payment with the manager's signature is accepted. Scene 2b is the second half of scene 2.

Amounts are not fixed: the flow depends on the limits the admin sets (§2, F11). With the default limits (500 XLM per payment, 1,000 XLM every 30 days), the video can use, for example, 200, 800 and 100 XLM. The scene 2 amount must be above the per-payment maximum **but not above the 30-day cap**; otherwise the rejection could come from the cap and the manager-approval message would not show.

**Pitch precision:** a rejection happens when the transaction is simulated against the account's rules. If the transaction were sent anyway, the network would reject it too.

---

## 2. Actors and signing roles

Roles and rule structure are fixed for the MVP. Limits and suppliers are set by the admin.

| Role | Signs with | What it does |
|---|---|---|
| `admin` | passkey | Creates the account, rules and signers; sets and changes limits and suppliers at any time (F11) |
| `employee` | Ed25519 testnet key stored in the browser (demo shortcut) | Ordinary payments |
| `manager` | passkey | Second signature on large payments |
| `auditor` | nothing (read-only) | Views payments and exports CSV |

### Rules

| Rule | Context | Signers | Policies |
|---|---|---|---|
| `admin` | default | admin | none (without policies, every signer is required) |
| `ordinary` | calls to the token contract | employee | threshold 1 · `control-policy` {suppliers, per-payment maximum (default 500)} · 30-day spending cap (default 1,000; see F11) |
| `large` | calls to the token contract | employee + manager | threshold 2 · `control-policy` {suppliers, no maximum} |

The app picks the rule from who signs:

- `['employee']` → `ordinary`
- `['employee', 'manager']` → `large`

Every rule that carries policies must have a threshold policy. A rule allows at most 15 signers and 5 policies.

Limits and suppliers are not fixed. The admin sets them and can change them at any time (F11):

- Per-payment maximum on `ordinary`: 500 XLM by default.
- 30-day spending cap on `ordinary`: 1,000 XLM by default.
- Suppliers: each one is either a generated demo testnet account or a real address entered by the admin. It must exist on testnet (funded via Friendbot); otherwise the payment would fail for a reason other than the rule. The unknown account in scene 3 must also exist, but outside the list.

---

## 3. Feature list

Priority: **P0** blocks the demo, **P1** completes the MVP, **P2** only if time remains. Requirement IDs follow `AGENTS.md` §7.

### F1 — Company treasury account (P0, R3)

- The admin creates a smart account on testnet with a passkey.
- Signers are added: employee (Ed25519) and manager (passkey).
- The account is funded from Friendbot.
- **Done when:** the account address (`C…`) is visible on stellar.expert.

### F2 — Testnet wiring (P0, R2)

- The app connects to testnet using the addresses in `smart-account-kit` 0.6.0's `demo/.env.example`, including the Ed25519 verifier.
- The token is native XLM through its Stellar Asset Contract.
- Amounts are entered in XLM and converted to stroops (1 XLM = 10,000,000 stroops).
- **Done when:** the app reads a testnet balance.

### F3 — Ordinary rule and first payment (P0, R4)

- The `ordinary` rule is created with threshold 1 and `control-policy`, which holds the suppliers, the per-payment maximum and the 30-day cap (default: 1,000 XLM every 30 days). It no longer uses OpenZeppelin's `spending_limit` (see F11).
- The first payment is signed by the employee alone through the kit's `multiSigners` path.
- **Done when:** a transaction hash appears on testnet. This is the 14:00 control.

### F4 — Supplier allowlist and per-payment cap (P0, R5, R6)

Implemented in our own `control-policy` contract.

- Installation parameters per account and per rule: `ControlParams { allowlist, max_per_payment }`. Amounts are in stroops. `None` means no maximum.
- Errors: `1` supplier not allowed · `2` amount over limit · `3` operation not a transfer.
- On a `transfer(from, to, amount)` call, the policy checks that `to` is in the allowlist and that `amount` is not above the maximum.
- Any other function is rejected.
- The policy is installed on `ordinary` (per-payment maximum set by the admin, 500 XLM by default) and on `large` (no maximum).
- **Done when:** scene 3 is rejected by the account.

### F5 — Large rule with two signatures (P0, R7)

- The `large` rule has threshold 2 and the `control-policy` with no maximum.
- A payment signed by employee and manager is accepted.
- **Done when:** scene 2b passes, and scene 2 is rejected without the manager.

### F6 — Payment screen (P0, R8)

- Fields: supplier (chosen from the allowlist), amount in XLM, concept.
- Role selector: which signers are present (`employee` or `employee` + `manager`).
- The result is either a link to the transaction or the reason for the rejection.
- The four scenes run from this screen without the browser console.
- Works against `src/lib/mocks.ts` until the real `stellar.ts` is ready.

### F7 — Readable rejection messages (P1, R12)

| Error | Message shown |
|---|---|
| 1 | Supplier not authorized |
| 2 | Amount exceeds the per-payment limit: manager approval required |
| 3 | Operation not allowed by the account rules |
| other | Rejected by the account rules (original error under a "Details" dropdown) |

A rejection never throws. It returns `{ ok: false, reason }` and is saved to the payment log.

There is no error 4 yet: it depends on the pending 30-day cap decision (F11).

### F8 — Payment log, including rejections (P0, R4/R7)

- Every attempt is recorded: `to`, `amount`, `concept`, `signers`, `rule`, `status` (`ok` or `rejected`), `hash` (if ok), `reason` (if rejected), and an ISO timestamp.
- Rejected attempts are kept. The auditor must see them (scene 4).
- MVP storage is local, with the hash as the reference. In P1 the log is rebuilt from the chain.

### F9 — Auditor view (P0, R9; signers and rule R13)

- A read-only table with: amount, recipient, date, status, and a link to the transaction.
- Each row also shows the signers and the rule applied.
- The auditor also sees the trail of limit and supplier changes made in Settings (F11, R17), including the 30-day cap change details listed there.
- The auditor has no signing role and cannot change anything.

### F10 — CSV export (P1, R11)

- The auditor downloads the same rows as the view, including rejected attempts, as a CSV file.

### F11 — Settings: suppliers and limits (P1, R17)

The rules below are already implemented and tested as code in `app/src/controls/` (R1; interface in `AGENTS.md` §6.4): limit validation, supplier management and the change log. R17 builds the screen and the on-chain remove/add on top of them.

- Only the admin, at any time, with their passkey. Rule changes are authorized only by the `admin` rule: the employee and the manager cannot change limits or suppliers.
- The admin can change:
  - the per-payment maximum on `ordinary` (default 500 XLM);
  - the 30-day spending cap on `ordinary` (default 1,000 XLM);
  - the supplier list (add or remove), used by `control-policy` on `ordinary` and `large`.
- Nothing is updated in place: each change removes the old rule or policy and adds a new one.
- Fail closed: `ordinary` must never accept payments without its controls. If a choice is needed, nobody can pay while the change is in progress; the account is never left open.
- The app looks up rules by name, not by ID, because every add creates a new ID.
- Settings never touches the `admin` rule. Removing it would lock the account forever.
- 30-day cap:
  - It can be changed, but keeps the amount already spent and the period start. Example: 500 spent of 1,000, raised to 1,500 → 1,000 left.
  - It can never be set below the amount already spent: that change is rejected.
  - Every change leaves an audit trail the auditor can see: previous cap, new cap, amount spent at that moment, period start, and the hashes of the remove and add transactions.

> **Decided in R17 (A = Carlos and B = DavidB confirm in the PR).** OpenZeppelin's `spending_limit` starts from zero when it is reinstalled, so the 30-day cap moved into our own `control-policy`. The amount spent and the period start are stored per account, so they survive replacing a rule, and a new cap below the amount spent is rejected on chain (error 4). A payment that would pass the cap is rejected (error 5). `ControlParams` gained `cap_per_period` and `period_ledgers` (`AGENTS.md` §6.2). A change adds the new rule before retiring the old one, so the account is never left open.

### F12 — Reproducible demo script (P1, R14)

- One script creates the account, signers, rules (with the default limits) and the demo suppliers, funded via Friendbot.
- Each rehearsal uses a new account, because each run consumes the 30-day spending cap.

### F13 — Public app with testnet notice (P1, R15)

- Deployed to Vercel or GitHub Pages.
- Visible notice: "testnet only".
- The README states that the kit's default deployer uses a key derived from a public seed, which is safe only on testnet.

### F14 — Architecture diagram (P1, R16)

- One diagram in the README (source in `docs/architecture.md`), showing the app, the `stellar.ts` boundary, the smart account, the rules and the policies.
- The deck shows a condensed version of the same path in larger type (`docs/architecture-deck.png`), because the full diagram is not legible on a slide.
- **Done when:** both are in the repository and the deck slide shows the image.

### F15 — Delivery package (P0, R10)

- Public repository with README, LICENSE (Apache-2.0 proposed), demo video, pitch deck and form answers.
- **Done when:** links are tested in a private window and submitted before 11:30.

---

## 4. Out of scope

| Item | Why |
|---|---|
| Mainnet, real funds | Testnet only |
| Select Circle USDC or native XLM (R18) | Same numeric limits; separate on-chain spend state per token |
| Remote approval link for the manager (R20 follow-up) | R20 covers a phone near the computer (QR); approving from another place needs a relay |
| 2-of-3 recovery rule (R21, P2) | Not needed for the four scenes |
| Supplier payout through a bank anchor (R22, P2) | Not needed for the four scenes |
| GitHub Actions CI (R19, P2) | Nice to have |

Scope freeze: at 20:00 on the day of the event, all features freeze. If a P0 does not reach its control, a P1 is cut. The P0 is not extended.

---

## 5. Acceptance checklist

- [ ] Scene 1: payment below the per-payment maximum to an authorized supplier, employee signature, accepted with hash (with defaults, e.g. 200 XLM)
- [ ] Scene 2: payment above the per-payment maximum, employee signature only, rejected with the manager-approval message (with defaults, e.g. 800 XLM: above the 500 maximum, below the 1,000 cap)
- [ ] Scene 2b: same payment, employee and manager signatures, accepted with hash
- [ ] Scene 3: payment to an existing testnet account that is not in the supplier list, rejected with "Supplier not authorized" (with defaults, e.g. 100 XLM)
- [ ] Scene 4: auditor sees all payments including rejected ones, downloads CSV
- [ ] All scenes run from the app, without the browser console
- [ ] Each rejected scene shows its reason and the attempt appears in the log
- [ ] The app shows the testnet notice
- [ ] The README and deck state the production passkey model and the kit's testnet deployer warning
