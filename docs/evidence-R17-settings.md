# R17 evidence: settings change limits and suppliers on chain

Requirement: the admin can add or remove suppliers and change limits from the settings screen, and the account enforces the result.

## Test run (testnet, 2026-10-26)

- Company smart account: `CBUNXLPEKPDGZOEJB4PRBZHXTZ6JOXCH7RAVW6LJTDY62BI2G2LXMUH6`.
- Supplier tested: `GDUFOAGKAFX4IUCAYJHEXPNMOVX6NPVCWCXH2HPZNRGKEOQMZO5MH3YC` (account created by Friendbot at 02:24:07 UTC).

**Limits (earlier step):** the 30-day cap was raised from 1,000 to 1,500 XLM. A cap below the amount already spent is refused with "The 30-day cap cannot be below the amount already spent (1422.2345178 XLM)", which matches the on-chain spent amount.

**Supplier added, payments accepted:**

- 02:26:32 UTC, 2 XLM, transaction `09899cdcb45f612470c1f7cc9d796c6ddda2e6023eaf09273662879c3ca15bdd`, successful.
- 02:27:17 UTC, 1 XLM, transaction `5b0f3cba33fb5aa2e0774a8cd9581913d30a0f57eef5b8728b1bc487517ea153`, successful.

**Supplier removed, payment refused:** the removal is the rule update at 02:27:47–02:28:02 UTC (add new rule, remove old). The refused attempt does not appear on chain, which is expected: a refused payment is never sent.

## Open note

The removal is identified by the order of the rule updates on chain, not by reading the rule contents. The tester confirmed the order of actions in the app. Reading the current rule would confirm it.
