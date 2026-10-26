import { useEffect, useRef, useState } from "react"
import { formatUsdc } from "../controls/format"

const TWEEN_MS = 450

const prefersReducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/**
 * A USDC amount, counting up or down to the new figure when the value changes.
 * The unit is not included: see `AmountUnit`.
 */
export function Amount({ usdc }: { usdc: number }) {
	const [shown, setShown] = useState<number | null>(null)
	const current = useRef(usdc)

	useEffect(() => {
		const from = current.current
		if (from === usdc || prefersReducedMotion()) {
			current.current = usdc
			setShown(null)
			return
		}
		const start = performance.now()
		let frame = 0
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / TWEEN_MS)
			const eased = 1 - (1 - t) ** 3
			current.current = from + (usdc - from) * eased
			if (t < 1) {
				setShown(current.current)
				frame = requestAnimationFrame(step)
			} else {
				current.current = usdc
				setShown(null)
			}
		}
		frame = requestAnimationFrame(step)
		return () => cancelAnimationFrame(frame)
	}, [usdc])

	return <>{formatUsdc(shown ?? usdc)}</>
}

/** The unit that goes after an `Amount`. */
export function AmountUnit() {
	return <>USDC</>
}
