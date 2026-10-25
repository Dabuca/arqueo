# R6 evidence: scene 3 is rejected by the account rules

Scene 3 of the MVP: a payment from the `ordinary` rule to an account that exists on testnet but is not on the supplier list must be refused by the smart account, not by the app.

## Test run

- Date: 2026-10-26 (testnet).
- Rule: `ordinary` (signer: employee). `control-policy` is installed on it (R6) with the supplier allowlist from `PUBLIC_SUPPLIERS`.
- Recipient: `GCOAUKV2W7NBFZP63CTMQEV66BPGFGDXF2EYKCM7I7BQHYHJ4JBAC6E2`, a fresh account funded by Friendbot and not on the allowlist.
- Amount: 100 XLM.
- Result in the app: **"Refused by the account rules: Supplier not authorized"** (error code 1, `SupplierNotAllowed`).
- On-chain check afterwards: the recipient still holds 10,000 XLM and its only operation is the Friendbot `create_account`. No payment reached it.

## Open note

On 2026-10-25 at 17:36 UTC a 100 XLM transfer from a contract succeeded to `GBHX3Z3BW27ORH4VFKVP36FGRJGAEADYDWCIW3HGXQQGPWC6LEUCYIGK`, an unknown account. Its timing is before the `control-policy` install commit (`e1b3c71`, 17:45 UTC), so it is most likely a test made before the policy existed. This has not been confirmed with the transaction history of the rule itself.
