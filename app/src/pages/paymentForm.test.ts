import { describe, expect, it } from "vitest"
import { DEMO_AMOUNTS } from "../controls/defaults"
import { paymentBlockers, SCENES, type PaymentFormInput } from "./paymentForm"

const SUPPLIER = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H"

const ready: PaymentFormInput = {
	hasCompany: true,
	ordinaryReady: true,
	recipient: SUPPLIER,
	amount: "200",
	concept: "Office supplies",
}

const messages = (form: PaymentFormInput) =>
	paymentBlockers(form).map((blocker) => blocker.message)

describe("paymentBlockers", () => {
	it("has nothing to report when the form is complete", () => {
		expect(paymentBlockers(ready)).toEqual([])
	})

	it("reports an empty concept, which used to grey out the button silently", () => {
		expect(paymentBlockers({ ...ready, concept: "" })).toEqual([
			{ field: "concept", message: "Add a payment concept" },
		])
		expect(messages({ ...ready, concept: "   " })).toEqual([
			"Add a payment concept",
		])
	})

	it("reports an empty recipient", () => {
		expect(paymentBlockers({ ...ready, recipient: " " })).toEqual([
			{ field: "recipient", message: "Enter the supplier account" },
		])
	})

	it.each(["", "0", "-5", "abc"])("reports the amount %j", (amount) => {
		expect(paymentBlockers({ ...ready, amount })).toEqual([
			{ field: "amount", message: "Enter an amount above 0" },
		])
	})

	it("asks for the company account before the payment rule", () => {
		expect(
			paymentBlockers({ ...ready, hasCompany: false, ordinaryReady: false }),
		).toEqual([
			{ field: "company", message: "Create the company account above" },
		])
	})

	it("asks for the payment rule when the company exists", () => {
		expect(paymentBlockers({ ...ready, ordinaryReady: false })).toEqual([
			{ field: "rule", message: "Set up the payment rule" },
		])
	})

	it("lists every missing field in form order, so the first one gets focus", () => {
		expect(
			paymentBlockers({ ...ready, recipient: "", amount: "", concept: "" }).map(
				(blocker) => blocker.field,
			),
		).toEqual(["recipient", "amount", "concept"])
	})
})

describe("SCENES", () => {
	it("uses the demo amounts", () => {
		expect(SCENES.below.amount).toBe(DEMO_AMOUNTS.below)
		expect(SCENES.above.amount).toBe(DEMO_AMOUNTS.above)
		expect(SCENES.unknown.amount).toBe(DEMO_AMOUNTS.unknown)
	})

	it.each(["below", "above"] as const)(
		"leaves the %s scene ready to pay to an authorized supplier",
		(name) => {
			const scene = SCENES[name]
			expect(scene.unknownSupplier).toBe(false)
			expect(
				paymentBlockers({
					...ready,
					amount: String(scene.amount),
					concept: scene.concept,
				}),
			).toEqual([])
		},
	)

	it("leaves the unknown-supplier scene waiting only for the account to paste", () => {
		const scene = SCENES.unknown
		expect(scene.unknownSupplier).toBe(true)
		expect(
			messages({
				...ready,
				recipient: "",
				amount: String(scene.amount),
				concept: scene.concept,
			}),
		).toEqual(["Enter the supplier account"])
	})
})
