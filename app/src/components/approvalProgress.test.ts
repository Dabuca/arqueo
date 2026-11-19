import { describe, expect, it } from "vitest"
import { approvalProgress } from "./approvalProgress"

describe("approvalProgress", () => {
	it("is complete with the employee alone when the amount fits the ordinary rule", () => {
		expect(approvalProgress({ needsManager: false, managerSigns: false })).toEqual({
			signed: 1,
			needed: 1,
			state: "complete",
			message: "Employee signature is enough.",
		})
	})

	it("waits for the manager when the amount needs the large rule", () => {
		expect(approvalProgress({ needsManager: true, managerSigns: false })).toEqual({
			signed: 1,
			needed: 2,
			state: "pending",
			message: "Manager signature required.",
		})
	})

	it("is complete with both signatures whenever the manager signs", () => {
		const expected = {
			signed: 2,
			needed: 2,
			state: "complete",
			message: "Employee and manager sign.",
		}
		expect(approvalProgress({ needsManager: true, managerSigns: true })).toEqual(expected)
		expect(approvalProgress({ needsManager: false, managerSigns: true })).toEqual(expected)
	})
})
