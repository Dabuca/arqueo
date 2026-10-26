import { useCurrency } from "../providers/CurrencyProvider"
import styles from "./CurrencyToggle.module.css"

// Display-only switch: the account, its limits and every payment stay in XLM.
export function CurrencyToggle() {
	const { currency, setCurrency, rate, priceStatus } = useCurrency()
	const usd = currency === "USD"

	const title = usd
		? "Show amounts in XLM"
		: priceStatus === "error"
			? "Live XLM price unavailable"
			: rate === undefined
				? "Loading the live XLM price…"
				: `Show amounts in USD. Indicative rate: 1 XLM ≈ $${rate.toFixed(4)}. Payments and limits stay in XLM.`

	return (
		<button
			type="button"
			role="switch"
			aria-checked={usd}
			aria-label="Show amounts in USD"
			className={styles.toggle}
			data-active={currency}
			disabled={!usd && priceStatus === "error"}
			title={title}
			onClick={() => setCurrency(usd ? "XLM" : "USD")}
		>
			<span className={styles.thumb} aria-hidden="true" />
			<span className={!usd ? `${styles.option} ${styles.active}` : styles.option}>
				XLM
			</span>
			<span className={usd ? `${styles.option} ${styles.active}` : styles.option}>
				USD
			</span>
		</button>
	)
}
