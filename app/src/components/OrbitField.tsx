import { type CSSProperties, useEffect, useRef, useState } from "react"
import styles from "./OrbitField.module.css"

// Pauses the loop while the background is scrolled out of view.
function useOnScreen<T extends Element>() {
	const ref = useRef<T>(null)
	const [onScreen, setOnScreen] = useState(true)

	useEffect(() => {
		const el = ref.current
		if (!el) return
		const observer = new IntersectionObserver((entries) => {
			const entry = entries[entries.length - 1]
			if (entry) setOnScreen(entry.isIntersecting)
		})
		observer.observe(el)
		return () => observer.disconnect()
	}, [])

	return [ref, onScreen] as const
}

// One planet per orbit: radius, planet size, seconds per turn, direction.
const ORBITS = {
	single: [{ r: 170, planet: 14, seconds: 46, reverse: false }],
	roles: [
		{ r: 110, planet: 10, seconds: 30, reverse: false },
		{ r: 170, planet: 14, seconds: 44, reverse: true },
		{ r: 230, planet: 12, seconds: 60, reverse: false },
		{ r: 290, planet: 16, seconds: 80, reverse: true },
	],
} as const

type Props = { className?: string; x?: string; y?: string }

// The logo's two discs with orbits around them: one orbit for "one key", four for the four roles.
export function OrbitSystem({
	variant,
	className,
	x = "78%",
	y = "50%",
}: Props & { variant: keyof typeof ORBITS }) {
	const [ref, onScreen] = useOnScreen<HTMLDivElement>()

	return (
		<div
			ref={ref}
			className={className ? `${styles.field} ${className}` : styles.field}
			data-paused={!onScreen}
			aria-hidden="true"
		>
			<svg
				className={styles.system}
				style={{ "--x": x, "--y": y } as CSSProperties}
				viewBox="0 0 640 640"
				focusable="false"
			>
				<circle className={styles.backDisc} cx="336" cy="304" r="62" />
				<circle className={styles.frontDisc} cx="304" cy="336" r="50" />
				{ORBITS[variant].map(({ r, planet, seconds, reverse }) => (
					<g key={r}>
						<circle className={styles.track} cx="320" cy="320" r={r} />
						<g
							className={styles.spin}
							style={{
								animationDuration: `${seconds}s`,
								animationDirection: reverse ? "reverse" : "normal",
							}}
						>
							<circle className={styles.planet} cx="320" cy={320 - r} r={planet} />
						</g>
					</g>
				))}
			</svg>
		</div>
	)
}

// Two dashed rings, each carrying a small planet, for the dark closing band.
export function OrbitRings({ className }: { className?: string }) {
	const [ref, onScreen] = useOnScreen<HTMLDivElement>()

	return (
		<div
			ref={ref}
			className={className ? `${styles.rings} ${className}` : styles.rings}
			data-paused={!onScreen}
			aria-hidden="true"
		>
			<span className={styles.ringA} />
			<span className={styles.ringB} />
		</div>
	)
}
