# Arqueo — MVP Features

Arqueo is an internal-controls layer for stablecoin treasuries on Stellar. The company's treasury is an OpenZeppelin smart account. Payment rules are enforced by the account itself: a payment that breaks a rule cannot be executed.

This document details what the MVP must do, in product terms. The requirement IDs (R#) and the build order come from `AGENTS.md` §7 and [mvp-roadmap.md](mvp-roadmap.md). The control values come from `AGENTS.md` §3.

> **Testnet only.** Arqueo runs on Stellar testnet with test funds. Passkeys are used for the admin and manager in production; the employee key lives in the browser for the demo only.

---

## 1. The problem and the MVP goal

A small company, startup or association holds stablecoins behind a single key. One person can move all the money, approvals happen in chat, and the auditor receives screenshots.

The MVP is finished when the four scenes below run end to end on testnet:

| # | Scene | Expected result |
|---|---|---|
| 1 | Pay **200 XLM** to an authorized supplier, signed by the employee | Accepted. Transaction hash shown with a link to stellar.expert |
| 2 | Pay **2,000 XLM** signed by the employee alone | Rejected: "Amount exceeds the per-payment limit: manager approval required" |
| 2b | Same payment, signed by employee **and** manager | Accepted |
| 3 | Pay **100 XLM** to an unknown account | Rejected: "Supplier not authorized" |
| 4 | Auditor opens the payments view and downloads a CSV | Sees every payment, including rejected attempts |

Scene 2 has two parts: the single-signature attempt is rejected, and the same payment with the manager's signature is accepted. Scene 2b is the second half of scene 2.

**Pitch precision:** a rejection happens when the transaction is simulated against the account's rules. If the transaction were sent anyway, the network would reject it too.

---

## 2. Actors and signing roles

Roles are fixed for the MVP. Only the demo data changes.

| Role | Signs with | What it does |
|---|---|---|
| `admin` | passkey | Creates the account, rules, signers and suppliers |
| `employee` | Ed25519 testnet key stored in the browser (demo shortcut) | Ordinary payments |
| `manager` | passkey | Second signature on large payments |
| `auditor` | nothing (read-only) | Views payments and exports CSV |

### Rules

| Rule | Context | Signers | Policies |
|---|---|---|---|
| `admin` | default | admin | none (without policies, every signer is required) |
| `ordinary` | calls to the token contract | employee | threshold 1 · `control-policy` {suppliers, max 500 per payment} · OpenZeppelin `spending_limit`: 1,000 every 30 days |
| `large` | calls to the token contract | employee + manager | threshold 2 · `control-policy` {suppliers, no maximum} |

The app picks the rule from who signs:

- `['employee']` → `ordinary`
- `['employee', 'manager']` → `large`

Every rule that carries policies must have a threshold policy. A rule allows at most 15 signers and 5 policies.

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

- The `ordinary` rule is created with threshold 1 and the OpenZeppelin `spending_limit`.
- The first payment is signed by the employee alone through the kit's `multiSigners` path.
- **Done when:** a transaction hash appears on testnet. This is the 14:00 control.

### F4 — Supplier allowlist and per-payment cap (P0, R5, R6)

Implemented in our own `control-policy` contract.

- Installation parameters per account and per rule: `ControlParams { allowlist, max_per_payment }`. Amounts are in stroops. `None` means no maximum.
- Errors: `1` supplier not allowed · `2` amount over limit · `3` operation not a transfer.
- On a `transfer(from, to, amount)` call, the policy checks that `to` is in the allowlist and that `amount` is not above the maximum.
- Any other function is rejected.
- The policy is installed on `ordinary` (with the cap of 500) and on `large` (no cap).
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

### F8 — Payment log, including rejections (P0, R4/R7)

- Every attempt is recorded: `to`, `amount`, `concept`, `signers`, `rule`, `status` (`ok` or `rejected`), `hash` (if ok), `reason` (if rejected), and an ISO timestamp.
- Rejected attempts are kept. The auditor must see them (scene 4).
- MVP storage is local, with the hash as the reference. In P1 the log is rebuilt from the chain.

### F9 — Auditor view (P0, R9; signers and rule R13)

- A read-only table with: amount, recipient, date, status, and a link to the transaction.
- Each row also shows the signers and the rule applied.
- The auditor has no signing role and cannot change anything.

### F10 — CSV export (P1, R11)

- The auditor downloads the same rows as the view, including rejected attempts, as a CSV file.

### F11 — Settings: suppliers and limits (P1, R17)

- The admin can add or remove suppliers and change the per-payment limit.
- Each change requires the admin's passkey signature.

### F12 — Reproducible demo script (P1, R14)

- One script creates the account, signers, rules and suppliers.
- Each rehearsal uses a new account, because the monthly spending limit is consumed by each run.

### F13 — Public app with testnet notice (P1, R15)

- Deployed to Vercel or GitHub Pages.
- Visible notice: "testnet only".
- The README states that the kit's default deployer uses a key derived from a public seed, which is safe only on testnet.

### F14 — Architecture diagram (P1, R16)

- One diagram used in the README and the deck, showing the app, the `stellar.ts` boundary, the smart account, the rules and the policies.

### F15 — Delivery package (P0, R10)

- Public repository with README, LICENSE (Apache-2.0 proposed), demo video, pitch deck and form answers.
- **Done when:** links are tested in a private window and submitted before 11:30.

---

## 4. Out of scope

| Item | Why |
|---|---|
| Mainnet, real funds | Testnet only |
| USDC instead of XLM (R18, P2) | Only if time remains |
| Passkey for the manager on a phone (R20, P2) | Not needed for the four scenes |
| 2-of-3 recovery rule (R21, P2) | Not needed for the four scenes |
| Supplier payout through a bank anchor (R22, P2) | Not needed for the four scenes |
| GitHub Actions CI (R19, P2) | Nice to have |

Scope freeze: at 20:00 on the day of the event, all features freeze. If a P0 does not reach its control, a P1 is cut. The P0 is not extended.

---

## 5. Acceptance checklist

- [ ] Scene 1: 200 XLM to an authorized supplier, employee signature, accepted with hash
- [ ] Scene 2: 2,000 XLM, employee signature only, rejected with the manager-approval message
- [ ] Scene 2b: 2,000 XLM, employee and manager signatures, accepted with hash
- [ ] Scene 3: 100 XLM to an unknown account, rejected with "Supplier not authorized"
- [ ] Scene 4: auditor sees all payments including rejected ones, downloads CSV
- [ ] All scenes run from the app, without the browser console
- [ ] Each rejected scene shows its reason and the attempt appears in the log
- [ ] The app shows the testnet notice
- [ ] The README and deck state the production passkey model and the kit's testnet deployer warning
