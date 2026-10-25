import { type Limits, type Role, type RuleName } from "./types"
import { roundToStroops } from "./units"

export function signersFor(rule: RuleName): Role[] {
	return rule === "ordinary" ? ["employee"] : ["employee", "manager"]
}

export function ruleForSigners(signers: Role[]): RuleName | null {
	if (signers.length === 1 && signers[0] === "employee") return "ordinary"
	if (
		signers.length === 2 &&
		signers.includes("employee") &&
		signers.includes("manager")
	) {
		return "large"
	}
	return null
}

/**
 * Which rule a payment needs: `ordinary` if it fits the per-payment maximum
 * and what is left of the 30-day cap, `large` otherwise.
 *
 * This is only a hint for the interface. The account on-chain decides, and the
 * app must still let the user attempt the payment with the employee alone
 * (scene 2 of the demo).
 */
export function requiredRule(
	amount: number,
	limits: Limits,
	spentInPeriod: number,
): RuleName {
	const fitsMaximum =
		roundToStroops(amount) <= roundToStroops(limits.maxPerPayment)
	const fitsCap =
		roundToStroops(spentInPeriod) + roundToStroops(amount) <=
		roundToStroops(limits.cap30d)
	return fitsMaximum && fitsCap ? "ordinary" : "large"
}
