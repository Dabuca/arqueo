# R22 Simulated Supplier Cash-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/cashout` page that walks a supplier through a simulated SEP-24 withdrawal of test USDC to a bank account, in four steps, with no network calls.

**Architecture:** A pure state module (`app/src/pages/cashout.ts`) holds the demo constants, quote, validation, IBAN masking and the step machine; it is unit-tested with vitest. `CashOut.tsx` only renders that state with the shared `ui.module.css` classes. A route and a header entry expose it.

**Tech Stack:** React 19 + Vite + TypeScript, react-router-dom, vitest, CSS modules, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-10-26-r22-cashout-demo-design.md`

## Global Constraints

- Simulation only: no import of `../lib/stellar`, no `fetch`, no anchor or Stellar endpoint.
- All UI copy, code, comments and commits in English (AGENTS.md §1).
- Notice text, verbatim: "Simulated anchor flow — no funds move. Roadmap: SEP-24 withdrawal through a Stellar anchor."
- Anchor name, verbatim: "Demo Anchor (testnet)".
- Reference prefix `SIMULATED-`; no stellar.expert link for it.
- Commit format `feat(R22): …` / `test(R22): …` / `docs(R22): …`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before review: `npm test --workspace app` and `npm run build --workspace app` pass. Run from the repo root `C:\Users\carlo\arqueo`.
- No push or PR without the person's confirmation.

## Review Focus

- Empty or non-numeric amount field (`NaN`, `Infinity`) → "Continue" disabled with a message, no crash. Test in Task 1.
- IBAN typed in lowercase with spaces → accepted; masked output uppercase. Test in Task 1.
- Amount exactly at or below the fee (e.g. 1 USDC) → invalid, never a zero or negative net. Test in Task 1.
- Clicking "Approve transfer" twice → the first reference is kept. Test in Task 1.
- "Start again" after completion → defaults back, reference and date cleared. Test in Task 1.

---

### Task 1: Cash-out state module

**Files:**
- Create: `app/src/pages/cashout.ts`
- Test: `app/src/pages/cashout.test.ts`

**Interfaces:**
- Produces (exported from `cashout.ts`):
  - `ANCHOR_NAME = "Demo Anchor (testnet)"`, `FEE_FIXED_USDC = 1`, `FEE_RATE = 0.005`, `USDC_TO_EUR = 0.92`, `SAMPLE_HOLDER = "Lisboa Supplies Lda"`, `SAMPLE_IBAN = "PT50 0002 0123 1234 5678 9015 4"`, `DEFAULT_AMOUNT = 200`
  - `type Quote = { ok: true; amount: number; fee: number; net: number; eur: number } | { ok: false; error: string }`
  - `quote(amount: number): Quote` — fee = `FEE_FIXED_USDC + amount * FEE_RATE`, net = amount − fee, eur = net × `USDC_TO_EUR`; each rounded to cents (`Math.round(x * 100) / 100`). Not finite, or `amount <= fee` → `{ ok: false, error: "Enter an amount greater than the anchor fee" }`.
  - `type BankDetails = { holder: string; iban: string; kyc: boolean }`
  - `validateBankDetails(b: BankDetails): string[]` — messages, in this order: `"Enter the account holder"` (holder blank after trim), `"Enter a valid IBAN"` (spaces removed, uppercased, not `/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/`), `"The anchor must verify KYC before the withdrawal"` (kyc false).
  - `maskIban(iban: string): string` — spaces removed, uppercased → `` `${first2} •••• ${last4}` ``.
  - `type Step = "amount" | "bank" | "send" | "done"`
  - `type CashOutState = { step: Step; amount: number; bank: BankDetails; reference?: string; completedAt?: string }`
  - `type CashOutEvent = { type: "setAmount"; amount: number } | { type: "setBank"; bank: BankDetails } | { type: "continue" } | { type: "approve"; reference: string } | { type: "complete"; at: string } | { type: "restart" }`
  - `initialState(): CashOutState` — step `"amount"`, `DEFAULT_AMOUNT`, bank `{ holder: SAMPLE_HOLDER, iban: SAMPLE_IBAN, kyc: false }`, no reference/date.
  - `next(state: CashOutState, event: CashOutEvent): CashOutState` — rules below; any other event/step combination returns `state` unchanged (same object).
    - `setAmount` only in `amount`; `setBank` only in `bank`.
    - `continue`: `amount`→`bank` if `quote(amount).ok`; `bank`→`send` if no bank errors.
    - `approve`: only in `send` with no `reference` yet; sets `reference`.
    - `complete`: only in `send` with a `reference`; → `done`, sets `completedAt`.
    - `restart`: from any step → `initialState()`.
  - `newReference(): string` — `"SIMULATED-"` + 8 uppercase hex chars from `crypto.randomUUID()`.

- [ ] **Step 1: Write the failing tests** in `cashout.test.ts` (`describe`/`it`/`expect` from vitest, tab indentation like `paymentOutcome.test.ts`):

```ts
it("quotes 200 USDC with a 1 USDC + 0.5% fee", () => {
	expect(quote(200)).toEqual({ ok: true, amount: 200, fee: 2, net: 198, eur: 182.16 })
})
it("rounds the quote to cents", () => {
	expect(quote(10.01)).toEqual({ ok: true, amount: 10.01, fee: 1.05, net: 8.96, eur: 8.24 })
})
it.each([0, -5, 1, Number.NaN, Number.POSITIVE_INFINITY])("refuses %s", (a) => {
	expect(quote(a)).toEqual({ ok: false, error: "Enter an amount greater than the anchor fee" })
})
it("accepts the sample details once KYC is checked", () => {
	expect(validateBankDetails({ holder: SAMPLE_HOLDER, iban: SAMPLE_IBAN, kyc: true })).toEqual([])
})
it("accepts a lowercase IBAN with spaces", () => {
	expect(validateBankDetails({ holder: "A", iban: "pt50 0002 0123 1234 5678 9015 4", kyc: true })).toEqual([])
})
it("lists every problem in order", () => {
	expect(validateBankDetails({ holder: "  ", iban: "PT50 12", kyc: false })).toEqual([
		"Enter the account holder", "Enter a valid IBAN", "The anchor must verify KYC before the withdrawal",
	])
})
it("masks the IBAN", () => {
	expect(maskIban("pt50 0002 0123 1234 5678 9015 4")).toBe("PT •••• 0154")
})
```

Plus a `describe("next")` block with these cases (each asserts the resulting `step`, or `toBe(state)` for no-ops):
- `continue` from the initial state → `"bank"`; with `setAmount` 0 first → stays `"amount"`.
- `continue` in `bank` with `kyc: false` → stays `"bank"`; after `setBank` with `kyc: true` → `"send"`.
- `approve` in `amount` → `toBe(state)` (no skipping); `continue` in `send` → `toBe(state)`.
- `approve` "SIMULATED-AAAA0000" then `approve` "SIMULATED-BBBB1111" → reference stays `"SIMULATED-AAAA0000"`.
- `complete` without reference → `toBe(state)`; after approve, `complete` with `"2026-10-26T10:00:00.000Z"` → `step: "done"`, `completedAt` set.
- `restart` from `done` → `toEqual(initialState())` (no `reference`, no `completedAt`).
- `newReference()` matches `/^SIMULATED-[0-9A-F]{8}$/`.

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run src/pages/cashout.test.ts` from `app/`
Expected: FAIL, cannot resolve `./cashout`.

- [ ] **Step 3: Implement `cashout.ts`** with the exports above. One-line file comment saying it is the simulated SEP-24 off-ramp for R22 and never touches the network.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run src/pages/cashout.test.ts` from `app/`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/cashout.ts app/src/pages/cashout.test.ts
git commit -m "feat(R22): pure state for the simulated supplier cash-out"
```

---

### Task 2: Cash-out page, route and header entry

**Files:**
- Create: `app/src/pages/CashOut.tsx`, `app/src/pages/CashOut.module.css`
- Modify: `app/src/App.tsx` (import + `<Route path="/cashout" element={<CashOut />} />` after `/settings`)
- Modify: `app/src/components/SiteHeader.tsx` (`NAV`: add `{ to: "/cashout", label: "Supplier" }` after Settings)

**Interfaces:**
- Consumes: everything Task 1 exports; `ui` classes from `../styles/ui.module.css` (`pageHead`, `card`, `pill`, `alert`, `button`, `primary`, `label`, `mono`, `small`, `sectionTitle`).

- [ ] **Step 1: Build the page.** `export default function CashOut()` with `useState(initialState)` and a `dispatch = (e) => setState((s) => next(s, e))`.
  - Header (`ui.pageHead`): `<h1>Cash out to bank</h1>`, `ui.pill` "Simulated", one line: "How a paid supplier moves test USDC to their bank through {ANCHOR_NAME}."
  - Notice, always visible, `ui.alert` with `role="note"`, the verbatim notice text.
  - Progress list (`<ol>`, `aria-current="step"` on the active item): Amount · Bank details · Send to anchor · Bank transfer sent.
  - One `ui.card` per current step, each ending with a `ui.small` "What a real anchor does" note using the spec's table wording:
    - **amount:** number input (label "Amount (USDC)", `min` 0, `step` 0.01, value from state, `onChange` → `setAmount` with `Number(e.target.value)`); quote rows Fee / You receive (USDC) / Paid to your bank (EUR, "at 0.92 EUR per USDC, demo rate"); error text from `quote` when not ok; "Continue" disabled when not ok.
    - **bank:** inputs "Account holder", "IBAN" and checkbox "KYC verified by the anchor" → `setBank`; list the `validateBankDetails` messages under the form in a `ul` with `role="alert"` whenever there are any; "Continue" disabled while errors exist.
    - **send:** summary of net USDC to {ANCHOR_NAME}; button "Approve transfer" → `approve` with `newReference()`, hidden once a reference exists; then "USDC sent to the anchor" with the reference in `ui.mono` and a "Continue" → `complete` with `new Date().toISOString()`.
    - **done:** "Bank transfer sent" with amount, fee, net USDC, EUR, `maskIban(bank.iban)`, reference, date (`toLocaleString()`), button "Start again" → `restart`.
  - No `Link`/`a` to stellar.expert anywhere on the page.
- [ ] **Step 2: Styles** in `CashOut.module.css`: `.page` like `Auditor.module.css` (`display: grid; gap: 16px; max-width: 720px; margin: 0 auto`), a horizontal `.steps` list that wraps on narrow screens, `.rows` as a two-column definition grid. Use tokens from `styles/tokens.css`, no hard-coded colours.
- [ ] **Step 3: Wire route and nav** as listed under Files.
- [ ] **Step 4: Verify build and tests**

Run: `npm run build --workspace app` then `npm test --workspace app` from the repo root.
Expected: both succeed; no new TypeScript errors.

- [ ] **Step 5: Verify in the browser.** Start the app (`npm run start --workspace app`, through the preview tool), open `/cashout`: the "Supplier" link is active; walk the four steps with defaults (tick KYC); check that an amount of 0 disables "Continue", that a bad IBAN shows "Enter a valid IBAN", that "Start again" returns to 200 USDC; check at 375 px width that nothing scrolls horizontally; no console errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/pages/CashOut.tsx app/src/pages/CashOut.module.css app/src/App.tsx app/src/components/SiteHeader.tsx
git commit -m "feat(R22): supplier cash-out page with a simulated anchor flow"
```

---

### Task 3: Requirement status and README

**Files:**
- Modify: `AGENTS.md` (line of R22 in §7 P2)
- Modify: `README.md` ("Not included yet" bullet in "Current demo evidence and limits")

- [ ] **Step 1: AGENTS.md.** Replace `- [ ] **R22** Cobro del proveedor en su banco a través de un anchor.` with:
  `- [x] **R22** Cobro del proveedor en su banco a través de un anchor. **Demo simulada** en `/cashout` (entrada «Supplier»): recorre los pasos de un retiro SEP-24 con un anchor ficticio y no mueve fondos ni llama a la red. Un retiro real exige un token que acepte el anchor (el USDC de Arqueo no lo acepta ninguno) y proveedores con clave para el login SEP-10. Diseño: `docs/superpowers/specs/2026-10-26-r22-cashout-demo-design.md`.`
- [ ] **Step 2: README.md.** Add a bullet before "Not included yet":
  `- **Supplier cash-out (simulated):** `/cashout` shows how a paid supplier would withdraw test USDC to a bank account through a Stellar anchor (SEP-24). No funds move and no anchor is contacted; a real withdrawal needs an asset the anchor accepts and suppliers who hold their own keys.`
- [ ] **Step 3: Final check**

Run: `npm test --workspace app` and `npm run build --workspace app`.
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs(R22): mark the simulated supplier cash-out and describe its limits"
```

- [ ] **Step 5: Draft the PR text** (do not open it): R22 · what changed · how to test (`/cashout`, the four steps) · what is left (real SEP-24 needs an accepted asset and keyed suppliers) · decisions (simulated; touches C's `pages/`/`components/` and D's `AGENTS.md`/`README.md`, review by C requested per §10.2).
