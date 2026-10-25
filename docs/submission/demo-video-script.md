# Arqueo demo video — recording script

Target length: 75–90 seconds. Record the real app in a browser with the Stellar testnet visible. Use one browser profile throughout so the account and browser-local journal remain consistent. Do not record secrets or claim a scene that has not been verified live.

## Before recording

- Set `app/.env.local` to Stellar testnet, a deployed `control-policy`, and funded supplier accounts.
- Confirm the app is using the intended company smart account and show its address in the recording only if the account is public on testnet.
- Make sure the balance is sufficient for the demo.
- Prepare a supplier address on the allowlist.
- Rehearse the employee-only 800 XLM rejection and the employee + manager approval. The amount must be over the per-payment limit and below the 30-day cap.
- Keep the transaction hash visible after an accepted payment. Do not use a mock result as testnet proof.
- Scene 3 is not verified in the project checklist yet. Add it only after an unknown but funded testnet account is rejected by the account policy in the app.

## Shot list and narration

### 0:00–0:10 — The problem

**Show:** Arqueo landing page.

**Say:** “Small teams often approve stablecoin payments in chat, while one key can still move the funds. Arqueo puts the payment rules on the treasury account itself.”

### 0:10–0:20 — The account rules

**Show:** the payment screen and its signer selector.

**Say:** “An ordinary payment uses the employee rule. A large payment uses a separate rule that needs the employee and manager. These are rules of the Stellar smart account, not just labels in the interface.”

### 0:20–0:34 — Employee-only attempt

**Show:** choose an authorized supplier, enter 800 XLM, choose employee only, and submit. Keep the account's rejection reason visible.

**Say:** “The employee tries to pay 800 XLM alone. The account simulation rejects it because the amount exceeds the ordinary per-payment limit.”

### 0:34–0:49 — Manager co-signs

**Show:** submit the same payment with employee and manager; show the successful result and transaction link.

**Say:** “With the manager's second signature, the large rule accepts the same payment. The settled transfer has a hash on Stellar testnet.”

### 0:49–1:05 — Auditor view

**Show:** open the auditor journal and show both attempts with amount, recipient, status, signers, rule, and the accepted transaction link.

**Say:** “The auditor can inspect the attempts, including the rejected one, and see who signed and which rule applied. The MVP journal is stored in this browser; accepted transfers link to Stellar Expert.”

### 1:05–1:20 — Stellar composition and honest status

**Show:** the deck's architecture slide or the repository README.

**Say:** “Arqueo combines Stellar smart accounts, smart-account-kit, OpenZeppelin policies, and our Soroban control policy. This build is testnet-only. We are still verifying the unknown-supplier scene and finishing CSV export and admin settings.”

## Optional scene 3 insert — only after verification

Use a funded testnet account that is not on the allowlist. Submit a small payment to it, show the account-policy rejection, and confirm that the failed attempt appears in the auditor journal. Replace the status line in the narration with: “A funded account outside the supplier list is rejected by the account policy.” Save the transaction simulation details for the team's evidence; a rejected simulation has no settled transaction hash.
