import { describe, expect, it } from "vitest"
import { formatUsd, formatXlm, xlmDecimals } from "./format"

describe("xlmDecimals", () => {
	it("stops at the digit where one step is worth a cent", () => {
		// At 0.12 USD per XLM, 0.1 XLM is 0.012 USD and 0.01 XLM is 0.0012 USD.
		expect(xlmDecimals(0.12)).toBe(1)
	})

	it("shows whole XLM when even 0.1 XLM is below a cent", () => {
		// 0.1 XLM at 0.05 USD is 0.005 USD.
		expect(xlmDecimals(0.05)).toBe(0)
	})

	it("shows more digits when XLM is worth more", () => {
		expect(xlmDecimals(2)).toBe(2)
	})

	it("keeps two decimals when there is no price", () => {
		expect(xlmDecimals(undefined)).toBe(2)
	})
})

describe("formatXlm with a price", () => {
	it("rounds to the digits that matter at that price", () => {
		expect(formatXlm(1234.5678, 0.12)).toBe("1,234.6")
	})

	it("shows the smallest step as a bound, not as zero", () => {
		expect(formatXlm(0.05, 0.12)).toBe("< 0.1")
	})

	it("drops decimals when XLM is cheap", () => {
		expect(formatXlm(12.7, 0.05)).toBe("13")
	})
})

describe("formatUsd", () => {
	it("always shows four decimals", () => {
		expect(formatUsd(1234.5)).toBe("1,234.5000")
	})

	it("keeps a tiny amount at four decimals", () => {
		expect(formatUsd(0.00001)).toBe("0.0000")
	})
})

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
