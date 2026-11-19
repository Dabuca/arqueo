import { describe, expect, it } from "vitest"
import { type Payment } from "../lib/stellar"
import { spendingSeries, stepPath } from "./spendingSeries"

const NOW = new Date("2026-11-19T12:00:00Z")
const DAY = 86_400_000

const payment = (overrides: Partial<Payment>): Payment => ({
	asset: "USDC",
	to: "GSUPPLIER",
	amount: 100,
	concept: "",
	signers: ["employee"],
	rule: "ordinary",
	status: "ok",
	at: new Date(NOW.getTime() - DAY).toISOString(),
	...overrides,
})

describe("spendingSeries", () => {
	it("accumulates accepted ordinary payments of the asset in time order", () => {
		const series = spendingSeries(
			[
				payment({ amount: 140, at: new Date(NOW.getTime() - 2 * DAY).toISOString() }),
				payment({ amount: 80, at: new Date(NOW.getTime() - 5 * DAY).toISOString() }),
			],
			{ asset: "USDC", now: NOW, periodDays: 30 },
		)

		expect(series.points.map((p) => p.total)).toEqual([80, 220])
		expect(series.spent).toBe(220)
		expect(series.points[0]?.day).toBeCloseTo(25)
		expect(series.points[1]?.day).toBeCloseTo(28)
	})

	it("ignores refused, large, other-asset and out-of-period payments", () => {
		const series = spendingSeries(
			[
				payment({ status: "rejected" }),
				payment({ rule: "large", signers: ["employee", "manager"] }),
				payment({ asset: "XLM" }),
				payment({ at: new Date(NOW.getTime() - 31 * DAY).toISOString() }),
				payment({ at: "not a date" }),
			],
			{ asset: "USDC", now: NOW, periodDays: 30 },
		)

		expect(series.points).toEqual([])
		expect(series.spent).toBe(0)
	})

	it("does not mutate the payments it receives", () => {
		const payments = [
			payment({ amount: 2, at: new Date(NOW.getTime() - DAY).toISOString() }),
			payment({ amount: 1, at: new Date(NOW.getTime() - 3 * DAY).toISOString() }),
		]
		const before = payments.map((p) => p.amount)
		spendingSeries(payments, { asset: "USDC", now: NOW, periodDays: 30 })
		expect(payments.map((p) => p.amount)).toEqual(before)
	})
})

describe("stepPath", () => {
	const box = { width: 600, height: 150, periodDays: 30, max: 1000 }

	it("draws a flat line at zero when nothing was spent", () => {
		expect(stepPath([], box)).toBe("M0 150H600")
	})

	it("steps up at each payment and runs to the end of the period", () => {
		expect(
			stepPath(
				[
					{ day: 3, total: 100 },
					{ day: 15, total: 500 },
				],
				box,
			),
		).toBe("M0 150H60V135H300V75H600")
	})

	it("clamps totals above the scale to the top of the chart", () => {
		expect(stepPath([{ day: 30, total: 2000 }], box)).toBe("M0 150H600V0H600")
	})
})
