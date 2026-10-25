import { describe, expect, it } from "vitest"
import {
	roundToStroops,
	STROOPS_PER_XLM,
	stroopsToXlm,
	xlmToStroops,
} from "./units"

describe("xlmToStroops", () => {
	it.each<[string | number, bigint]>([
		["0", 0n],
		["1", 10_000_000n],
		["200", 2_000_000_000n],
		[200, 2_000_000_000n],
		["12.5", 125_000_000n],
		[0.1, 1_000_000n],
		["0.0000001", 1n],
		["0.1234567", 1_234_567n],
		// 2^53 + 1 stroops: a float cannot hold it, so this fails if parsing goes through Number
		["900719925.4740993", 9_007_199_254_740_993n],
	])("converts %j to %s stroops", (xlm, stroops) => {
		expect(xlmToStroops(xlm)).toBe(stroops)
	})

	it.each<[string, string | number]>([
		["more than 7 decimals (string)", "0.12345678"],
		["more than 7 decimals (number)", 0.12345678],
		["a float sum that is not exact", 0.1 + 0.2],
		["a negative string", "-1"],
		["a negative number", -5],
		["text", "abc"],
		["an empty string", ""],
		["a decimal comma", "1,5"],
		["two decimal points", "1.2.3"],
		["exponent notation", "1e3"],
		["NaN", NaN],
		["Infinity", Infinity],
	])("throws on %s", (_label, xlm) => {
		expect(() => xlmToStroops(xlm)).toThrow(Error)
	})
})

describe("stroopsToXlm", () => {
	it.each<[bigint, string]>([
		[0n, "0"],
		[1n, "0.0000001"],
		[1_000_000n, "0.1"],
		[1_234_567n, "0.1234567"],
		[10_000_000n, "1"],
		[125_000_000n, "12.5"],
		[2_000_000_000n, "200"],
		[9_007_199_254_740_993n, "900719925.4740993"],
		[-125_000_000n, "-12.5"],
	])("formats %s stroops as %s XLM", (stroops, xlm) => {
		expect(stroopsToXlm(stroops)).toBe(xlm)
	})

	it.each(["0", "0.0000001", "12.5", "200", "900719925.4740993"])(
		"round-trips %s",
		(xlm) => {
			expect(stroopsToXlm(xlmToStroops(xlm))).toBe(xlm)
		},
	)
})

describe("roundToStroops", () => {
	it.each<[number, number]>([
		[0, 0],
		[1, 10_000_000],
		[500.0000001, 5_000_000_001],
		[0.0000001, 1],
		// 0.1 + 0.2 is 0.30000000000000004 in floats
		[0.1 + 0.2, 3_000_000],
	])("rounds %j XLM to %j stroops", (xlm, stroops) => {
		expect(roundToStroops(xlm)).toBe(stroops)
	})

	it("keeps NaN as NaN so every comparison with it stays false", () => {
		expect(roundToStroops(NaN)).toBeNaN()
	})
})

describe("STROOPS_PER_XLM", () => {
	it("is what turns 1 XLM into 10,000,000 stroops", () => {
		expect(xlmToStroops("1")).toBe(STROOPS_PER_XLM)
	})
})
