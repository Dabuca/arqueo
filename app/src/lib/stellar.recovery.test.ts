import { StrKey } from "@stellar/stellar-sdk"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { type RecoveryPackage } from "./stellar"

const storage = new Map<string, string>()
const localStorageMock = {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => storage.set(key, value),
	removeItem: (key: string) => storage.delete(key),
	clear: () => storage.clear(),
}

let importRecoveryPackage: (json: string) => RecoveryPackage
let loadRecoveryPackage: () => RecoveryPackage | undefined

beforeAll(async () => {
	vi.stubGlobal("localStorage", localStorageMock)
	vi.stubGlobal("window", { dispatchEvent: vi.fn() })
	;({ importRecoveryPackage, loadRecoveryPackage } = await import("./stellar"))
})

beforeEach(() => storage.clear())

function validPackage(): RecoveryPackage {
	return {
		version: 1,
		network: "testnet",
		companyAddress: StrKey.encodeContract(new Uint8Array(32).fill(7)),
		adminRuleId: 0,
		recovery: {
			ruleId: 3,
			guardians: [1, 2, 3].map((id) => ({
				credentialId: ["AQ", "Ag", "Aw"][id - 1]!,
				publicKey: btoa(String.fromCharCode(4, ...new Uint8Array(64).fill(id))),
			})),
		},
		rules: { ordinary: 1, large: 2 },
	}
}

describe("recovery package", () => {
	it("accepts and stores a valid public testnet package", () => {
		const data = validPackage()

		expect(importRecoveryPackage(JSON.stringify(data))).toEqual(data)
		expect(loadRecoveryPackage()).toEqual(data)
	})

	it("rejects malformed JSON and packages from other networks", () => {
		expect(() => importRecoveryPackage("{")).toThrow("not valid JSON")
		expect(() =>
			importRecoveryPackage(
				JSON.stringify({ ...validPackage(), network: "mainnet" }),
			),
		).toThrow("not for Stellar testnet")
	})

	it("rejects duplicate guardians and malformed public keys", () => {
		const duplicate = validPackage()
		duplicate.recovery.guardians[2]!.credentialId =
			duplicate.recovery.guardians[0]!.credentialId
		expect(() => importRecoveryPackage(JSON.stringify(duplicate))).toThrow(
			"incomplete",
		)

		const invalidKey = validPackage()
		invalidKey.recovery.guardians[0]!.publicKey = btoa("private data")
		expect(() => importRecoveryPackage(JSON.stringify(invalidKey))).toThrow(
			"incomplete",
		)
	})
})
