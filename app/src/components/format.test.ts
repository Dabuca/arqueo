import { describe, expect, it } from "vitest"
import { formatXlm } from "./format"

describe("formatXlm", () => {
	it("shows at most two decimals", () => {
		expect(formatXlm(1234.5678)).toBe("1,234.57")
	})

	it("rounds the long tail of stroop decimals away", () => {
		expect(formatXlm(499.9999973)).toBe("500")
		expect(formatXlm(1399.9999973)).toBe("1,400")
	})

	it("keeps a tiny positive amount from looking like zero", () => {
		expect(formatXlm(0.0000027)).toBe("< 0.01")
	})

	it("shows zero as zero", () => {
		expect(formatXlm(0)).toBe("0")
	})

	it("shows whole numbers without decimals", () => {
		expect(formatXlm(1000)).toBe("1,000")
	})
})
