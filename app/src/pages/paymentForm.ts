import { DEMO_AMOUNTS } from "../controls/defaults"

/** What the payment form needs to know to decide if it can be sent. */
export interface PaymentFormInput {
	hasCompany: boolean
	ordinaryReady: boolean
	recipient: string
	amount: string
	concept: string
}

export type PaymentField =
	| "company"
	| "rule"
	| "recipient"
	| "amount"
	| "concept"

export interface PaymentBlocker {
	field: PaymentField
	message: string
}

/**
 * Why the payment cannot be sent yet, in the order the form is filled. Empty
 * when it can. The screen marks each field and focuses the first one, so the
 * user always sees what is missing.
 */
export function paymentBlockers(form: PaymentFormInput): PaymentBlocker[] {
	if (!form.hasCompany) {
		return [{ field: "company", message: "Create the company account above" }]
	}
	if (!form.ordinaryReady) {
		return [{ field: "rule", message: "Set up the payment rule" }]
	}

	const blockers: PaymentBlocker[] = []
	if (!form.recipient.trim()) {
		blockers.push({ field: "recipient", message: "Enter the supplier account" })
	}
	const amount = Number(form.amount)
	if (form.amount.trim() === "" || !Number.isFinite(amount) || amount <= 0) {
		blockers.push({ field: "amount", message: "Enter an amount above 0" })
	}
	if (!form.concept.trim()) {
		blockers.push({ field: "concept", message: "Add a payment concept" })
	}
	return blockers
}

export interface Scene {
	amount: number
	concept: string
	/** Scene 3: the user pastes an existing account that is not on the list. */
	unknownSupplier: boolean
}

/** The demo scenes (AGENTS.md §2). Each one fills everything it can. */
export const SCENES = {
	below: {
		amount: DEMO_AMOUNTS.below,
		concept: "Office supplies",
		unknownSupplier: false,
	},
	above: {
		amount: DEMO_AMOUNTS.above,
		concept: "New laptops",
		unknownSupplier: false,
	},
	unknown: {
		amount: DEMO_AMOUNTS.unknown,
		concept: "Unlisted vendor",
		unknownSupplier: true,
	},
} as const satisfies Record<string, Scene>
