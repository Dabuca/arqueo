import { describe, expect, it } from "vitest"
import { describeApproval } from "./approval"

describe("describeApproval", () => {
	it("labels an ordinary payment as 1 of 1", () => {
		expect(
			describeApproval({
				rule: "ordinary",
				signers: ["employee"],
				status: "ok",
			}),
		).toEqual({
			ruleLabel: "Ordinary · 1 of 1",
			required: ["employee"],
			missing: [],
		})
	})

	it("labels a large payment as 2 of 2", () => {
		const approval = describeApproval({
			rule: "large",
			signers: ["employee", "manager"],
			status: "ok",
		})
		expect(approval.ruleLabel).toBe("Large · 2 of 2")
		expect(approval.required).toEqual(["employee", "manager"])
		expect(approval.missing).toEqual([])
	})

	it("reports the manager as missing when a limit refused a lone employee", () => {
		for (const reason of [
			"Amount exceeds the per-payment limit: manager approval required",
			"Amount exceeds what is left of the 30-day cap: manager approval required",
		]) {
			expect(
				describeApproval({
					rule: "ordinary",
					signers: ["employee"],
					status: "rejected",
					reason,
				}).missing,
			).toEqual(["manager"])
		}
	})

	it("reports nothing missing for refusals a second signature would not fix", () => {
		expect(
			describeApproval({
				rule: "ordinary",
				signers: ["employee"],
				status: "rejected",
				reason: "Supplier not authorized",
			}).missing,
		).toEqual([])
	})
})
