import { ArrowDown } from "lucide-react"
import { LandingOrbit } from "./LandingOrbit"
import styles from "./Landing.module.css"

export function LandingHero() {
	return (
		<section
			id="solution"
			className={`${styles.wrap} ${styles.hero}`}
			aria-labelledby="hero-title"
		>
			<div className={styles.heroCopy}>
				<p className={styles.eyebrow}>Stablecoin treasury on Stellar</p>
				<h1 id="hero-title">
					One payment.
					<br />
					Two signatures.
				</h1>
				<p className={styles.lead}>
					Meridian Studio invoiced $800. The treasury’s single-signer limit is $500,
					so the manager must co-sign.
				</p>
				<a href="#payment" className={styles.heroLink}>
					Review payment <ArrowDown size={15} aria-hidden="true" />
				</a>
			</div>
			<div className={styles.orbitScene}>
				<LandingOrbit landOn="payment" />
			</div>
		</section>
	)
}
