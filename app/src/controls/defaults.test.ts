import { describe, expect, it } from "vitest"
import { DEFAULT_LIMITS, DEMO_AMOUNTS } from "./defaults"

describe("demo amounts against the default limits", () => {
	it("scene 1 amount fits the per-payment maximum", () => {
		expect(DEMO_AMOUNTS.below).toBeLessThanOrEqual(DEFAULT_LIMITS.maxPerPayment)
	})

	it("scene 2 amount exceeds the per-payment maximum", () => {
		expect(DEMO_AMOUNTS.above).toBeGreaterThan(DEFAULT_LIMITS.maxPerPayment)
	})

	it("scene 2 stays within the cap even after scene 1 was spent, so the rejection comes from the maximum", () => {
		expect(DEMO_AMOUNTS.below + DEMO_AMOUNTS.above).toBeLessThanOrEqual(
			DEFAULT_LIMITS.cap30d,
		)
	})

	it("scene 3 amount is an ordinary payment, so only the supplier can reject it", () => {
		expect(DEMO_AMOUNTS.unknown).toBeLessThanOrEqual(
			DEFAULT_LIMITS.maxPerPayment,
		)
	})
})

describe("default limits", () => {
	it("uses a 30-day period for the 30-day cap", () => {
		expect(DEFAULT_LIMITS.periodDays).toBe(30)
	})
})
