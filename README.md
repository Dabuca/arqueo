<!--
PENDING before submission (R10). Each gap is marked TODO(R10) below. Remove this block when done.
- Failed on-chain tx hashes for scenes 2 and 3, and testnet verification of scene 3: from B and A.
- Scene 4 screenshot or video timestamp: from C.
- Smart account ID: from B (R3 creates it in each browser; the repo does not record it).
- control-policy contract ID: from A (no deployment recorded in the repo or scaffold.yml).
- App URL (C, R15), video URL (D) and design screenshots (C).
- Final pass after the 20:00 freeze (D).
-->

# Arqueo

**Internal controls for stablecoin treasuries on Stellar: payment rules are
enforced by the account itself, not by a PDF.**

> **Testnet only.** Arqueo runs on Stellar testnet with test funds. Do not use
> it with real money.

HackMeridian 2026 · Track Genesis · Stellar Composed

## Try it / Watch it

- **App:** <!-- TODO(R10): app URL (R15) -->not published yet
- **Video:** <!-- TODO(R10): video URL -->not recorded yet
- **Pitch deck and submission pack:**
  [docs/submission](docs/submission/README.md)

## The problem

A small company, startup or association that keeps stablecoins usually depends
on one key. One person can move all the money. Approvals happen in chat. The
auditor receives screenshots. The spending policy is a document that nothing
enforces.

## How Arqueo solves it

The treasury is an
[OpenZeppelin](https://docs.openzeppelin.com/stellar-contracts) smart account on
Stellar. The authorization matrix becomes context rules and policies of the
account. A payment that breaks them cannot go through. Every payment, accepted
or rejected, leaves a record the auditor can read and export.

## Proof on Stellar

The MVP is done when these four scenes run on testnet from start to finish.
Amounts depend on the limits the admin sets. With the defaults (500 XLM per
payment, 1,000 XLM per 30 days) the demo uses 200, 800 and 100 XLM.

| #   | Scene                                                                                    | What happens                                                                                                                                            | Proof (stellar.expert, testnet)                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Payment below the per-payment maximum, to an authorized supplier, signed by the employee | Accepted by rule `ordinary`                                                                                                                             | [`f7af3add…7ee12a8e`](https://stellar.expert/explorer/testnet/tx/f7af3add0b4141f5caf9ced34c718e5ba7848265dcdb9fbc9520d7077ee12a8e), 200 XLM, ledger 5,385,825 |
| 2   | Payment above the maximum, signed only by the employee                                   | Rejected by `control-policy` with error 2 (`AmountOverLimit`): the simulation fails, and one rejected transaction is sent on purpose and fails on chain | Simulation rejected with error 2 (800 XLM, employee only; reported in `AGENTS.md` R7). <!-- TODO(R10): failed tx hash (B) -->                                 |
| 2b  | Same payment, signed by employee and manager                                             | Accepted by rule `large`                                                                                                                                | [`03784fdb…63f711d2`](https://stellar.expert/explorer/testnet/tx/03784fdb5d38537fc92f82e30754a942af5204b740b4335937ddd45763f711d2), 800 XLM, ledger 5,386,036 |
| 3   | Payment to an account that is not on the supplier list                                   | Rejected by `control-policy` with error 1 (`SupplierNotAllowed`), with its failed transaction                                                           | <!-- TODO(R10): failed tx hash; scene 3 still needs end-to-end testnet verification (B) -->                                                                   |
| 4   | The auditor opens the payment list                                                       | Sees every payment, including rejected attempts, and downloads a CSV                                                                                    | <!-- TODO(R10): screenshot or video timestamp (C, after R9/R11) -->                                                                                           |

The rejection in scenes 2 and 3 happens when the transaction is simulated
against the account's rules. If it were sent anyway, the network would reject
it.

| Contract              | Testnet ID                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| Company smart account | <!-- TODO(R10): C... address of the demo account (B; R3 creates it but the repo does not record it) --> |
| `control-policy`      | <!-- TODO(R10): C... contract ID (A; no deployment is recorded in the repo yet) -->                     |

Not built yet: the admin Settings screen (R17), the demo script (R14) and a
hosted URL (R15). Scene 3 and the failed on-chain transactions of scenes 2 and 3
still need end-to-end testnet verification. The table is filled in as each one
lands.

## How Stellar is composed

| Piece                                                                                                    | What it gives Arqueo                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [OpenZeppelin Stellar Contracts](https://docs.openzeppelin.com/stellar-contracts/accounts/context-rules) | The smart account, context rules (`admin`, `ordinary`, `large`), the threshold policy (how many signatures a rule needs) and `spending_limit` (the 30-day cap) |
| [`smart-account-kit`](https://cdn.jsdelivr.net/npm/smart-account-kit@0.6.1/README.md) 0.6.1              | Creates the account, WebAuthn passkey signers (admin, manager), an Ed25519 signer (employee) and multi-signer transactions                                     |
| [Scaffold Stellar](https://developers.stellar.org/docs/tools/scaffold-stellar)                           | Project template, contract build and generated TypeScript clients                                                                                              |
| `contracts/control-policy` (ours, Rust/Soroban)                                                          | A custom policy: only `transfer` calls, only to listed suppliers, up to a maximum per payment                                                                  |
| Native XLM through its Stellar Asset Contract                                                            | The token that moves. Amounts are in stroops (1 XLM = 10,000,000)                                                                                              |
| Friendbot                                                                                                | Funds the testnet accounts                                                                                                                                     |
| stellar.expert                                                                                           | Public proof of every transaction                                                                                                                              |

## Controls matrix

| Role       | Signs with                                      | What it does                                                                         |
| ---------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `admin`    | passkey                                         | Creates the account and its rules. Sets and changes limits and suppliers at any time |
| `employee` | Ed25519 key kept in the browser (demo shortcut) | Ordinary payments                                                                    |
| `manager`  | passkey                                         | Second signature on large payments                                                   |
| `auditor`  | nothing (read-only)                             | Sees payments and exports CSV                                                        |

| Rule              | Signers            | Policies                                                                                              |
| ----------------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| `admin` (default) | admin              | none (all signers must sign)                                                                          |
| `ordinary`        | employee           | threshold 1 · `control-policy` {suppliers, max per payment, default 500} · 30-day cap (default 1,000) |
| `large`           | employee + manager | threshold 2 · `control-policy` {suppliers, no maximum}                                                |

The app picks the rule from who signs. The admin decides the limits and
suppliers, not the code. Changes are never made in place: the old rule or policy
is removed and a new one is added, and the account stays closed (nobody can pay)
while that happens. Every change is recorded for the auditor with the old value,
the new value and the transaction hashes. The 30-day cap keeps what was already
spent and cannot be set below it.

Open decision: OpenZeppelin's `spending_limit` restarts from zero when it is
reinstalled, so the cap may move into `control-policy` (see `AGENTS.md` §3.1).
The settings screen is planned (R17).

The matrix also exists as tested code:
[app/src/controls](app/src/controls/README.md).

## Architecture

See [docs/architecture.md](docs/architecture.md).

## Built this weekend

Everything below was written at the event, starting Sunday 25 October 2026.
Times are UTC+1; Lisbon is one hour earlier.

| When              | What                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Sun 11:50         | Initial commit and the team guide (`AGENTS.md`)                                                                                      |
| Sun 13:52         | MVP feature spec and roadmap                                                                                                         |
| Sun 14:37         | Project generated with `stellar scaffold init`                                                                                       |
| Sun 15:22 – 16:02 | Testnet configuration and balance read (R2)                                                                                          |
| Sun 15:50         | `control-policy` contract with tests (R5); auditor CSV export component (R11)                                                        |
| Sun 16:17         | Company smart account creation and funding (R3)                                                                                      |
| Sun 15:59 – 17:21 | Controls matrix as tested TypeScript: limits, suppliers, rule per amount, change log (R1)                                            |
| Sun 17:52 – 19:43 | `ordinary` and `large` rules, first employee-signed payment and multi-signer payment (R4, R6, R7); readable rejection messages (R12) |
| Sun 22:06 – 22:40 | Payment screen, auditor journal with signers and rule (R8, R9, R13), submission pack                                                 |

From the Scaffold Stellar template (not ours): the app shell, the `Home` and
`Debug` pages, the wallet and notification providers, the example contracts
(`guess-the-number`, `fungible-allowlist`, `nft-enumerable`) and the inherited
CI workflows.

Ours: `contracts/control-policy`, `app/src/controls`, `app/src/lib/stellar.ts`
(account creation, funding, balance), the CSV export and the documentation.

<!-- TODO(R10): final pass after 20:00 freeze -->

## For judges

| Criterion                                       | Where to look                                                                                                                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fit with the track                              | [How Stellar is composed](#how-stellar-is-composed): OpenZeppelin smart account and policies plus `smart-account-kit`, with our own policy contract                         |
| User value and problem                          | [The problem](#the-problem) and [Controls matrix](#controls-matrix)                                                                                                         |
| Technical execution                             | [`contracts/control-policy`](contracts/control-policy/src) with tests, [`app/src/controls`](app/src/controls) with unit tests, [docs/architecture.md](docs/architecture.md) |
| Innovation                                      | Controls enforced by the account on chain, not by the app; limits the admin can change without opening a hole                                                               |
| Progress in the hackathon                       | The commit history and [Built this weekend](#built-this-weekend)                                                                                                            |
| Ecosystem and market                            | [Who it's for](#who-its-for-and-whats-next)                                                                                                                                 |
| Design and UX                                   | <!-- TODO(R10): screenshots of Payments and Auditor (C, after R8/R9) -->                                                                                                    |
| Uses Stellar in a meaningful, demonstrable way? | [Proof on Stellar](#proof-on-stellar): transactions on stellar.expert                                                                                                       |

## Who it's for and what's next

For small companies, startups and associations that hold stablecoins and need
more than one key.

Planned, not built: USDC instead of XLM, paying suppliers into their bank
through an anchor, a 2-of-3 recovery rule, the manager's passkey on a phone, and
applying to the Stellar Community Fund.

## Run it locally

Requirements: Node.js 22+, Rust (see `rust-toolchain.toml`), the Stellar CLI and
the Scaffold Stellar plugin (`cargo install --locked stellar-scaffold-cli`).

```bash
cp app/.env.example app/.env.local   # kit addresses are filled in; set PUBLIC_CONTROL_POLICY_ADDRESS and PUBLIC_SUPPLIERS
npm install
npm start              # set STELLAR_NETWORK=testnet in app/.env.local first
```

```bash
npm test --workspace app            # unit tests of the controls matrix
cd contracts/control-policy && cargo test
stellar scaffold build              # builds contracts, regenerates the clients
```

`npm run build --workspace app` needs the clients that `stellar scaffold build`
generates in `app-lib/clients`.

Warnings:

- **Testnet only.** The default deployer of `smart-account-kit` uses a key
  derived from a public seed. That is fine on testnet and unsafe anywhere else.
- **Demo shortcut.** In production each person signs with their own passkey on
  their own device. The employee key stored in the browser exists only for the
  demo.
- Never commit secret keys (`S...`), not even testnet ones. Use `.env.local`.

## Team

| Person | Role                         |
| ------ | ---------------------------- |
| Carlos | A · Contracts (Rust/Soroban) |
| DavidB | B · Account and payments     |
| DavidP | C · App and audit            |
| Jesús  | D · Product and delivery     |

## License

[Apache-2.0](LICENSE)
