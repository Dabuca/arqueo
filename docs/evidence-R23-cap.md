# R23 evidence: the payment screen shows what is left of the 30-day cap

Requirement: the payment screen shows how much of the 30-day cap is left, and by how much a payment goes past it when it is refused for the cap.

## Test run (testnet, 2026-10-26)

- Company smart account: `CBUNXLPEKPDGZOEJB4PRBZHXTZ6JOXCH7RAVW6LJTDY62BI2G2LXMUH6`.
- Policy: `control-policy` `CBPCC6AT3756K43DGTRKLIZFOY5TODHZXGBJS4X4KZ64TFWUQDPEWU4L`, period start ledger 5389471.
- Cap raised from 1,000 to 1,500 XLM (R17 check). Spent in the period carried over.

**Refusal case (cap at 1,000):** the payment screen showed 0.0000027 XLM left and, for a 500 XLM payment, "499.9999973 XLM over what is left". The account refused it with "Amount exceeds what is left of the 30-day cap: manager approval required". The arithmetic matches: 500 − 0.0000027 = 499.9999973.

**On-chain reconciliation (read-only, `spend_state`):** spent = 13,999,999,973 stroops = 1,399.9999973 XLM. With the cap at 1,500 XLM, what is left is 100.0000027 XLM. The 400 XLM spent since the refusal case are the tester's own payments, which were added up by hand.

## Open note

The spent amount always ends in …9973 stroops (27 stroops below a round number). The tester attributes this to small decimal amounts typed while testing. It is consistent between the app and the chain.
