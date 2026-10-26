import { type CheckResult, type ControlsConfig, type Limits } from "./types"
import { formatXlm } from "../components/format"
import { roundToStroops, xlmToStroops } from "./units"

/**
 * Format check only (G + 55 base32 characters). The full checksum is checked
 * where the address is used on the network (src/lib/stellar.ts).
 */
export function looksLikeStellarAddress(address: string): boolean {
	return /^G[A-Z2-7]{55}$/.test(address)
}

export function isSupplier(address: string, config: ControlsConfig): boolean {
	return config.suppliers.some((supplier) => supplier.address === address)
}

/** Longest cap period the contract accepts (30 days). */
export const MAX_PERIOD_DAYS = 30

const isPositive = (value: number) => Number.isFinite(value) && value > 0

// The contract takes amounts in stroops, so an amount finer than a stroop
// cannot be installed.
function fitsInStroops(value: number): boolean {
	try {
		xlmToStroops(value)
		return true
	} catch {
		return false
	}
}

const rejected = (reason: string): CheckResult => ({ ok: false, reason })

/**
 * Checks new limits against what was already spent in the current period.
 * The 30-day cap can never be set below that, so changing limits cannot be
 * used to get around the cap.
 */
export function validateLimitsChange(
	next: Limits,
	spentInPeriod: number,
	priceUsd?: number,
): CheckResult {
	if (!isPositive(next.maxPerPayment)) {
		return rejected("The per-payment maximum must be a positive number")
	}
	if (!fitsInStroops(next.maxPerPayment)) {
		return rejected("The per-payment maximum can have at most 7 decimals")
	}
	if (!isPositive(next.cap30d)) {
		return rejected("The 30-day cap must be a positive number")
	}
	if (!fitsInStroops(next.cap30d)) {
		return rejected("The 30-day cap can have at most 7 decimals")
	}
	if (!isPositive(next.periodDays)) {
		return rejected("The period must be a positive number of days")
	}
	if (!Number.isInteger(next.periodDays)) {
		return rejected("The period must be a whole number of days")
	}
	// The account keeps what was spent for 30 days after its last use, so a
	// longer period could forget it before the period ends.
	if (next.periodDays > MAX_PERIOD_DAYS) {
		return rejected(`The period cannot be longer than ${MAX_PERIOD_DAYS} days`)
	}
	// Without a valid spent amount the cap check below could not be trusted.
	if (!Number.isFinite(spentInPeriod) || spentInPeriod < 0) {
		return rejected("The amount already spent must be a number of zero or more")
	}
	if (roundToStroops(next.cap30d) < roundToStroops(spentInPeriod)) {
		return rejected(
			`The 30-day cap cannot be below the amount already spent (${formatXlm(spentInPeriod, priceUsd)} XLM)`,
		)
	}
	if (roundToStroops(next.maxPerPayment) > roundToStroops(next.cap30d)) {
		return rejected("The per-payment maximum cannot be above the 30-day cap")
	}
	return { ok: true }
}
