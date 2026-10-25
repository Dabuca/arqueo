# HackMeridian form answers — draft

Use these drafts for the matching fields in the signed-in submission form. Confirm the final prompts and character limits before submitting. Replace every `[pending]` field with verified information.

## Project name

Arqueo

## One-line description

Arqueo puts a small treasury's payment approval rules on a Stellar smart account, where the account enforces supplier, amount, and signer requirements before funds can move.

## Problem

Small businesses and associations often keep stablecoins behind one key. Approval decisions happen in chat, and the audit trail is assembled from screenshots. Those workflows do not stop a payment that violates the organization's own rules.

## Solution

Arqueo configures a Stellar smart account with named payment rules. Ordinary payments use an employee signer and account policies; large payments require both an employee and a manager. The app simulates a payment against the account rules and records accepted or rejected attempts in a browser journal for review.

## Stellar integration

The treasury is an OpenZeppelin smart account on Stellar testnet. The React app uses Stellar's `smart-account-kit` to create and call that account. The account evaluates context rules and policies for calls to the native XLM Stellar Asset Contract. A custom Soroban `control-policy` checks the supplier allowlist and per-payment maximum. Accepted testnet transfers settle on Stellar and link to their transaction hashes.

## Track fit — Genesis / Stellar Composed

Arqueo composes Stellar smart accounts and `smart-account-kit` with OpenZeppelin's account policies and a custom Soroban policy. The result is a payment-control workflow enforced by the account rather than by an off-chain checklist.

## What works now

The repository contains the smart-account payment app, ordinary and large rules, the custom policy contract, and a read-only auditor journal. Testnet evidence recorded in the project notes includes a 200 XLM employee-signed payment and an 800 XLM flow rejected with the employee signature alone and accepted with the employee and manager. The auditor view shows amount, recipient, concept, date, result, signer roles, rule, and links for accepted transactions.

## What is still being verified

The unknown-supplier scene still needs an end-to-end testnet verification from the app. The auditor's CSV control is not yet connected. The journal is browser-local in this MVP, and admin settings, hosted deployment, and a chain-reconstructed audit history are not complete. The demo uses testnet only.

## Continued development

Next steps are to verify the supplier-rejection scene, connect CSV export, complete admin-managed suppliers and limits, and move the audit record toward chain-reconstructed history. In production, every role should use a passkey on its own device; the browser-held employee key is only a demo shortcut.

## Links

- GitHub repository: https://github.com/Dabuca/arqueo
- Demo video: [pending recording and shareable URL]
- Pitch deck: [pending upload/share URL; source is `docs/submission/pitch-deck.html`]
- Public demo URL: [pending deployment; R15]

## Team and submission metadata

- Team name: [confirm in event platform]
- Team members and roles: [confirm names and spelling in event platform]
- Contact email: [use the team's registered event account]
- Submission form: [complete in the signed-in HackMeridian platform]
