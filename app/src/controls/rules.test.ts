import { describe, expect, it } from "vitest"
import {
	capShortfall,
	remainingCap,
	requiredRule,
	ruleForSigners,
	signersFor,
} from "./rules"
import { type Limits, type Role } from "./types"

const LIMITS: Limits = { maxPerPayment: 500, cap30d: 1000, periodDays: 30 }

describe("signersFor", () => {
	it("ordinary is signed by the employee alone", () => {
		expect(signersFor("ordinary")).toEqual(["employee"])
	})

	it("large is signed by the employee and the manager", () => {
		expect(signersFor("large")).toEqual(["employee", "manager"])
	})

	it("returns a new array each time, so callers cannot corrupt later calls", () => {
		signersFor("large").push("admin")
		expect(signersFor("large")).toEqual(["employee", "manager"])
	})
})

describe("ruleForSigners", () => {
	it.each<[string, Role[], "ordinary" | "large" | null]>([
		["the employee alone", ["employee"], "ordinary"],
		["employee then manager", ["employee", "manager"], "large"],
		["manager then employee", ["manager", "employee"], "large"],
		["nobody", [], null],
		["the manager alone", ["manager"], null],
		["the admin alone", ["admin"], null],
		["the auditor alone", ["auditor"], null],
		["a repeated employee", ["employee", "employee"], null],
		["a repeated manager", ["employee", "manager", "manager"], null],
		["employee, manager, employee", ["employee", "manager", "employee"], null],
		["employee and auditor", ["employee", "auditor"], null],
		["employee and admin", ["employee", "admin"], null],
		["employee, manager and auditor", ["employee", "manager", "auditor"], null],
	])("maps %s", (_label, signers, rule) => {
		expect(ruleForSigners(signers)).toBe(rule)
	})
})

describe("requiredRule", () => {
	it.each<[string, number, number, "ordinary" | "large"]>([
		["a small payment with nothing spent", 200, 0, "ordinary"],
		["an amount equal to the per-payment maximum", 500, 0, "ordinary"],
		["one stroop above the per-payment maximum", 500.0000001, 0, "large"],
		["an amount well above the maximum", 800, 0, "large"],
		["an amount above the maximum after some spending", 800, 200, "large"],
		["a payment that exactly uses up the cap", 300, 700, "ordinary"],
		[
			"a payment that fits the maximum but overshoots the cap",
			400,
			700,
			"large",
		],
		["a payment when the cap is already spent", 1, 1000, "large"],
	])("%s", (_label, amount, spent, rule) => {
		expect(requiredRule(amount, LIMITS, spent)).toBe(rule)
	})

	it("uses the limits it is given, not the defaults", () => {
		const tight: Limits = { maxPerPayment: 50, cap30d: 100, periodDays: 30 }
		expect(requiredRule(60, tight, 0)).toBe("large")
		expect(requiredRule(50, tight, 0)).toBe("ordinary")
	})

	it("is not fooled by float noise at the exact cap", () => {
		// 0.1 + 0.2 is 0.30000000000000004 in floats
		const small: Limits = { maxPerPayment: 1, cap30d: 0.3, periodDays: 30 }
		expect(requiredRule(0.2, small, 0.1)).toBe("ordinary")
	})

	it("never gives the ordinary hint to an amount that is not a number", () => {
		expect(requiredRule(NaN, LIMITS, 0)).toBe("large")
	})
})

describe("remainingCap", () => {
	it("is the cap when nothing was spent", () => {
		expect(remainingCap(LIMITS, 0)).toBe(1000)
	})

	it("is what is left after spending", () => {
		expect(remainingCap(LIMITS, 600)).toBe(400)
	})

	it("is zero at the cap and never negative above it", () => {
		expect(remainingCap(LIMITS, 1000)).toBe(0)
		expect(remainingCap(LIMITS, 1200)).toBe(0)
	})

	it("is not thrown off by float noise", () => {
		expect(remainingCap({ ...LIMITS, cap30d: 0.3 }, 0.1 + 0.2)).toBe(0)
		expect(remainingCap({ ...LIMITS, cap30d: 1 }, 0.1 + 0.2)).toBe(0.7)
	})
})

describe("capShortfall", () => {
	it("is zero when the payment fits in what is left", () => {
		expect(capShortfall(400, LIMITS, 600)).toBe(0)
		expect(capShortfall(1000, LIMITS, 0)).toBe(0)
	})

	it("is how far the payment passes what is left", () => {
		expect(capShortfall(450, LIMITS, 600)).toBe(50)
		expect(capShortfall(1, LIMITS, 1000)).toBe(1)
	})

	it("counts a cap that is already used up as the whole amount", () => {
		expect(capShortfall(10, LIMITS, 5000)).toBe(10)
	})

	it("keeps decimals exact to the stroop", () => {
		expect(capShortfall(0.0000002, LIMITS, 999.9999999)).toBe(0.0000001)
	})
})
