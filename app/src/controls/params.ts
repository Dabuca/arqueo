import { type ControlsConfig, type RuleName } from "./types"
import { xlmToStroops } from "./units"

/**
 * Install parameters of `control-policy` for one rule (AGENTS.md §6.2).
 * `maxPerPayment` is in stroops; null means no maximum. src/lib/stellar.ts
 * turns this into the `xdr.ScVal` the contract expects.
 */
export function toControlParams(
	config: ControlsConfig,
	rule: RuleName,
): { allowlist: string[]; maxPerPayment: bigint | null } {
	return {
		allowlist: config.suppliers.map((supplier) => supplier.address),
		maxPerPayment:
			rule === "ordinary" ? xlmToStroops(config.limits.maxPerPayment) : null,
	}
}
