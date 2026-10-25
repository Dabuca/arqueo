export const STROOPS_PER_XLM = 10_000_000n

const DECIMALS = 7

/**
 * Rounds an XLM amount held as a float to whole stroops, so float noise
 * (0.1 + 0.2) cannot flip a comparison at an exact limit. NaN stays NaN, so
 * every comparison with it is false. For comparing amounts, not for payments:
 * use `xlmToStroops` for those.
 */
export function roundToStroops(xlm: number): number {
	return Math.round(xlm * Number(STROOPS_PER_XLM))
}

/**
 * Converts an XLM amount to stroops. The amount is parsed as text so no
 * precision is lost to floats. Plain decimal notation only (no exponents).
 * Throws if it is not a number, is negative or has more than 7 decimals.
 */
export function xlmToStroops(xlm: string | number): bigint {
	const text = String(xlm)
	const match = /^(\d+)(?:\.(\d+))?$/.exec(text)
	if (!match) {
		if (/^-\d+(\.\d+)?$/.test(text)) {
			throw new Error(`XLM amount cannot be negative: ${text}`)
		}
		throw new Error(`Not a valid XLM amount: ${text}`)
	}
	// Group 1 always matches; its default only satisfies noUncheckedIndexedAccess.
	const [, whole = "0", fraction = ""] = match
	if (fraction.length > DECIMALS) {
		throw new Error(`XLM amount has more than ${DECIMALS} decimals: ${text}`)
	}
	return (
		BigInt(whole) * STROOPS_PER_XLM + BigInt(fraction.padEnd(DECIMALS, "0"))
	)
}

/** Formats stroops as an XLM string without trailing zeros ("12.5", "200"). */
export function stroopsToXlm(stroops: bigint): string {
	const negative = stroops < 0n
	const abs = negative ? -stroops : stroops
	const whole = abs / STROOPS_PER_XLM
	const fraction = (abs % STROOPS_PER_XLM)
		.toString()
		.padStart(DECIMALS, "0")
		.replace(/0+$/, "")
	return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`
}
