# Arqueo — Pitch deck

HackMeridian 2026 · Genesis track · Stellar Composed. For judges watching offline; finalists present live on Wed 28 Oct.

**How to read this file**

- One section per slide: title, on-slide points (max 5), suggested visual, speaker notes, rubric criterion.
- **Rule:** nothing goes on a slide unless the demo shows it. Anything not in the demo is tagged **next**.
- Tags marked `[verify]` depend on work that was not merged into `develop` when this file was written. Before recording, run the *Claim check* at the end and move anything that fails to **next**.
- No market figures are quoted. If one is added later, its source goes in the speaker notes of slide 8.

Target length: 3 minutes of slides, 3 minutes of demo (video), live Q&A for finalists.

---

## Slide 1 — Title

**On the slide**

- **Arqueo**
- Internal controls for stablecoin treasuries on Stellar.
- Payment rules are enforced by the account itself, not by a PDF.
- Built on Stellar · Testnet MVP

**Visual:** logo/wordmark, one line, dark background. Footer: team names and "HackMeridian 2026 · Genesis".

**Speaker notes**

- "Arqueo is the internal-controls layer for a stablecoin treasury. The rules your finance team writes down are enforced by the account that holds the money."
- Say "testnet" once, early. Honesty here earns trust later.

**Rubric:** track fit (20 %). First impression of clarity for Genesis.

---

## Slide 2 — Problem

**On the slide**

- One key can move the whole treasury.
- Approvals happen in chat.
- The auditor receives screenshots.
- Who feels it: small companies, startups, associations and NGOs that hold stablecoins.

**Visual:** three-panel strip — a single key icon, a chat bubble saying "ok, approved 👍", a screenshot thumbnail. No numbers.

**Speaker notes**

- Keep it concrete: "Imagine an association that holds its funds in stablecoins. One person holds the key. Everyone else trusts them."
- The cost is not only fraud. It is also honest mistakes, no separation of duties, and no evidence an auditor can verify.
- Do not claim how many organisations do this. We have not measured it.

**Rubric:** value for the user and problem (20 %); Genesis "clarity of the problem".

---

## Slide 3 — Solution

**On the slide**

- The treasury is a smart account on Stellar.
- The authorization matrix becomes rules of the account.
- A payment that breaks a rule cannot be paid.
- Every payment leaves verifiable evidence.

**Visual:** a table with four roles (admin, employee, manager, auditor) and an arrow to "rules inside the account". Keep it to the role names and what each signs with.

**Speaker notes**

- Roles: admin sets the rules (passkey); employee makes ordinary payments; manager is the second signature on large ones (passkey); auditor is read-only.
- Precision for Q&A: the rejection happens when the transaction is simulated against the account's rules. If someone sent it anyway, the network would reject it too.
- Demo shortcut, say it out loud: the employee key lives in the browser for the demo. In production each person signs with their own passkey on their own device.

**Rubric:** innovation (15 %); value for the user (20 %).

---

## Slide 4 — Demo in four scenes

**On the slide**

- 1 · 200 XLM to an authorized supplier → paid with one signature.
- 2 · 800 XLM, above the per-payment maximum → rejected; accepted when the manager also signs.
- 3 · 100 XLM to an account not on the supplier list → rejected.
- 4 · Auditor sees every attempt, including rejected ones, and downloads a CSV.
- Enforced by the account. Visible on stellar.expert.

**Visual:** four screenshots from the real app, one per scene, with the reason text visible in scenes 2 and 3. A stellar.expert transaction link under scene 1.

**Speaker notes**

- Amounts use the default limits: 500 per payment, 1,000 per 30 days. Scene 2 must be above 500 and within the 30-day cap, so the rejection reads "manager approval required" and not a cap error.
- Rejection texts shown in the app: "Amount exceeds the per-payment limit: manager approval required" and "Supplier not authorized".
- Point at the transaction hash in scene 1 and open it on stellar.expert. That is the answer to "does it use Stellar in a way you can show?".
- Use a fresh account for the recording; each rehearsal spends the 30-day cap.

**Rubric:** execution (15 %); progress (10 %); design and UX (10 %); Genesis "quality of the MVP".

---

## Slide 5 — What is new: the rules are configurable and audited

**On the slide**

- The admin sets the per-payment maximum, the 30-day cap and the suppliers. `[verify: settings screen, R17]`
- Only the admin can change them, with a passkey. Employee and manager cannot. `[verify]`
- Every change leaves a trail for the auditor: what changed, old and new value. `[verify]`
- **Next:** transaction hashes in that trail; a 30-day cap that keeps what is already spent and cannot drop below it.
- "Four eyes on payments, and on the rules too."

**Visual:** Settings screen next to the auditor's change log, if both are in the demo. If only the log code exists, show the log as a table mock and label it "next".

**Speaker notes**

- Why it matters: if the admin could silently raise the limit, the control would mean nothing. So rule changes are authorized by the admin rule and recorded.
- Do not claim the 30-day cap preserves spending today. OpenZeppelin's `spending_limit` restarts from zero when reinstalled, so team A and B still have to decide whether our own policy tracks it. Until that is decided and demoed, it is **next**.
- Do not claim hashes in the change trail until R17 records them.
- What already exists in code and tests: limit validation, supplier management and the change log in `app/src/controls/` (R1).
- Design principle to mention only if asked: changes remove the old rule and add a new one (never edit in place), and the account stays closed while that happens.

**Rubric:** innovation (15 %); user value (20 %).

---

## Slide 6 — How Stellar is composed

**On the slide**

- OpenZeppelin smart accounts: context rules, threshold and spending-limit policies.
- `smart-account-kit`: passkeys and multi-signer authorization.
- Scaffold Stellar: app and contract clients.
- Our own `control-policy` in Soroban: supplier list and per-payment maximum.
- Why Stellar: low fees, native stablecoins, smart accounts with passkeys.

**Visual:** a stack of four blocks (app → kit → OpenZeppelin account + rules → our policy and the token), logos only where licence permits. Mark XLM as "token for the MVP".

**Speaker notes**

- This is the "Stellar Composed" slide: we did not write a new wallet. We composed existing pieces and wrote the one piece that was missing, `control-policy`.
- Honest scope: the MVP moves native XLM through its Stellar Asset Contract. USDC is **next**.
- On "low fees" and "native stablecoins", describe them qualitatively. Do not quote a fee value unless it is taken from the Stellar docs and noted here.
- Versions are pinned: `smart-account-kit` 0.6.0.
- Warning to state if asked: the kit's default deployer uses a key derived from a public seed. It is safe only on testnet.

**Rubric:** track fit (20 %); technical execution (15 %); Genesis "Stellar integration".

---

## Slide 7 — Architecture

**On the slide**

- App (React) → `controls` and `stellar.ts` → smart account → policies → token.
- `stellar.ts` is the only door to the network.
- `controls` holds the matrix as pure code, with no network.
- The account decides. The app only suggests.

**Visual:** use the R16 architecture diagram (not in `develop` when this was written; a branch `d/R16-architecture-diagram` exists). If it is not merged, draw the five-box flow above.

**Speaker notes**

- Flow of a payment: the app picks the rule from who signs (`employee` → `ordinary`; `employee` + `manager` → `large`), builds the token transfer, the smart account checks the rule, the threshold and the `control-policy`, and only then does the token move.
- The warning "Needs manager approval" in the UI is only a hint. The app deliberately lets you try the payment with the employee alone — scene 2 depends on that.
- Rules are looked up by name, not by ID.

**Rubric:** technical execution (15 %); innovation (15 %).

---

## Slide 8 — Market and alternatives

**On the slide**

- Who pays: organisations that hold stablecoins and answer to someone — a board, a donor, an auditor.
- Today: classic multisig, Safe on EVM, or a bank with dual approval.
- Arqueo's difference: rules per payment, per supplier and per period, enforced by the account, with an auditable trail.
- Possible model: subscription per treasury. **Next**, not built.

**Visual:** simple 4-row comparison table. Columns: *who signs*, *rule per payment / supplier / period*, *evidence for the auditor*. Fill with short phrases, no scores.

**Speaker notes**

- Be careful with competitors. Say what they do well: multisig and Safe already give shared control; banks have dual approval. The gap we address is expressing a finance policy as account rules and giving the auditor evidence that needs no screenshots.
- No market-size figure is used on purpose. If we add one, the source and date go here before it goes on a slide.
- Business model is a hypothesis. Ask judges what they would pay for, don't present it as validated.

**Rubric:** market potential and ecosystem (10 %); user value (20 %).

---

## Slide 9 — Built this weekend, and next

**On the slide**

- Built at the event (see the commit history): controls matrix as tested code; `control-policy` contract with tests; company smart account on testnet; payment, auditor and CSV flows. `[verify against merged PRs]`
- Next: USDC; supplier payout through an anchor; 2-of-3 recovery rule; manager passkey on mobile.
- Next: a 30-day cap that keeps what is spent; hashes in the change trail.
- Next: apply for Stellar Community Fund.

**Visual:** two columns, "Built (Sat–Sun)" and "Next". Optionally a commit graph screenshot.

**Speaker notes**

- Everything was written during the event: the repo history from Sunday 25 Oct shows it. At the time of writing, `develop` had about 40 commits from the whole team.
- Only list as built what is merged and demoed. Re-check the list right before recording.
- Stellar Community Fund is an intention, not an application in progress.

**Rubric:** progress in the hackathon (10 %); Genesis "potential to keep developing".

---

## Slide 10 — Team and close

**On the slide**

- Carlos — contracts (Rust/Soroban).
- David B — account and payments.
- David P — app and audit view.
- Jesús — product and delivery.
- **Arqueo: the rules live in the account.** Repo, video and live testnet app: links.

**Visual:** four names with roles, repo and app URLs, and a QR to the repo. "Testnet only" in the footer.

**Speaker notes**

- Close with the one-line promise: "A payment that breaks the rules cannot be paid, and the auditor can prove it."
- Say the call to action: we want feedback from treasury and finance people and a path to mainnet through audits.
- Check names and spellings with each person before publishing.

**Rubric:** progress (10 %); all criteria in the closing impression.

---

## Claim check (before recording)

Move any row that fails to **next** on its slide.

| Claim | Slide | Where it comes from | Status when written |
|---|---|---|---|
| Scenes 1–3 run from the app on testnet | 4 | R4, R6, R7, R8 | Not merged into `develop` yet |
| Auditor view incl. rejected attempts, CSV | 4 | R9, R11, R13 | CSV export merged; view/signers/rule on branches |
| Settings screen for limits and suppliers | 5 | R17 | Branch `b-c/R17-settings-screen`, not merged |
| Change trail with old/new value | 5 | `changeLog.ts` (R1) | Code and tests merged; needs the screen |
| Change trail with tx hashes | 5 | R17 | **next** |
| Spent-aware 30-day cap | 5 | decision pending (A, B) | **next** |
| `control-policy` with tests | 6 | R5 | Merged |
| Company smart account on testnet | 9 | R3 | Merged |
| Architecture diagram | 7 | R16 | Branch `d/R16-architecture-diagram`, not merged |
| USDC, anchors, recovery, mobile passkey, SCF | 9 | R18–R22 | **next** |
