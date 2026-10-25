import { Keypair, StrKey } from "@stellar/stellar-sdk"
import { describe, expect, it } from "vitest"
import {
	employeeSelectedSigner,
	ordinaryRuleParams,
	paymentLog,
	paymentRecord,
	ruleFor,
	sortedPolicies,
} from "./payments"

describe("sortedPolicies", () => {
	// Soroban rejects maps whose keys are not sorted, and the SDK keeps the
	// insertion order of a JS Map.
	it("orders policy addresses by their contract id bytes", () => {
		const low = StrKey.encodeContract(new Uint8Array(32).fill(0x01))
		const high = StrKey.encodeContract(new Uint8Array(32).fill(0xf0))

		const sorted = sortedPolicies(
			new Map<string, unknown>([
				[high, "high params"],
				[low, "low params"],
			]),
		)

		expect([...sorted.entries()]).toEqual([
			[low, "low params"],
			[high, "high params"],
		])
	})
})

describe("ruleFor", () => {
	it("uses the ordinary rule when only the employee signs", () => {
		expect(ruleFor(["employee"])).toBe("ordinary")
	})

	it("uses the large rule when employee and manager sign, in any order", () => {
		expect(ruleFor(["employee", "manager"])).toBe("large")
		expect(ruleFor(["manager", "employee"])).toBe("large")
	})

	it("has no rule for other signer sets", () => {
		expect(ruleFor([])).toBeUndefined()
		expect(ruleFor(["manager"])).toBeUndefined()
		expect(ruleFor(["admin"])).toBeUndefined()
	})
})

describe("ordinaryRuleParams", () => {
	it("follows the control matrix: threshold 1, 1,000 XLM every 30 days", () => {
		expect(ordinaryRuleParams()).toEqual({
			threshold: { threshold: 1 },
			spendingLimit: {
				spending_limit: 10_000_000_000n,
				period_ledgers: 30 * 17_280,
			},
		})
	})
})

describe("employeeSelectedSigner", () => {
	it("signs as a local ed25519 key with the raw public key in hex", () => {
		const employee = Keypair.random()
		const verifier = "CAAVTMCBXEIBPR64EAASKFXERVPYFZA2JYP5A3BG6PESWEFUJX5IHKN4"

		const selected = employeeSelectedSigner(verifier, employee.publicKey())

		expect(selected.type).toBe("ed25519")
		const expectedHex = Array.from(employee.rawPublicKey(), (b: number) =>
			b.toString(16).padStart(2, "0"),
		).join("")
		expect(selected.ed25519PublicKey).toBe(expectedHex)
		expect(selected.ed25519PublicKey).toHaveLength(64)
		expect(selected.signer).toBeDefined()
	})
})

describe("paymentRecord", () => {
	const input = {
		to: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
		amount: 200,
		concept: "Office supplies",
		signers: ["employee" as const],
	}
	const at = new Date("2026-10-25T12:00:00.000Z")

	it("records an accepted payment with its hash", () => {
		expect(
			paymentRecord(input, "ordinary", { ok: true, hash: "abc" }, at),
		).toEqual({
			...input,
			rule: "ordinary",
			status: "ok",
			hash: "abc",
			at: at.toISOString(),
		})
	})

	it("records a rejected payment with its reason", () => {
		expect(
			paymentRecord(input, "ordinary", { ok: false, reason: "nope" }, at),
		).toEqual({
			...input,
			rule: "ordinary",
			status: "rejected",
			reason: "nope",
			at: at.toISOString(),
		})
	})
})

describe("paymentLog", () => {
	const memoryStorage = () => {
		const data = new Map<string, string>()
		return {
			getItem: (key: string) => data.get(key) ?? null,
			setItem: (key: string, value: string) => void data.set(key, value),
		}
	}

	it("starts empty", () => {
		expect(paymentLog(memoryStorage()).list()).toEqual([])
	})

	it("keeps accepted and rejected payments in order across instances", () => {
		const storage = memoryStorage()
		const ok = {
			to: "G1",
			amount: 200,
			concept: "a",
			signers: ["employee" as const],
			rule: "ordinary" as const,
			status: "ok" as const,
			hash: "h1",
			at: "t1",
		}
		const rejected = {
			...ok,
			amount: 2_000,
			status: "rejected" as const,
			hash: undefined,
			reason: "limit",
			at: "t2",
		}

		paymentLog(storage).add(ok)
		paymentLog(storage).add(rejected)

		expect(paymentLog(storage).list()).toEqual([ok, rejected])
	})
})
