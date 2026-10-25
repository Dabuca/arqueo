import { describe, expect, it } from "vitest"
import { DEFAULT_LIMITS } from "./defaults"
import {
	MAX_SUPPLIERS,
	canDiscard,
	changeRecords,
	changedFields,
	configFromParams,
	describeValue,
	ledgerToDate,
	nextStep,
	remainingSteps,
	rulesToSwap,
	startChange,
	startMigration,
	validateSettings,
	withAdded,
	withRemoved,
} from "./settings"
import { type ControlsConfig, type Supplier } from "./types"

const A = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI"
const B = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADA"
const C = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADB"

const acme: Supplier = { address: A, label: "Acme", kind: "demo" }
const globex: Supplier = { address: B, label: "Globex", kind: "real" }

const config: ControlsConfig = {
	limits: DEFAULT_LIMITS,
	suppliers: [acme, globex],
}

const withLimits = (
	limits: Partial<ControlsConfig["limits"]>,
): ControlsConfig => ({
	...config,
	limits: { ...DEFAULT_LIMITS, ...limits },
})

describe("changedFields", () => {
	it("is empty when nothing changed", () => {
		expect(changedFields(config, { ...config })).toEqual([])
	})

	it("finds each setting that changed", () => {
		expect(changedFields(config, withLimits({ maxPerPayment: 600 }))).toEqual([
			"maxPerPayment",
		])
		expect(changedFields(config, withLimits({ cap30d: 1_500 }))).toEqual([
			"cap30d",
		])
		expect(changedFields(config, { ...config, suppliers: [acme] })).toEqual([
			"suppliers",
		])
		expect(
			changedFields(config, {
				limits: { ...DEFAULT_LIMITS, maxPerPayment: 1, cap30d: 2 },
				suppliers: [acme],
			}),
		).toEqual(["maxPerPayment", "cap30d", "suppliers"])
	})

	it("ignores the order and the labels of suppliers: they are not on chain", () => {
		expect(
			changedFields(config, {
				...config,
				suppliers: [
					{ ...globex, label: "Renamed" },
					{ ...acme, kind: "real" },
				],
			}),
		).toEqual([])
	})

	it("treats amounts equal to the stroop as equal", () => {
		expect(
			changedFields(config, withLimits({ maxPerPayment: 500.00000001 })),
		).toEqual([])
	})
})

describe("rulesToSwap", () => {
	it("limits are enforced by the ordinary rule only", () => {
		expect(rulesToSwap(["maxPerPayment"])).toEqual(["ordinary"])
		expect(rulesToSwap(["cap30d"])).toEqual(["ordinary"])
	})

	it("suppliers are enforced by both rules, ordinary first", () => {
		expect(rulesToSwap(["suppliers"])).toEqual(["ordinary", "large"])
		expect(rulesToSwap(["suppliers", "cap30d"])).toEqual(["ordinary", "large"])
	})

	it("is empty when nothing changed", () => {
		expect(rulesToSwap([])).toEqual([])
	})
})

describe("validateSettings", () => {
	it("accepts valid settings", () => {
		expect(validateSettings(config, 0)).toEqual({ ok: true })
	})

	it("rejects a cap below what was already spent", () => {
		const result = validateSettings(withLimits({ cap30d: 400 }), 500)
		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.reason).toContain("already spent")
	})

	it("rejects a maximum above the cap", () => {
		expect(validateSettings(withLimits({ maxPerPayment: 2_000 }), 0).ok).toBe(
			false,
		)
	})

	it("rejects an empty supplier list: nobody could be paid", () => {
		const result = validateSettings({ ...config, suppliers: [] }, 0)
		expect(result).toEqual({
			ok: false,
			reason: "Keep at least one supplier: with none, nobody can be paid",
		})
	})

	it("rejects a bad address, a duplicate and too many suppliers", () => {
		expect(
			validateSettings(
				{ ...config, suppliers: [{ ...acme, address: "nope" }] },
				0,
			).ok,
		).toBe(false)
		expect(validateSettings({ ...config, suppliers: [acme, acme] }, 0).ok).toBe(
			false,
		)
		const many = Array.from({ length: MAX_SUPPLIERS + 1 }, (_, i) => ({
			...acme,
			address: `G${String(i).padStart(2, "0")}${A.slice(3)}`.toUpperCase(),
		}))
		expect(validateSettings({ ...config, suppliers: many }, 0).ok).toBe(false)
	})
})

describe("describeValue", () => {
	it("writes limits as plain numbers", () => {
		expect(describeValue("maxPerPayment", config)).toBe("500")
		expect(describeValue("cap30d", config)).toBe("1000")
	})

	it("writes suppliers as label and shortened address", () => {
		expect(describeValue("suppliers", config)).toBe(
			"Acme (GBZXN7…DNMADI); Globex (GBZXN7…DNMADA)",
		)
		expect(describeValue("suppliers", { ...config, suppliers: [] })).toBe(
			"none",
		)
	})
})

describe("configFromParams", () => {
	const params = {
		allowlist: [A, C],
		capPerPeriod: 15_000_000_000n,
		maxPerPayment: 6_000_000_000n,
		periodLedgers: 30 * 17_280,
	}

	it("reads limits and suppliers back from what is installed", () => {
		const read = configFromParams(params, [acme])
		expect(read.limits).toEqual({
			maxPerPayment: 600,
			cap30d: 1_500,
			periodDays: 30,
		})
		expect(read.suppliers).toEqual([
			acme,
			{ address: C, label: "", kind: "real" },
		])
	})

	it("refuses a rule that has no maximum or no cap", () => {
		expect(() =>
			configFromParams({ ...params, capPerPeriod: null }, []),
		).toThrow("no per-payment maximum or cap")
	})
})

describe("ledgerToDate", () => {
	it("goes back five seconds per ledger", () => {
		const now = new Date("2026-10-25T12:00:00.000Z")
		expect(ledgerToDate(900, 1_000, now).toISOString()).toBe(
			"2026-10-25T11:51:40.000Z",
		)
	})
})

describe("a settings change as steps", () => {
	const next = withLimits({ cap30d: 1_500 })
	const plan = () =>
		startChange({
			prev: config,
			next,
			existingRules: { ordinary: 4, large: 5 },
			spentAtChange: 500,
			periodStart: "2026-10-01T00:00:00.000Z",
			now: new Date("2026-10-25T12:00:00.000Z"),
		})!

	it("does nothing when nothing changed", () => {
		expect(
			startChange({
				prev: config,
				next: config,
				existingRules: { ordinary: 4 },
			}),
		).toBeNull()
	})

	it("swaps only the rules that exist", () => {
		const onlyOrdinary = startChange({
			prev: config,
			next: { ...config, suppliers: [acme] },
			existingRules: { ordinary: 4 },
		})!
		expect(onlyOrdinary.swaps.map((s) => s.rule)).toEqual(["ordinary"])
		const none = startChange({
			prev: config,
			next: { ...config, suppliers: [acme] },
			existingRules: {},
		})!
		expect(none.swaps).toEqual([])
		expect(nextStep(none)).toBeUndefined()
	})

	it("adds the new rule before retiring the old one, rule by rule", () => {
		const supplierChange = startChange({
			prev: config,
			next: { ...config, suppliers: [acme] },
			existingRules: { ordinary: 4, large: 5 },
		})!
		expect(remainingSteps(supplierChange)).toEqual([
			{ rule: "ordinary", action: "add" },
			{ rule: "ordinary", action: "remove" },
			{ rule: "large", action: "add" },
			{ rule: "large", action: "remove" },
		])
		expect(nextStep(supplierChange)).toEqual({
			rule: "ordinary",
			action: "add",
		})
	})

	it("resumes where it stopped and ends when every rule is replaced", () => {
		let pending = plan()
		expect(remainingSteps(pending)).toHaveLength(2)
		expect(canDiscard(pending)).toBe(true)

		pending = withAdded(pending, "ordinary", 9, "add-hash")
		expect(nextStep(pending)).toEqual({ rule: "ordinary", action: "remove" })
		// A rule was added: dropping the change would leave two rules behind.
		expect(canDiscard(pending)).toBe(false)

		pending = withRemoved(pending, "ordinary", "remove-hash")
		expect(nextStep(pending)).toBeUndefined()
		expect(remainingSteps(pending)).toEqual([])
	})

	it("does not change the pending object it is given", () => {
		const pending = plan()
		withAdded(pending, "ordinary", 9, "h")
		expect(pending.swaps[0]).toEqual({ rule: "ordinary", oldId: 4 })
	})

	it("writes the audit trail with hashes and the cap context", () => {
		let pending = plan()
		pending = withAdded(pending, "ordinary", 9, "add-hash")
		pending = withRemoved(pending, "ordinary", "remove-hash")
		expect(changeRecords(pending)).toEqual([
			{
				field: "cap30d",
				rule: "ordinary",
				previous: "1000",
				next: "1500",
				spentAtChange: 500,
				periodStart: "2026-10-01T00:00:00.000Z",
				addTxHash: "add-hash",
				removeTxHash: "remove-hash",
			},
		])
	})

	it("replaces rules without a change and leaves no audit entry", () => {
		const migration = startMigration({
			config,
			existingRules: { ordinary: 4, large: 5 },
			rules: ["ordinary"],
		})
		expect(migration.swaps).toEqual([{ rule: "ordinary", oldId: 4 }])
		expect(nextStep(migration)).toEqual({ rule: "ordinary", action: "add" })
		expect(changeRecords(migration)).toEqual([])
		expect(
			startMigration({ config, existingRules: {}, rules: ["ordinary"] }).swaps,
		).toEqual([])
	})

	it("records a supplier change once per rule that was replaced", () => {
		let pending = startChange({
			prev: config,
			next: { ...config, suppliers: [acme] },
			existingRules: { ordinary: 4, large: 5 },
		})!
		pending = withRemoved(
			withAdded(pending, "ordinary", 8, "a1"),
			"ordinary",
			"r1",
		)
		pending = withRemoved(withAdded(pending, "large", 9, "a2"), "large", "r2")
		const records = changeRecords(pending)
		expect(
			records.map((r) => [r.field, r.rule, r.addTxHash, r.removeTxHash]),
		).toEqual([
			["suppliers", "ordinary", "a1", "r1"],
			["suppliers", "large", "a2", "r2"],
		])
		expect(records[0]).not.toHaveProperty("spentAtChange")
	})
})
