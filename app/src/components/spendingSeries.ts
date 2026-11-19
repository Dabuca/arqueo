import { type Payment, type PaymentAsset } from "../lib/stellar"

const DAY_MS = 86_400_000

export interface SpendPoint {
	/** Days since the start of the period, from 0 to `periodDays`. */
	day: number
	/** Cumulative ordinary spend after this payment, in asset units. */
	total: number
}

export interface SpendingSeries {
	points: SpendPoint[]
	spent: number
}

interface SeriesOptions {
	asset: PaymentAsset
	now: Date
	periodDays: number
}

/**
 * Cumulative spend of accepted `ordinary` payments of one asset over the last
 * `periodDays`. Only the ordinary rule counts against the cap. Display only:
 * the chain keeps the real period and spend.
 */
export function spendingSeries(
	payments: readonly Payment[],
	{ asset, now, periodDays }: SeriesOptions,
): SpendingSeries {
	const start = now.getTime() - periodDays * DAY_MS
	const inPeriod = payments
		.filter((p) => p.status === "ok" && p.rule === "ordinary" && p.asset === asset)
		.map((p) => ({ amount: p.amount, time: Date.parse(p.at) }))
		.filter(({ time }) => Number.isFinite(time) && time >= start && time <= now.getTime())
		.sort((a, b) => a.time - b.time)

	let total = 0
	const points = inPeriod.map(({ amount, time }) => {
		total += amount
		return { day: (time - start) / DAY_MS, total }
	})
	return { points, spent: total }
}

interface ChartBox {
	width: number
	height: number
	periodDays: number
	/** The total drawn at the top edge, usually the cap. */
	max: number
}

const round = (value: number) => Math.round(value * 10) / 10

/** SVG path of the stepped cumulative line, from day 0 to the end of the period. */
export function stepPath(points: readonly SpendPoint[], box: ChartBox): string {
	const x = (day: number) => round((day / box.periodDays) * box.width)
	const y = (total: number) =>
		round(box.height - Math.min(total / box.max, 1) * box.height)
	const steps = points.map((p) => `H${x(p.day)}V${y(p.total)}`).join("")
	return `M0 ${box.height}${steps}H${box.width}`
}
