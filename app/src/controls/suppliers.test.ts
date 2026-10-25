import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "./defaults"
import {
	addDemoSupplier,
	addRealSupplier,
	createOutsiderAccount,
	removeSupplier,
	type SupplierDeps,
} from "./suppliers"
import { type ControlsConfig } from "./types"

const ADDRESS_A = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI"
const ADDRESS_B = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADA"

function makeDeps(overrides: Partial<SupplierDeps> = {}): SupplierDeps {
	return {
		isValidAddress: vi.fn(() => true),
		accountExists: vi.fn(async () => true),
		createFundedAccount: vi.fn(async () => ADDRESS_B),
		...overrides,
	}
}

function makeConfig(): ControlsConfig {
	return {
		limits: { ...DEFAULT_CONFIG.limits },
		suppliers: [{ address: ADDRESS_A, label: "Acme", kind: "real" }],
	}
}

describe("addRealSupplier", () => {
	it("appends the supplier as real when everything checks out", async () => {
		const config = makeConfig()
		const result = await addRealSupplier(
			config,
			ADDRESS_B,
			"Globex",
			makeDeps(),
		)
		expect(result).toEqual({
			ok: true,
			config: {
				limits: config.limits,
				suppliers: [
					{ address: ADDRESS_A, label: "Acme", kind: "real" },
					{ address: ADDRESS_B, label: "Globex", kind: "real" },
				],
			},
		})
	})

	it("does not mutate the config it receives", async () => {
		const config = makeConfig()
		const snapshot = structuredClone(config)
		await addRealSupplier(config, ADDRESS_B, "Globex", makeDeps())
		expect(config).toEqual(snapshot)
	})

	it("rejects a badly formatted address without touching the network", async () => {
		const deps = makeDeps()
		const result = await addRealSupplier(
			makeConfig(),
			"not-an-address",
			"X",
			deps,
		)
		expect(result).toEqual({ ok: false, reason: "Invalid Stellar address" })
		expect(deps.isValidAddress).not.toHaveBeenCalled()
		expect(deps.accountExists).not.toHaveBeenCalled()
	})

	it("rejects an address with a bad checksum", async () => {
		const deps = makeDeps({ isValidAddress: vi.fn(() => false) })
		const result = await addRealSupplier(makeConfig(), ADDRESS_B, "X", deps)
		expect(result).toEqual({ ok: false, reason: "Invalid Stellar address" })
		expect(deps.accountExists).not.toHaveBeenCalled()
	})

	it("rejects a duplicate before asking the network", async () => {
		const deps = makeDeps()
		const result = await addRealSupplier(makeConfig(), ADDRESS_A, "Again", deps)
		expect(result).toEqual({
			ok: false,
			reason: "Supplier already in the list",
		})
		expect(deps.accountExists).not.toHaveBeenCalled()
	})

	it("rejects an account that does not exist on testnet", async () => {
		const deps = makeDeps({ accountExists: vi.fn(async () => false) })
		const result = await addRealSupplier(makeConfig(), ADDRESS_B, "X", deps)
		expect(result).toEqual({
			ok: false,
			reason: "Account not found on testnet: fund it with Friendbot first",
		})
		expect(deps.accountExists).toHaveBeenCalledWith(ADDRESS_B)
	})

	it("checks format, then duplicate, then existence", async () => {
		// Malformed AND would-be duplicate: format error wins.
		const config: ControlsConfig = {
			...makeConfig(),
			suppliers: [{ address: "bad", label: "Bad", kind: "real" }],
		}
		const deps = makeDeps()
		const result = await addRealSupplier(config, "bad", "X", deps)
		expect(result).toEqual({ ok: false, reason: "Invalid Stellar address" })

		// Valid format, bad checksum AND duplicate: checksum error wins.
		const deps2 = makeDeps({ isValidAddress: vi.fn(() => false) })
		const result2 = await addRealSupplier(makeConfig(), ADDRESS_A, "X", deps2)
		expect(result2).toEqual({ ok: false, reason: "Invalid Stellar address" })

		// Duplicate AND missing on testnet: duplicate error wins.
		const deps3 = makeDeps({ accountExists: vi.fn(async () => false) })
		const result3 = await addRealSupplier(makeConfig(), ADDRESS_A, "X", deps3)
		expect(result3).toEqual({
			ok: false,
			reason: "Supplier already in the list",
		})
	})

	it("never adds the same address twice", async () => {
		const deps = makeDeps()
		const first = await addRealSupplier(makeConfig(), ADDRESS_B, "Globex", deps)
		if (!first.ok) throw new Error("expected ok")
		const second = await addRealSupplier(
			first.config,
			ADDRESS_B,
			"Globex",
			deps,
		)
		expect(second.ok).toBe(false)
		expect(first.config.suppliers).toHaveLength(2)
	})
})

describe("addDemoSupplier", () => {
	it("creates a funded account and appends it as demo", async () => {
		const config = makeConfig()
		const deps = makeDeps()
		const result = await addDemoSupplier(config, "Demo Co", deps)
		expect(deps.createFundedAccount).toHaveBeenCalledTimes(1)
		expect(result).toEqual({
			ok: true,
			config: {
				limits: config.limits,
				suppliers: [
					{ address: ADDRESS_A, label: "Acme", kind: "real" },
					{ address: ADDRESS_B, label: "Demo Co", kind: "demo" },
				],
			},
		})
	})

	it("does not mutate the config it receives", async () => {
		const config = makeConfig()
		const snapshot = structuredClone(config)
		await addDemoSupplier(config, "Demo Co", makeDeps())
		expect(config).toEqual(snapshot)
	})

	it("returns the error message when creation throws", async () => {
		const deps = makeDeps({
			createFundedAccount: vi.fn(async () => {
				throw new Error("Friendbot unavailable")
			}),
		})
		const config = makeConfig()
		const result = await addDemoSupplier(config, "Demo Co", deps)
		expect(result).toEqual({ ok: false, reason: "Friendbot unavailable" })
		expect(config.suppliers).toHaveLength(1)
	})

	it("stringifies a non-Error rejection", async () => {
		const deps = makeDeps({
			createFundedAccount: vi.fn(async () => {
				throw "boom"
			}),
		})
		const result = await addDemoSupplier(makeConfig(), "Demo Co", deps)
		expect(result).toEqual({ ok: false, reason: "boom" })
	})
})

describe("removeSupplier", () => {
	it("returns a new config without that supplier", () => {
		const config = makeConfig()
		const result = removeSupplier(config, ADDRESS_A)
		expect(result).toEqual({
			ok: true,
			config: { limits: config.limits, suppliers: [] },
		})
	})

	it("does not mutate the config it receives", () => {
		const config = makeConfig()
		const snapshot = structuredClone(config)
		removeSupplier(config, ADDRESS_A)
		expect(config).toEqual(snapshot)
	})

	it("fails when the supplier is not in the list", () => {
		const result = removeSupplier(makeConfig(), ADDRESS_B)
		expect(result).toEqual({ ok: false, reason: "Supplier not in the list" })
	})
})

describe("createOutsiderAccount", () => {
	it("returns a funded account address and nothing else", async () => {
		const deps = makeDeps()
		const address = await createOutsiderAccount(deps)
		expect(address).toBe(ADDRESS_B)
		expect(deps.createFundedAccount).toHaveBeenCalledTimes(1)
		expect(deps.accountExists).not.toHaveBeenCalled()
	})

	it("propagates a creation failure", async () => {
		const deps = makeDeps({
			createFundedAccount: vi.fn(async () => {
				throw new Error("Friendbot unavailable")
			}),
		})
		await expect(createOutsiderAccount(deps)).rejects.toThrow(
			"Friendbot unavailable",
		)
	})
})
