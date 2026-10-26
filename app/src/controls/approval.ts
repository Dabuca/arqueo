import { signersFor } from "./rules"
import { type Role, type RuleName } from "./types"

export interface ApprovalInput {
	rule: RuleName
	signers: readonly Role[]
	status: "ok" | "rejected"
	reason?: string
}

export interface Approval {
	/** Short rule label, e.g. "Ordinary · 1 of 1". */
	ruleLabel: string
	/** Signers the rule requires, in signing order. */
	required: Role[]
	/** Signers the rule would have needed but that did not sign. */
	missing: Role[]
}

/** The refusals that a second signature would have fixed (§6.3, codes 2 and 5). */
const NEEDS_MANAGER = /manager approval required/i

/**
 * What an auditor needs to read a payment row: the rule applied, who it
 * requires and, for a refusal caused by a limit, who was missing. Display
 * only: the account on chain decides.
 */
export function describeApproval(input: ApprovalInput): Approval {
	const required = signersFor(input.rule)
	const label = input.rule === "ordinary" ? "Ordinary" : "Large"
	const missing =
		input.status === "rejected" &&
		input.rule === "ordinary" &&
		NEEDS_MANAGER.test(input.reason ?? "")
			? signersFor("large").filter((role) => !input.signers.includes(role))
			: []
	return {
		ruleLabel: `${label} · ${required.length} of ${required.length}`,
		required,
		missing,
	}
}
