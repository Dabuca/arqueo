export interface ApprovalProgress {
	signed: 1 | 2
	needed: 1 | 2
	state: "pending" | "complete"
	message: string
}

interface ApprovalInput {
	/** The amount goes past the per-payment maximum or what is left of the cap. */
	needsManager: boolean
	/** The user chose to sign with employee + manager. */
	managerSigns: boolean
}

/** What the approval track shows. A hint only: the account decides on chain. */
export function approvalProgress({
	needsManager,
	managerSigns,
}: ApprovalInput): ApprovalProgress {
	if (managerSigns) {
		return { signed: 2, needed: 2, state: "complete", message: "Employee and manager sign." }
	}
	if (needsManager) {
		return { signed: 1, needed: 2, state: "pending", message: "Manager signature required." }
	}
	return { signed: 1, needed: 1, state: "complete", message: "Employee signature is enough." }
}
