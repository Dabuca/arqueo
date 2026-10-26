import { describe, expect, it } from "vitest"
import { DEFAULT_LIMITS } from "./defaults"
import { toControlParams } from "./params"
import { type ControlsConfig } from "./types"

const ADDRESS_A = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI"
const ADDRESS_B = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADA"

const config: ControlsConfig = {
	limits: DEFAULT_LIMITS,
	suppliers: [
		{ address: ADDRESS_A, label: "Acme", kind: "demo" },
		{ address: ADDRESS_B, label: "Globex", kind: "real" },
	],
}

describe("toControlParams", () => {
	it("ordinary carries the supplier addresses and the per-payment maximum in stroops", () => {
		expect(toControlParams(config, "ordinary")).toStrictEqual({
			allowlist: [ADDRESS_A, ADDRESS_B],
			capPerPeriod: 10_000_000_000n,
			maxPerPayment: 5_000_000_000n,
			periodLedgers: 30 * 17_280,
		})
	})

	it("large carries the supplier addresses and no maximum", () => {
		expect(toControlParams(config, "large")).toStrictEqual({
			allowlist: [ADDRESS_A, ADDRESS_B],
			capPerPeriod: null,
			maxPerPayment: null,
			periodLedgers: 0,
		})
	})

	it("ordinary follows the maximum the admin set, decimals included", () => {
		const changed: ControlsConfig = {
			...config,
			limits: { ...DEFAULT_LIMITS, maxPerPayment: 12.5 },
		}
		expect(toControlParams(changed, "ordinary").maxPerPayment).toBe(
			125_000_000n,
		)
	})

	it("ordinary follows the cap and the period the admin set", () => {
		const changed: ControlsConfig = {
			...config,
			limits: { maxPerPayment: 100, cap30d: 2_500.5, periodDays: 7 },
		}
		const params = toControlParams(changed, "ordinary")
		expect(params.capPerPeriod).toBe(25_005_000_000n)
		expect(params.periodLedgers).toBe(7 * 17_280)
	})

	it("keeps the suppliers in the order of the list, as bare addresses", () => {
		const reversed: ControlsConfig = {
			...config,
			suppliers: [...config.suppliers].reverse(),
		}
		expect(toControlParams(reversed, "ordinary").allowlist).toEqual([
			ADDRESS_B,
			ADDRESS_A,
		])
	})

	it.each(["ordinary", "large"] as const)(
		"gives an empty allowlist for %s while there are no suppliers",
		(rule) => {
			const none: ControlsConfig = { ...config, suppliers: [] }
			expect(toControlParams(none, rule).allowlist).toEqual([])
		},
	)
})
