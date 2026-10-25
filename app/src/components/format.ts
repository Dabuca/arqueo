// Display only: amounts are kept exact everywhere else (payments, the change
// trail and the CSV exports). Stellar stroops go down to seven decimals, which
// is too many to read in a table or a sentence.

/** An XLM amount for the interface: at most two decimals, grouped thousands. */
export function formatXlm(value: number): string {
	// A small positive amount would round to "0", which reads as nothing left.
	if (value > 0 && value < 0.01) return "< 0.01"
	return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}
