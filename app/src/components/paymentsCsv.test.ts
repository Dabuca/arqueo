import { describe, expect, it } from "vitest"
import { buildPaymentsCsv } from "./paymentsCsv"

describe("buildPaymentsCsv", () => {
	it("adds the required and missing signers next to the rule", () => {
		const csv = buildPaymentsCsv([
			{
				asset: "USDC",
				to: "GABC",
				amount: 800,
				concept: "Invoice",
				signers: ["employee"],
				rule: "ordinary",
				status: "rejected",
				reason:
					"Amount exceeds the per-payment limit: manager approval required",
				at: "2026-10-26T09:00:00.000Z",
			},
			{
				asset: "XLM",
				to: "GABC",
				amount: 800,
				concept: "Invoice",
				signers: ["employee", "manager"],
				rule: "large",
				status: "ok",
				hash: "abc",
				at: "2026-10-26T09:05:00.000Z",
			},
		])
		const [header, refused, settled] = csv.split("\r\n")
		expect(header).toContain(
			'"rule","required_signers","missing_signers","status"',
		)
		expect(refused).toContain('"ordinary","employee","manager","rejected"')
		expect(settled).toContain('"large","employee; manager","","ok"')
	})
})
