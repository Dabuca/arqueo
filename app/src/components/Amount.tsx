import { useEffect, useRef, useState } from "react"
import { useCurrency } from "../providers/CurrencyProvider"

export const formatXlm = (xlm: number) =>
	xlm.toLocaleString("en-US", { maximumFractionDigits: 7 })

export const formatUsd = (usd: number) =>
	usd.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})

/** Converts an XLM amount to the chosen display currency, falling back to XLM without a price. */
export function useDisplayAmount() {
	const { currency, rate } = useCurrency()
	const inUsd = currency === "USD" && rate !== undefined
	return (xlm: number) =>
		inUsd
			? { text: formatUsd(xlm * rate), unit: "USD" }
			: { text: formatXlm(xlm), unit: "XLM" }
}

const TWEEN_MS = 450

const prefersReducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/**
 * An XLM amount shown as XLM or as an indicative USD value, counting up or down
 * to the new figure when the value or the currency changes. The unit is not included.
 */
export function Amount({ xlm }: { xlm: number }) {
	const { currency, rate } = useCurrency()
	const inUsd = currency === "USD" && rate !== undefined
	const target = inUsd ? xlm * rate : xlm
	const finalText = inUsd ? formatUsd(target) : formatXlm(target)

	const [shown, setShown] = useState<number | null>(null)
	const current = useRef(target)

	useEffect(() => {
		const from = current.current
		if (from === target || prefersReducedMotion()) {
			current.current = target
			setShown(null)
			return
		}
		const start = performance.now()
		let frame = 0
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / TWEEN_MS)
			const eased = 1 - (1 - t) ** 3
			current.current = from + (target - from) * eased
			if (t < 1) {
				setShown(current.current)
				frame = requestAnimationFrame(step)
			} else {
				current.current = target
				setShown(null)
			}
		}
		frame = requestAnimationFrame(step)
		return () => cancelAnimationFrame(frame)
	}, [target])

	if (shown === null) return <>{finalText}</>
	return (
		<>
			{shown.toLocaleString("en-US", {
				minimumFractionDigits: inUsd ? 2 : 0,
				maximumFractionDigits: 2,
			})}
		</>
	)
}

/** The unit that matches what `Amount` is currently showing. */
export function AmountUnit() {
	const { currency, rate } = useCurrency()
	return <>{currency === "USD" && rate !== undefined ? "USD" : "XLM"}</>
}
