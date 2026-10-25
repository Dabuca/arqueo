import { describe, expect, it } from "vitest"
import { outcomeFromResult } from "./paymentOutcome"

describe("outcomeFromResult", () => {
	it("keeps the hash of an accepted payment", () => {
		expect(outcomeFromResult({ ok: true, hash: "abc" })).toEqual({
			kind: "accepted",
			hash: "abc",
		})
	})

	it("keeps the reason and the original error details of a rejection", () => {
		expect(
			outcomeFromResult({
				ok: false,
				reason: "Rejected by the account rules",
				details: "HostError: Error(Contract, #3221)",
			}),
		).toEqual({
			kind: "rejected",
			reason: "Rejected by the account rules",
			details: "HostError: Error(Contract, #3221)",
		})
	})

	it("has no details key when the rejection maps to a known message", () => {
		const outcome = outcomeFromResult({
			ok: false,
			reason: "Supplier not authorized",
		})
		expect(outcome).toEqual({
			kind: "rejected",
			reason: "Supplier not authorized",
		})
		expect(outcome).not.toHaveProperty("details")
	})
})
