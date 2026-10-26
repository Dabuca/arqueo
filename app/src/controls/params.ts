import { LEDGERS_PER_DAY } from "./defaults"
import { type ControlsConfig, type RuleName } from "./types"
import { xlmToStroops } from "./units"

/**
 * Install parameters of `control-policy` for one rule (AGENTS.md §6.2).
 * Amounts are in stroops; null means no maximum or no cap. `periodLedgers` is
 * the length of the cap period (0 when there is no cap). src/lib/payments.ts
 * turns this into the `xdr.ScVal` the contract expects.
 */
export interface ControlParamValues {
	allowlist: string[]
	capPerPeriod: bigint | null
	maxPerPayment: bigint | null
	periodLedgers: number
}

/**
 * `ordinary` carries the per-payment maximum and the cap of the period;
 * `large` carries neither (the manager's second signature is its control).
 */
export function toControlParams(
	config: ControlsConfig,
	rule: RuleName,
): ControlParamValues {
	const ordinary = rule === "ordinary"
	return {
		allowlist: config.suppliers.map((supplier) => supplier.address),
		capPerPeriod: ordinary ? xlmToStroops(config.limits.cap30d) : null,
		maxPerPayment: ordinary ? xlmToStroops(config.limits.maxPerPayment) : null,
		periodLedgers: ordinary ? config.limits.periodDays * LEDGERS_PER_DAY : 0,
	}
}
