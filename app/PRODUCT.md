# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Small companies, startups and associations that hold stablecoins.** The
  person who runs the treasury (founder, finance lead, association treasurer)
  needs payments to follow internal rules without trusting a single key holder.
- **HackMeridian 2026 judges.** They review the project asynchronously (demo
  video, pitch deck, GitHub repo, form answers) and score track fit, user value,
  technical execution, innovation, progress, market potential, and design/UX.
  They ask: does it use Stellar meaningfully, and can it be demonstrated?

## Product Purpose

Arqueo is internal controls for stablecoin treasuries on Stellar. Payment rules
are enforced by the account itself, not by a PDF. The treasury is an
OpenZeppelin smart account; the authorization matrix becomes account rules and
policies, and a payment that breaks them cannot be made. Every payment,
including rejected attempts, leaves verifiable evidence for the auditor.

Success for the MVP: four scenes run end to end on testnet:

1. A 200 XLM payment to an authorized supplier passes with the employee's
   signature.
2. A 2,000 XLM payment is rejected with one signature and accepted when the
   manager also signs.
3. A 100 XLM payment to an unknown account is rejected by the account rules.
4. The auditor sees every payment (rejected attempts too) and downloads a CSV.

## Positioning

The controls live in the account, on chain. Approval chats, spreadsheets and
screenshots describe rules; Arqueo's smart account refuses a payment that breaks
them. Rejection happens when the transaction is simulated against the account
rules; if it were sent anyway, the network would reject it.

## Operating Context

- Roles: `admin` (passkey; creates the account, rules, signers, suppliers),
  `employee` (Ed25519 key in the browser, demo shortcut; ordinary payments),
  `manager` (passkey; second signature on large payments), `auditor` (read only;
  payments and CSV).
- Rules: `admin` (default), `ordinary` (employee, threshold 1, authorized
  suppliers, max 500 per payment, spending limit 1,000 every 30 days), `large`
  (employee + manager, threshold 2, authorized suppliers, no per-payment max).
- Stack: Stellar testnet, OpenZeppelin Stellar Contracts (smart account,
  threshold and spending-limit policies), a custom `control-policy` contract,
  `smart-account-kit` 0.6.0, React + Vite + TypeScript (Scaffold Stellar).

## Capabilities and Constraints

- Testnet only. The token is native testnet XLM through its Stellar Asset
  Contract. No real funds.
- Browser-held keys are a demo shortcut; in production each person would sign
  with a passkey on their own device. This must be stated, not hidden.
- The landing lives at `/` of the app; the treasury demo moves to `/app`.
- Open: public app URL (R15) and demo video (R10) do not exist yet.

## Brand Commitments

- Name: **Arqueo** (formerly FourEyes).
- Logo is fixed: a cream disc in front of a deep green disc, crossed by a thin
  orbit line with a small dark planet and a four-pointed star. Wordmark "ARQUEO"
  in a geometric sans with a crossbar-less A. Assets: `src/images/arqueo1.jpeg`
  (symbol), `src/images/arqueo2.jpeg` (symbol + wordmark).
- Brand colors come from the logo: warm cream paper and deep green.
- All product copy is in English.

## Evidence on Hand

- Working testnet flow: company smart account created with an admin passkey and
  funded (R3), balance read (R2), `control-policy` contract with tests (R5).
- No customers, testimonials, pricing, metrics, or press. Do not invent them.
- Demo video not recorded yet: leave a clearly marked slot.

## Product Principles

1. Rules are enforced, not documented: every claim on the page should be
   something the account actually does on testnet.
2. Show the mechanism: judges must see where Stellar does the work.
3. Honest about the demo: testnet only, browser keys are a shortcut.
4. Evidence over assertion: link to transactions and code rather than
   adjectives.
