import { describe, expect, it } from "vitest"
import {
	MAX_FUNDING_PER_REQUEST,
	checkFundingRequest,
} from "../../../server/fundingRequest"

const ACCOUNT = "GBCOU6CXLLAHFGJOYVZU6GPPFDNQTOZRNCCNOSZYJIC4NLRIB23ZK7ZA"
const CONTRACT = "CBPCC6AT3756K43DGTRKLIZFOY5TODHZXGBJS4X4KZ64TFWUQDPEWU4L"

describe("checkFundingRequest", () => {
	it("accepts a G... or C... address with a positive amount", () => {
		expect(checkFundingRequest({ to: ACCOUNT, amount: 100 }).ok).toBe(true)
		expect(checkFundingRequest({ to: CONTRACT, amount: 9000 }).ok).toBe(true)
	})

	it("rejects anything that is not a Stellar address", () => {
		for (const to of ["", "hello", ACCOUNT.slice(1), undefined, 42]) {
			expect(checkFundingRequest({ to, amount: 1 }).ok).toBe(false)
		}
	})

	it("rejects amounts that are zero, negative, missing or over the cap", () => {
		for (const amount of [0, -5, NaN, Infinity, "100", undefined]) {
			expect(checkFundingRequest({ to: ACCOUNT, amount }).ok).toBe(false)
		}
		expect(
			checkFundingRequest({ to: ACCOUNT, amount: MAX_FUNDING_PER_REQUEST + 1 })
				.ok,
		).toBe(false)
	})

	it("rejects bodies that are not objects", () => {
		expect(checkFundingRequest(null).ok).toBe(false)
		expect(checkFundingRequest("to").ok).toBe(false)
	})
})
