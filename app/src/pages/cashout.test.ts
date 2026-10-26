import { describe, expect, it } from "vitest"
import {
	SAMPLE_HOLDER,
	SAMPLE_IBAN,
	initialState,
	maskIban,
	newReference,
	next,
	quote,
	validateBankDetails,
} from "./cashout"

describe("quote", () => {
	it("quotes 200 USDC with a 1 USDC + 0.5% fee", () => {
		expect(quote(200)).toEqual({ ok: true, amount: 200, fee: 2, net: 198, eur: 182.16 })
	})

	it("rounds the quote to cents", () => {
		expect(quote(10.01)).toEqual({ ok: true, amount: 10.01, fee: 1.05, net: 8.96, eur: 8.24 })
	})

	it.each([0, -5, 1, 1.01, Number.NaN, Number.POSITIVE_INFINITY])("refuses %s", (a) => {
		expect(quote(a)).toEqual({ ok: false, error: "Enter an amount greater than the anchor fee" })
	})
})

describe("validateBankDetails", () => {
	it("accepts the sample details once KYC is checked", () => {
		expect(validateBankDetails({ holder: SAMPLE_HOLDER, iban: SAMPLE_IBAN, kyc: true })).toEqual([])
	})

	it("accepts a lowercase IBAN with spaces", () => {
		expect(
			validateBankDetails({ holder: "A", iban: "pt50 0002 0123 1234 5678 9015 4", kyc: true }),
		).toEqual([])
	})

	it("lists every problem in order", () => {
		expect(validateBankDetails({ holder: "  ", iban: "PT50 12", kyc: false })).toEqual([
			"Enter the account holder",
			"Enter a valid IBAN",
			"The anchor must verify KYC before the withdrawal",
		])
	})
})

describe("maskIban", () => {
	it("masks the IBAN", () => {
		expect(maskIban("pt50 0002 0123 1234 5678 9015 4")).toBe("PT •••• 0154")
	})
})

describe("next", () => {
	const kycBank = { holder: SAMPLE_HOLDER, iban: SAMPLE_IBAN, kyc: true }

	it("moves from amount to bank with a valid amount", () => {
		expect(next(initialState(), { type: "continue" }).step).toBe("bank")
	})

	it("stays in amount when the amount is invalid", () => {
		const s = next(initialState(), { type: "setAmount", amount: 0 })
		expect(next(s, { type: "continue" }).step).toBe("amount")
	})

	it("stays in bank until KYC is checked, then moves to send", () => {
		const bank = next(initialState(), { type: "continue" })
		expect(next(bank, { type: "continue" }).step).toBe("bank")
		const ready = next(bank, { type: "setBank", bank: kycBank })
		expect(next(ready, { type: "continue" }).step).toBe("send")
	})

	it("ignores events that would skip a step", () => {
		const state = initialState()
		expect(next(state, { type: "approve", reference: "SIMULATED-AAAA0000" })).toBe(state)
		const send = toSend()
		expect(next(send, { type: "continue" })).toBe(send)
	})

	it("keeps the first approval reference", () => {
		const s = next(toSend(), { type: "approve", reference: "SIMULATED-AAAA0000" })
		const again = next(s, { type: "approve", reference: "SIMULATED-BBBB1111" })
		expect(again.reference).toBe("SIMULATED-AAAA0000")
	})

	it("completes only after approval", () => {
		const send = toSend()
		expect(next(send, { type: "complete", at: "2026-10-26T10:00:00.000Z" })).toBe(send)
		const approved = next(send, { type: "approve", reference: "SIMULATED-AAAA0000" })
		const done = next(approved, { type: "complete", at: "2026-10-26T10:00:00.000Z" })
		expect(done.step).toBe("done")
		expect(done.completedAt).toBe("2026-10-26T10:00:00.000Z")
	})

	it("restarts from done to the initial state", () => {
		const approved = next(toSend(), { type: "approve", reference: "SIMULATED-AAAA0000" })
		const done = next(approved, { type: "complete", at: "2026-10-26T10:00:00.000Z" })
		const restarted = next(done, { type: "restart" })
		expect(restarted).toEqual(initialState())
		expect(restarted).not.toHaveProperty("reference")
		expect(restarted).not.toHaveProperty("completedAt")
	})

	function toSend() {
		let s = next(initialState(), { type: "continue" })
		s = next(s, { type: "setBank", bank: kycBank })
		return next(s, { type: "continue" })
	}
})

describe("newReference", () => {
	it("builds a simulated reference", () => {
		expect(newReference()).toMatch(/^SIMULATED-[0-9A-F]{8}$/)
	})
})
