import styles from "./Debug.module.css"

export default function Debug() {
	return (
		<div className={styles.explorer}>
			<div className={styles.mark} aria-hidden="true">
				<span />
				<span />
				<span />
			</div>
			<p className={styles.label}>STELLAR / CONTRACT TOOLS</p>
			<h1>Contract Explorer</h1>
			<p className={styles.labLink}>
				The Contract Explorer is being converted to a standalone Stellar
				Scaffold Extension that runs in its own process. Once available, this
				page will link to it automatically.
			</p>
			<p>
				In the meantime, use the{" "}
				<a href="https://lab.stellar.org" target="_blank" rel="noreferrer">
					Stellar Lab
				</a>{" "}
				to inspect transactions.
			</p>
		</div>
	)
}
