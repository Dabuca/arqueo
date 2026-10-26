// Display only: amounts are kept exact everywhere else (payments, the change
// trail and the CSV exports). Stellar stroops go down to seven decimals, which
// is too many to read in a table or a sentence.

const STEP_USD = 0.00001
const MAX_XLM_DECIMALS = 7
const FALLBACK_XLM_DECIMALS = 2

/**
 * How many decimals of XLM to show: the last one has to be worth at least a
 * thousandth of a cent at the given price (USD per XLM). Without a price,
 * two decimals.
 */
export function xlmDecimals(priceUsd: number | undefined): number {
	if (priceUsd === undefined || priceUsd <= 0) return FALLBACK_XLM_DECIMALS
	let decimals = 0
	// The small tolerance keeps a step that is exactly the minimum from losing to
	// floating-point error.
	while (
		decimals < MAX_XLM_DECIMALS &&
		priceUsd * 10 ** -(decimals + 1) >= STEP_USD - 1e-12
	) {
		decimals++
	}
	return decimals
}

/** An XLM amount for the interface, grouped thousands, no more decimals than matter. */
export function formatXlm(value: number, priceUsd?: number): string {
	const decimals = xlmDecimals(priceUsd)
	// A small positive amount would round to "0", which reads as nothing left.
	const smallest = 10 ** -decimals
	if (value > 0 && value < smallest) return `< ${smallest.toFixed(decimals)}`
	return value.toLocaleString("en-US", { maximumFractionDigits: decimals })
}

/** A USDC amount for the interface: two decimals, grouped thousands. */
export function formatUsdc(value: number): string {
	return formatXlm(value)
}

/** A USD amount for the interface: always four decimals. */
export function formatUsd(value: number): string {
	return value.toLocaleString("en-US", {
		minimumFractionDigits: 4,
		maximumFractionDigits: 4,
	})
}
