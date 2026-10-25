import { type Currency, useCurrency } from "../providers/CurrencyProvider"
import styles from "./CurrencyToggle.module.css"

const OPTIONS: Currency[] = ["XLM", "USD"]

// Display-only switch: the account, its limits and every payment stay in XLM.
export function CurrencyToggle() {
	const { currency, setCurrency, rate, priceStatus } = useCurrency()

	const usdTitle =
		priceStatus === "error"
			? "Live XLM price unavailable"
			: rate === undefined
				? "Loading the live XLM price…"
				: `Indicative rate: 1 XLM ≈ $${rate.toFixed(4)}. Payments and limits stay in XLM.`

	return (
		<div
			className={styles.toggle}
			role="group"
			aria-label="Display currency"
			data-active={currency}
		>
			<span className={styles.thumb} aria-hidden="true" />
			{OPTIONS.map((option) => (
				<button
					key={option}
					type="button"
					className={
						currency === option
							? `${styles.option} ${styles.active}`
							: styles.option
					}
					aria-pressed={currency === option}
					disabled={option === "USD" && priceStatus === "error"}
					title={option === "USD" ? usdTitle : "Show amounts in XLM"}
					onClick={() => setCurrency(option)}
				>
					{option}
				</button>
			))}
		</div>
	)
}
