<!--
PENDING before submission (R10). Each gap is marked TODO(R10) below. Remove this block when done.
- App URL (R15, needs the team's Vercel account), video URL (D) and design screenshots (C).
- Optional: a deliberately sent, failed on-chain transaction for scenes 2 and 3 (B).
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

| #   | Scene                                                                                    | What happens                                                                               | Proof (testnet)                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Payment below the per-payment maximum, to an authorized supplier, signed by the employee | Accepted by rule `ordinary`                                                                | [`f7af3add…7ee12a8e`](https://stellar.expert/explorer/testnet/tx/f7af3add0b4141f5caf9ced34c718e5ba7848265dcdb9fbc9520d7077ee12a8e), 200 XLM, ledger 5,385,825            |
| 2   | Payment above the maximum, signed only by the employee                                   | Refused by `control-policy` with error 2 (`AmountOverLimit`): "manager approval required"  | Refused when the transaction is simulated, so it has no hash (800 XLM, reported in `AGENTS.md` R7). <!-- TODO(R10): optional failed on-chain tx, sent on purpose (B) --> |
| 2b  | Same payment, signed by employee and manager                                             | Accepted by rule `large`                                                                   | [`03784fdb…63f711d2`](https://stellar.expert/explorer/testnet/tx/03784fdb5d38537fc92f82e30754a942af5204b740b4335937ddd45763f711d2), 800 XLM, ledger 5,386,036            |
| 3   | Payment to an account that is not on the supplier list                                   | Refused by `control-policy` with error 1 (`SupplierNotAllowed`)                            | [docs/evidence-R6-scene3.md](docs/evidence-R6-scene3.md): 100 XLM refused, recipient balance unchanged. No hash, because a refused payment never reaches the chain       |
| 4   | The auditor opens the payment list                                                       | Sees every payment, including refused attempts, with signers and rule, and downloads a CSV | <!-- TODO(R10): screenshot or video timestamp (C) -->                                                                                                                    |

Also checked on testnet: changing limits and suppliers from Settings
([evidence](docs/evidence-R17-settings.md)) and the remaining 30-day cap on the
payment screen ([evidence](docs/evidence-R23-cap.md)).

A refusal happens when the transaction is simulated against the account's rules.
If it were sent anyway, the network would reject it.

| Contract                                                  | Testnet ID                                                                                                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `control-policy`                                          | [`CBPCC6AT3756K43DGTRKLIZFOY5TODHZXGBJS4X4KZ64TFWUQDPEWU4L`](https://stellar.expert/explorer/testnet/contract/CBPCC6AT3756K43DGTRKLIZFOY5TODHZXGBJS4X4KZ64TFWUQDPEWU4L) |
| Company smart account used in the Settings and cap checks | [`CBUNXLPEKPDGZOEJB4PRBZHXTZ6JOXCH7RAVW6LJTDY62BI2G2LXMUH6`](https://stellar.expert/explorer/testnet/contract/CBUNXLPEKPDGZOEJB4PRBZHXTZ6JOXCH7RAVW6LJTDY62BI2G2LXMUH6) |

Each browser creates its own company account, so scenes 1 and 2b come from an
earlier rehearsal account.
<!-- TODO(R10): record the final demo account ID after the last rehearsal (B) -->

Not built yet: the demo script (R14) and a hosted URL (R15).

## How Stellar is composed

| Piece                                                                                                    | What it gives Arqueo                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [OpenZeppelin Stellar Contracts](https://docs.openzeppelin.com/stellar-contracts/accounts/context-rules) | The smart account, context rules (`admin`, `ordinary`, `large`), the threshold policy (how many signatures a rule needs) and the account's rule engine  |
| [`smart-account-kit`](https://cdn.jsdelivr.net/npm/smart-account-kit@0.6.1/README.md) 0.6.1              | Creates the account, WebAuthn passkey signers (admin, manager), an Ed25519 signer (employee) and multi-signer transactions                              |
| [Scaffold Stellar](https://developers.stellar.org/docs/tools/scaffold-stellar)                           | Project template, contract build and generated TypeScript clients                                                                                       |
| `contracts/control-policy` (ours, Rust/Soroban)                                                          | A custom policy: only `transfer` calls, only to listed suppliers, up to a maximum per payment and a 30-day cap whose spent amount survives rule changes |
| Native XLM through its Stellar Asset Contract                                                            | The token that moves. Amounts are in stroops (1 XLM = 10,000,000)                                                                                       |
| Friendbot                                                                                                | Funds the testnet accounts                                                                                                                              |
| stellar.expert                                                                                           | Public proof of every transaction                                                                                                                       |

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
| `ordinary`        | employee           | threshold 1 · `control-policy` {suppliers, max per payment (default 500), 30-day cap (default 1,000)} |
| `large`           | employee + manager | threshold 2 · `control-policy` {suppliers; no maximum, no cap}                                        |

The app picks the rule from who signs. The admin decides the limits and
suppliers, not the code, from the Settings screen. A change adds the new rule
before it removes the old one, so `ordinary` is never open without its controls.
The spent amount and the start of the 30-day period belong to the account, so
they survive the change, and the cap cannot be set below what was already spent.
Every change is recorded for the auditor with the old value, the new value and
the transaction hashes.

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

Ours: `contracts/control-policy`, `app/src/controls`, `app/src/lib/stellar.ts`,
the Payments, Auditor and Settings screens, the landing page and the
documentation.

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
cp app/.env.example app/.env.local   # testnet addresses, including control-policy, are filled in; add your funded suppliers to PUBLIC_SUPPLIERS
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
