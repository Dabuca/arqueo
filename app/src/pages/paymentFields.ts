export type FieldValues = { supplier: string; amount: string; concept: string }
export type FieldErrors = Partial<Record<keyof FieldValues, string>>

/**
 * Messages for the payment form fields that are missing or invalid. The
 * screen shows them under each field when the user tries to pay.
 */
export function fieldErrors(values: FieldValues): FieldErrors {
	const errors: FieldErrors = {}
	if (!values.supplier.trim()) {
		errors.supplier = "Enter a supplier address"
	}
	if (!values.amount.trim()) {
		errors.amount = "Enter an amount"
	} else if (!(Number(values.amount) > 0)) {
		errors.amount = "Enter an amount greater than 0"
	}
	if (!values.concept.trim()) {
		errors.concept = "Enter a payment concept"
	}
	return errors
}
