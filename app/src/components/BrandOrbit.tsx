import styles from "./BrandOrbit.module.css"

export function BrandOrbit({ className }: { className?: string }) {
	return (
		<div className={className ? `${styles.orbit} ${className}` : styles.orbit} aria-hidden="true">
			<svg className={styles.mark} viewBox="0 0 640 640" focusable="false">
				<circle className={styles.backDisc} cx="370" cy="284" r="176" />
				<circle className={styles.frontDisc} cx="270" cy="354" r="148" />
				<ellipse
					className={styles.track}
					cx="320"
					cy="320"
					rx="294"
					ry="108"
					transform="rotate(-24 320 320)"
				/>
				<g className={styles.planet}>
					<circle cx="320" cy="38" r="15" />
				</g>
				<g className={styles.star}>
					<path d="M320 82 327 96 342 103 327 110 320 124 313 110 298 103 313 96Z" />
				</g>
			</svg>
		</div>
	)
}
