// Simulated SEP-24 off-ramp for R22: pure state and maths, it never touches the network.

export const ANCHOR_NAME = "Demo Anchor (testnet)"
export const FEE_FIXED_USDC = 1
export const FEE_RATE = 0.005
export const USDC_TO_EUR = 0.92
export const SAMPLE_HOLDER = "Lisboa Supplies Lda"
export const SAMPLE_IBAN = "PT50 0002 0123 1234 5678 9015 4"
export const DEFAULT_AMOUNT = 200

const cents = (x: number) => Math.round(x * 100) / 100

export type Quote =
	| { ok: true; amount: number; fee: number; net: number; eur: number }
	| { ok: false; error: string }

/** Fee, net USDC and EUR payout for a withdrawal, rounded to cents. */
export function quote(amount: number): Quote {
	const fee = FEE_FIXED_USDC + amount * FEE_RATE
	if (!Number.isFinite(amount) || amount <= fee) {
		return { ok: false, error: "Enter an amount greater than the anchor fee" }
	}
	const net = cents(amount - fee)
	if (net <= 0) {
		return { ok: false, error: "Enter an amount greater than the anchor fee" }
	}
	return { ok: true, amount, fee: cents(fee), net, eur: cents(net * USDC_TO_EUR) }
}

export type BankDetails = { holder: string; iban: string; kyc: boolean }

const normalizeIban = (iban: string) => iban.replace(/\s/g, "").toUpperCase()

/** Every problem with the bank details, in form order. Empty when valid. */
export function validateBankDetails(b: BankDetails): string[] {
	const errors: string[] = []
	if (b.holder.trim() === "") errors.push("Enter the account holder")
	if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(normalizeIban(b.iban))) errors.push("Enter a valid IBAN")
	if (!b.kyc) errors.push("The anchor must verify KYC before the withdrawal")
	return errors
}

export function maskIban(iban: string): string {
	const clean = normalizeIban(iban)
	return `${clean.slice(0, 2)} •••• ${clean.slice(-4)}`
}

export type Step = "amount" | "bank" | "send" | "done"

export type CashOutState = {
	step: Step
	amount: number
	bank: BankDetails
	reference?: string
	completedAt?: string
}

export type CashOutEvent =
	| { type: "setAmount"; amount: number }
	| { type: "setBank"; bank: BankDetails }
	| { type: "continue" }
	| { type: "approve"; reference: string }
	| { type: "complete"; at: string }
	| { type: "restart" }

export function initialState(): CashOutState {
	return {
		step: "amount",
		amount: DEFAULT_AMOUNT,
		bank: { holder: SAMPLE_HOLDER, iban: SAMPLE_IBAN, kyc: false },
	}
}

/** Transition function; events that do not apply to the current step return `state` itself. */
export function next(state: CashOutState, event: CashOutEvent): CashOutState {
	switch (event.type) {
		case "setAmount":
			return state.step === "amount" ? { ...state, amount: event.amount } : state
		case "setBank":
			return state.step === "bank" ? { ...state, bank: event.bank } : state
		case "continue":
			if (state.step === "amount" && quote(state.amount).ok) return { ...state, step: "bank" }
			if (state.step === "bank" && validateBankDetails(state.bank).length === 0) {
				return { ...state, step: "send" }
			}
			return state
		case "approve":
			return state.step === "send" && !state.reference
				? { ...state, reference: event.reference }
				: state
		case "complete":
			return state.step === "send" && state.reference
				? { ...state, step: "done", completedAt: event.at }
				: state
		case "restart":
			return initialState()
	}
}

/** A fake transaction reference, clearly marked as simulated. */
export function newReference(): string {
	return `SIMULATED-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`
}
