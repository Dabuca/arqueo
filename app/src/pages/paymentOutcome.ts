import { type PayResult } from "../lib/payments"

/** What the payment screen shows after a payment attempt. */
export type Outcome =
	| { kind: "accepted"; hash: string }
	| { kind: "rejected"; reason: string; details?: string }
	| { kind: "error"; message: string }

/**
 * Maps the result of pay() to the screen state. `details` is only present for
 * rejections that do not map to a §6.3 message, and shows the original error.
 */
export function outcomeFromResult(result: PayResult): Outcome {
	if (result.ok) return { kind: "accepted", hash: result.hash }
	return result.details
		? { kind: "rejected", reason: result.reason, details: result.details }
		: { kind: "rejected", reason: result.reason }
}
