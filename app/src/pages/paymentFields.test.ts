import { StrKey } from "@stellar/stellar-sdk"
import { describe, expect, it } from "vitest"
import { UNKNOWN_SUPPLIER_DEMO, fieldErrors } from "./paymentFields"

const complete = {
	supplier: "GDATKZ",
	amount: "200",
	concept: "Office supplies",
}

describe("fieldErrors", () => {
	it("has no errors when every field is filled in", () => {
		expect(fieldErrors(complete)).toEqual({})
	})

	it("asks for the supplier when it is empty or only spaces", () => {
		expect(fieldErrors({ ...complete, supplier: "" })).toEqual({
			supplier: "Enter a supplier address",
		})
		expect(fieldErrors({ ...complete, supplier: "   " })).toEqual({
			supplier: "Enter a supplier address",
		})
	})

	it("asks for the amount when it is empty", () => {
		expect(fieldErrors({ ...complete, amount: "" })).toEqual({
			amount: "Enter an amount",
		})
	})

	it("asks for a positive amount when it is zero, negative or not a number", () => {
		for (const amount of ["0", "-5", "abc"]) {
			expect(fieldErrors({ ...complete, amount })).toEqual({
				amount: "Enter an amount greater than 0",
			})
		}
	})

	it("asks for the concept when it is empty or only spaces", () => {
		expect(fieldErrors({ ...complete, concept: "" })).toEqual({
			concept: "Enter a payment concept",
		})
		expect(fieldErrors({ ...complete, concept: "  " })).toEqual({
			concept: "Enter a payment concept",
		})
	})

	it("reports every missing field at once", () => {
		expect(fieldErrors({ supplier: "", amount: "", concept: "" })).toEqual({
			supplier: "Enter a supplier address",
			amount: "Enter an amount",
			concept: "Enter a payment concept",
		})
	})
})

describe("unknown supplier demo address", () => {
	it("is a valid Stellar account that is not an authorized supplier", () => {
		expect(StrKey.isValidEd25519PublicKey(UNKNOWN_SUPPLIER_DEMO)).toBe(true)
	})
})
