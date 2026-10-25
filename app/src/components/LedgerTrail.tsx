import { useEffect, useRef } from "react"
import styles from "./LedgerTrail.module.css"

const MAX_MARKS = 12
const MIN_DISTANCE = 18

export function LedgerTrail() {
	const layerRef = useRef<HTMLDivElement>(null)
	const lastPoint = useRef<{ x: number; y: number } | null>(null)
	const markCount = useRef(0)
	const removalTimers = useRef(new Set<number>())

	useEffect(() => {
		const layer = layerRef.current
		if (!layer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return
		}

		const handlePointerMove = (event: PointerEvent) => {
			if (event.pointerType !== "mouse") return

			const previous = lastPoint.current
			lastPoint.current = { x: event.clientX, y: event.clientY }
			if (previous) {
				const dx = event.clientX - previous.x
				const dy = event.clientY - previous.y
				if (dx * dx + dy * dy < MIN_DISTANCE * MIN_DISTANCE) return
			}

			const mark = document.createElement("span")
			mark.className = `${styles.mark} ${markCount.current % 4 === 3 ? styles.star : ""}`
			mark.style.left = `${event.clientX}px`
			mark.style.top = `${event.clientY}px`
			mark.style.setProperty("--turn", `${(markCount.current * 37) % 180}deg`)
			markCount.current += 1
			layer.append(mark)
			while (layer.childElementCount > MAX_MARKS) {
				layer.firstElementChild?.remove()
			}
			const removalTimer = window.setTimeout(() => {
				mark.remove()
				removalTimers.current.delete(removalTimer)
			}, 620)
			removalTimers.current.add(removalTimer)
		}

		const handlePointerLeave = () => {
			lastPoint.current = null
		}

		window.addEventListener("pointermove", handlePointerMove, { passive: true })
		window.addEventListener("blur", handlePointerLeave)
		return () => {
			window.removeEventListener("pointermove", handlePointerMove)
			window.removeEventListener("blur", handlePointerLeave)
			for (const timer of removalTimers.current) window.clearTimeout(timer)
			removalTimers.current.clear()
			layer.replaceChildren()
		}
	}, [])

	return <div ref={layerRef} className={styles.layer} aria-hidden="true" />
}
