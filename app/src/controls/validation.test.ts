import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG, DEFAULT_LIMITS } from "./defaults"
import { type ControlsConfig, type Limits } from "./types"
import {
	isSupplier,
	looksLikeStellarAddress,
	validateLimitsChange,
} from "./validation"

// 56 characters: "G" + 55 base32 characters
const ADDRESS_A = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI"
// Same as A with the last character changed
const ADDRESS_B = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADA"

describe("looksLikeStellarAddress", () => {
	it("accepts a G address", () => {
		expect(looksLikeStellarAddress(ADDRESS_A)).toBe(true)
	})

	it.each<[string, string]>([
		["a secret key (S...)", "S" + ADDRESS_A.slice(1)],
		["a contract address (C...)", "C" + ADDRESS_A.slice(1)],
		["a muxed address (M...)", "M" + "A".repeat(68)],
		["lowercase", ADDRESS_A.toLowerCase()],
		["one character too short", ADDRESS_A.slice(0, 55)],
		["one character too long", ADDRESS_A + "A"],
		["a 0 (not base32)", "G0" + ADDRESS_A.slice(2)],
		["a 1 (not base32)", "G1" + ADDRESS_A.slice(2)],
		["an 8 (not base32)", "G8" + ADDRESS_A.slice(2)],
		["a 9 (not base32)", "G9" + ADDRESS_A.slice(2)],
		["leading whitespace", " " + ADDRESS_A],
		["a trailing newline", ADDRESS_A + "\n"],
		["an empty string", ""],
	])("rejects %s", (_label, address) => {
		expect(looksLikeStellarAddress(address)).toBe(false)
	})
})

describe("isSupplier", () => {
	const config: ControlsConfig = {
		limits: DEFAULT_LIMITS,
		suppliers: [
			{ address: ADDRESS_A, label: "Acme", kind: "demo" },
			{ address: ADDRESS_B, label: "Globex", kind: "real" },
		],
	}
	const OTHER = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADB"

	it("accepts the first supplier of the list", () => {
		expect(isSupplier(ADDRESS_A, config)).toBe(true)
	})

	it("accepts a later supplier of the list", () => {
		expect(isSupplier(ADDRESS_B, config)).toBe(true)
	})

	it("rejects an address that differs from every supplier by one character", () => {
		expect(isSupplier(OTHER, config)).toBe(false)
	})

	it("rejects everything while the list is empty", () => {
		expect(isSupplier(ADDRESS_A, DEFAULT_CONFIG)).toBe(false)
	})
})

describe("validateLimitsChange", () => {
	const limits = (over: Partial<Limits>): Limits => ({
		...DEFAULT_LIMITS,
		...over,
	})

	it.each<[string, Limits, number]>([
		["the defaults with nothing spent", DEFAULT_LIMITS, 0],
		["a cap equal to what was spent", limits({ cap30d: 1000 }), 1000],
		["a cap raised above what was spent", limits({ cap30d: 1500 }), 500],
		[
			"a per-payment maximum equal to the cap",
			limits({ maxPerPayment: 1000 }),
			0,
		],
		["a shorter whole-day period", limits({ periodDays: 7 }), 0],
		[
			"a cap equal to the spent amount despite float noise",
			limits({ maxPerPayment: 0.3, cap30d: 0.3 }),
			0.1 + 0.2,
		],
	])("accepts %s", (_label, next, spent) => {
		expect(validateLimitsChange(next, spent)).toEqual({ ok: true })
	})

	it("rejects a cap below what was spent, telling how much was spent", () => {
		expect(validateLimitsChange(limits({ cap30d: 700 }), 750)).toEqual({
			ok: false,
			reason:
				"The 30-day cap cannot be below the amount already spent (750 XLM)",
		})
	})

	it("shows decimals of the spent amount", () => {
		expect(validateLimitsChange(limits({ cap30d: 12 }), 12.5)).toEqual({
			ok: false,
			reason:
				"The 30-day cap cannot be below the amount already spent (12.5 XLM)",
		})
	})

	it("rejects a cap one stroop below what was spent", () => {
		const result = validateLimitsChange(
			limits({ maxPerPayment: 100, cap30d: 499.9999999 }),
			500,
		)
		expect(result.ok).toBe(false)
	})

	it("rejects a per-payment maximum above the cap", () => {
		expect(
			validateLimitsChange(limits({ maxPerPayment: 600, cap30d: 500 }), 0),
		).toEqual({
			ok: false,
			reason: "The per-payment maximum cannot be above the 30-day cap",
		})
	})

	it("reports the spent-amount problem first when both apply", () => {
		const result = validateLimitsChange(
			limits({ maxPerPayment: 600, cap30d: 500 }),
			700,
		)
		expect(result).toMatchObject({ ok: false })
		expect(result.ok === false && result.reason).toContain("already spent")
	})

	it.each<[string, Partial<Limits>, string]>([
		["a NaN maximum", { maxPerPayment: NaN }, "per-payment maximum"],
		["an infinite maximum", { maxPerPayment: Infinity }, "per-payment maximum"],
		["a zero maximum", { maxPerPayment: 0 }, "per-payment maximum"],
		["a negative maximum", { maxPerPayment: -1 }, "per-payment maximum"],
		["a NaN cap", { cap30d: NaN }, "30-day cap"],
		["an infinite cap", { cap30d: Infinity }, "30-day cap"],
		["a zero cap", { cap30d: 0 }, "30-day cap"],
		["a negative cap", { cap30d: -5 }, "30-day cap"],
		["a NaN period", { periodDays: NaN }, "period"],
		["an infinite period", { periodDays: Infinity }, "period"],
		["a zero period", { periodDays: 0 }, "period"],
		["a negative period", { periodDays: -30 }, "period"],
		["a fractional period", { periodDays: 30.5 }, "whole number of days"],
		["a period longer than 30 days", { periodDays: 31 }, "longer than 30 days"],
	])("rejects %s", (_label, over, mention) => {
		const result = validateLimitsChange(limits(over), 0)
		expect(result.ok).toBe(false)
		expect(result.ok === false && result.reason).toContain(mention)
	})

	it.each<[string, number]>([
		["a NaN spent amount", NaN],
		["an infinite spent amount", Infinity],
		["a negative spent amount", -1],
	])(
		"rejects %s instead of letting a cap below the real spending through",
		(_label, spent) => {
			const result = validateLimitsChange(limits({ cap30d: 600 }), spent)
			expect(result.ok).toBe(false)
			expect(result.ok === false && result.reason).toContain("already spent")
		},
	)

	// A stroop is the smallest unit, so anything finer could not be sent to the
	// contract (toControlParams would throw in the middle of a rule change).
	it.each<[string, Partial<Limits>, string]>([
		[
			"a maximum with 8 decimals",
			{ maxPerPayment: 0.12345678 },
			"per-payment maximum",
		],
		["a cap with 8 decimals", { cap30d: 1000.12345678 }, "30-day cap"],
	])("rejects %s", (_label, over, mention) => {
		const result = validateLimitsChange(limits(over), 0)
		expect(result.ok).toBe(false)
		expect(result.ok === false && result.reason).toContain(mention)
		expect(result.ok === false && result.reason).toContain("7 decimals")
	})

	it("accepts a maximum and a cap with exactly 7 decimals", () => {
		expect(
			validateLimitsChange(
				limits({ maxPerPayment: 0.1234567, cap30d: 1000.1234567 }),
				0,
			),
		).toEqual({ ok: true })
	})
})

describe("the spent amount in the cap message", () => {
	it("uses the same decimals as the other amounts", () => {
		expect(validateLimitsChange({ ...DEFAULT_LIMITS, cap30d: 1000 }, 1422.2345178)).toEqual({
			ok: false,
			reason:
				"The 30-day cap cannot be below the amount already spent (1,422.23 XLM)",
		})
	})

	it("follows the USD price when there is one", () => {
		expect(
			validateLimitsChange({ ...DEFAULT_LIMITS, cap30d: 1000 }, 1422.2345178, 0.12),
		).toEqual({
			ok: false,
			reason:
				"The 30-day cap cannot be below the amount already spent (1,422.2345 XLM)",
		})
	})
})
