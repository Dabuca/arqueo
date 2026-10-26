import { useEffect, useRef, useState } from "react"
import { formatUsdc, formatXlm } from "../controls/format"
import { type PaymentAsset } from "../lib/stellar"

const TWEEN_MS = 450

const prefersReducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/**
 * A USDC amount, counting up or down to the new figure when the value changes.
 * The unit is not included: see `AmountUnit`.
 */
export function Amount({
	value,
	asset,
}: {
	value: number
	asset: PaymentAsset
}) {
	const [shown, setShown] = useState<number | null>(null)
	const current = useRef(value)

	useEffect(() => {
		const from = current.current
		if (from === value || prefersReducedMotion()) {
			current.current = value
			setShown(null)
			return
		}
		const start = performance.now()
		let frame = 0
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / TWEEN_MS)
			const eased = 1 - (1 - t) ** 3
			current.current = from + (value - from) * eased
			if (t < 1) {
				setShown(current.current)
				frame = requestAnimationFrame(step)
			} else {
				current.current = value
				setShown(null)
			}
		}
		frame = requestAnimationFrame(step)
		return () => cancelAnimationFrame(frame)
	}, [value])

	return <>{asset === "USDC" ? formatUsdc(shown ?? value) : formatXlm(shown ?? value)}</>
}

/** The unit that goes after an `Amount`. */
export function AmountUnit({ asset }: { asset: PaymentAsset }) {
	return <>{asset}</>
}
