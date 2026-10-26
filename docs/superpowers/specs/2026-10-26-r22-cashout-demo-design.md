# R22 — Supplier cash-out through an anchor (simulated demo)

Date: 2026-10-26 · Owner: Carlos (A) · Branch: `a/R22-cashout-demo`

## Goal

Show judges, in the app, how a supplier who was paid in test USDC would move
that money to their bank account through a Stellar anchor. The screen tells the
off-ramp story for the video and the deck. **It is a simulation: no funds move,
nothing is sent to the network and no anchor is contacted.**

## Why simulated

A real SEP-24 withdrawal is not possible in this demo today:

- Arqueo's test USDC is issued by Arqueo. Public testnet anchors
  (`testanchor.stellar.org`) only accept their own assets (SRT, Circle's test
  USDC).
- Demo suppliers are created without a stored secret key
  (`createFundedAccount` in `app/src/lib/stellar.ts`), so they cannot sign a
  SEP-10 challenge.
- The submission deadline leaves no room for a new network dependency.

## Scope

In:

- New route `/cashout` and a "Supplier" entry in the header navigation.
- A four-step flow driven by a pure, tested state module.
- A permanent notice that the flow is simulated and is roadmap.
- AGENTS.md checkbox for R22 with the simulation caveat; one README line.

Out:

- Any call to Stellar, an anchor, SEP-1/10/12/24 endpoints or `stellar.ts`.
- Real KYC, real IBAN validation (checksum), persistence between visits.

## User flow

A notice at the top of the page, always visible:
"Simulated anchor flow — no funds move. Roadmap: SEP-24 withdrawal through a
Stellar anchor."

The fictional anchor is named "Demo Anchor (testnet)".

| Step | Screen | What a real anchor does (shown as a small note) |
| --- | --- | --- |
| 1. Amount | USDC amount (default 200). Shows anchor fee, net USDC and EUR received at a fixed demo rate. | SEP-24 `/info` and a quote of fees and rate. |
| 2. Bank details | Account holder and IBAN, prefilled with sample values, editable. Checkbox "KYC verified by the anchor". | The anchor's interactive SEP-24 page collects KYC and bank details. |
| 3. Send to anchor | "Approve transfer" button. On click: "USDC sent to the anchor" with a reference `SIMULATED-…`, no explorer link. | The supplier's wallet sends a Stellar payment to the anchor with the memo it asked for. |
| 4. Bank transfer sent | Summary: amount, fee, net, EUR, masked IBAN, date. "Start again" button. | The anchor pays out to the bank and SEP-24 `/transaction` reports `completed`. |

"Continue" is disabled while the current step is invalid. A step cannot be
skipped.

## Components

- `app/src/pages/cashout.ts` — pure logic, no network, no React:
  - Demo constants: fee (fixed + percentage), USDC→EUR rate, sample holder and
    IBAN.
  - `quote(amount)` → `{ amount, fee, net, eur }`, rounded to cents; invalid
    when `amount <= fee` or not a finite positive number.
  - `validateBankDetails({ holder, iban, kyc })` → list of error messages; IBAN
    check is format only (two letters, two digits, 11–30 alphanumerics, spaces
    ignored).
  - `maskIban(iban)` → keeps country code and last four characters.
  - `CashOutState` and `next(state, event)` — the step machine (`amount` →
    `bank` → `send` → `done`, plus `restart`). Invalid events leave the state
    unchanged.
- `app/src/pages/CashOutPage.tsx` + `CashOutPage.module.css` — renders the state,
  following the look of the existing pages.
- `app/src/App.tsx` — route `/cashout` inside `AppLayout`.
- `app/src/components/SiteHeader.tsx` — `{ to: "/cashout", label: "Supplier" }`.

## Error handling

Inline messages under the field for an invalid amount, an empty holder, a
malformed IBAN or unchecked KYC. There are no network errors because there is
no network.

## Testing

- `app/src/pages/cashout.test.ts` (vitest): quote values and rounding, invalid
  amounts, IBAN format and masking, every transition, no step skipping,
  restart.
- `npm test --workspace app` and `npm run build --workspace app` pass.
- Manual check in the browser: the four steps, the notice, mobile width.

## Ownership and process

- `pages/` and `components/` belong to C; the PR explains the change and asks
  C to review (AGENTS.md §10.2). `AGENTS.md` and `README.md` belong to D; the
  PR mentions the checkbox and README line.
- No push or PR until the person confirms.
