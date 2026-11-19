import { useEffect, useId, useRef, useState } from "react"
import { formatUsdc } from "../controls/format"
import {
	listPayments,
	loadControlsConfig,
	type Payment,
	type PaymentAsset,
} from "../lib/stellar"
import ui from "../styles/ui.module.css"
import styles from "./SpendingChart.module.css"
import { spendingSeries, stepPath } from "./spendingSeries"

const ASSETS: PaymentAsset[] = ["USDC", "XLM"]
const WIDTH = 600
const HEIGHT = 140
/** Room above the cap line, so a full cap does not touch the edge. */
const HEADROOM = 1.12

/** Starts the line drawing the first time the chart scrolls into view. */
function useInView<T extends Element>() {
	const ref = useRef<T>(null)
	const [inView, setInView] = useState(false)
	useEffect(() => {
		const node = ref.current
		if (!node || inView) return
		if (typeof IntersectionObserver === "undefined") {
			setInView(true)
			return
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) setInView(true)
			},
			{ threshold: 0.35 },
		)
		observer.observe(node)
		return () => observer.disconnect()
	}, [inView])
	return [ref, inView] as const
}

/**
 * Ordinary spending this period as a stepped cumulative line against the cap.
 * Read from this browser's payment log: the chain keeps the real spend.
 */
export function SpendingChart() {
	const [asset, setAsset] = useState<PaymentAsset>("USDC")
	const [payments, setPayments] = useState<Payment[]>([])
	const [limits, setLimits] = useState(() => loadControlsConfig().limits)
	const [ref, inView] = useInView<HTMLElement>()
	const hatchId = useId()

	useEffect(() => {
		let cancelled = false
		const refresh = () => {
			setLimits(loadControlsConfig().limits)
			listPayments()
				.then((list) => {
					if (!cancelled) setPayments(list)
				})
				.catch(() => undefined)
		}
		refresh()
		const events = ["arqueo:company-updated", "arqueo:payment-recorded"]
		events.forEach((name) => window.addEventListener(name, refresh))
		return () => {
			cancelled = true
			events.forEach((name) => window.removeEventListener(name, refresh))
		}
	}, [])

	const { cap30d: cap, periodDays } = limits
	const { points, spent } = spendingSeries(payments, {
		asset,
		now: new Date(),
		periodDays,
	})
	// A zero cap with nothing spent would divide by zero: keep a minimal scale.
	const max = Math.max(cap, spent, 1) * HEADROOM
	const box = { width: WIDTH, height: HEIGHT, periodDays, max }
	const line = stepPath(points, box)
	const capY = HEIGHT - (cap / max) * HEIGHT
	const last = points.at(-1)
	const endY = last ? HEIGHT - (Math.min(last.total, max) / max) * HEIGHT : HEIGHT
	const left = Math.max(cap - spent, 0)
	const summary = `${formatUsdc(spent)} ${asset} spent of a ${formatUsdc(cap)} ${asset} cap in the last ${periodDays} days, from ${points.length} ordinary payment${points.length === 1 ? "" : "s"}.`

	return (
		<section
			ref={ref}
			className={`${ui.card} ${styles.chart} ${inView ? styles.draw : ""}`}
			aria-labelledby="spending-title"
		>
			<div className={styles.head}>
				<div>
					<h2 id="spending-title" className={ui.sectionTitle}>
						Ordinary spending
					</h2>
					<p className={styles.meta}>Last {periodDays} days · this browser&apos;s log</p>
				</div>
				<div className={styles.segment} role="group" aria-label="Asset">
					{ASSETS.map((option) => (
						<button
							key={option}
							type="button"
							aria-pressed={asset === option}
							onClick={() => setAsset(option)}
						>
							{option}
						</button>
					))}
				</div>
			</div>

			<dl className={styles.figures}>
				<div>
					<dt>Spent</dt>
					<dd>
						{formatUsdc(spent)} <small>{asset}</small>
					</dd>
				</div>
				<div>
					<dt>Left</dt>
					<dd>
						{formatUsdc(left)} <small>{asset}</small>
					</dd>
				</div>
			</dl>

			<svg
				key={asset}
				className={styles.svg}
				viewBox={`0 -8 ${WIDTH} ${HEIGHT + 16}`}
				role="img"
				aria-label={summary}
			>
				<defs>
					<pattern id={hatchId} width="7" height="7" patternUnits="userSpaceOnUse">
						<path d="M-2 2L2 -2M0 7L7 0M5 9L9 5" className={styles.hatchStroke} />
					</pattern>
				</defs>
				{[0.25, 0.5, 0.75, 1].map((f) => (
					<path key={f} d={`M0 ${HEIGHT * f}H${WIDTH}`} className={styles.grid} />
				))}
				<path d={`M0 ${capY}H${WIDTH}`} className={styles.cap} />
				<path d={`${line}V${HEIGHT}H0Z`} fill={`url(#${hatchId})`} className={styles.area} />
				<path d={line} pathLength={1} className={styles.spend} />
				<circle cx={WIDTH} cy={endY} r="4" className={styles.dot} />
			</svg>
			<div className={styles.axis}>
				<span>Day 1</span>
				<span>
					Dashed line · {formatUsdc(cap)} {asset} cap
				</span>
				<span>Day {periodDays}</span>
			</div>
		</section>
	)
}
