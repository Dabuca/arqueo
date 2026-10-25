import { LEDGERS_PER_DAY } from "./defaults"
import { type ControlParamValues } from "./params"
import {
	type CheckResult,
	type ControlChange,
	type ControlField,
	type ControlsConfig,
	type RuleName,
	type Supplier,
} from "./types"
import { roundToStroops, stroopsToXlm } from "./units"
import { looksLikeStellarAddress, validateLimitsChange } from "./validation"

// The Settings flow as plain data (R17, AGENTS.md §3.1). Nothing here touches
// the network: src/lib/stellar.ts runs the steps this file plans.
//
// A change never edits a rule in place. For each affected rule the new one is
// added first and the old one retired after, so there is never a moment with
// the rule open. The amount spent in the cap period belongs to the account,
// not to a rule, so the replacement keeps counting from it.

/** Most suppliers the allowlist accepts: it is stored whole on chain. */
export const MAX_SUPPLIERS = 20

/** Seconds per ledger, to estimate dates from ledger numbers. Approximate. */
export const SECONDS_PER_LEDGER = 5

const RULE_ORDER: RuleName[] = ["ordinary", "large"]

const sameAmount = (a: number, b: number) =>
	roundToStroops(a) === roundToStroops(b)

/** Which settings differ. Supplier labels do not count: they are not on chain. */
export function changedFields(
	prev: ControlsConfig,
	next: ControlsConfig,
): ControlField[] {
	const fields: ControlField[] = []
	if (!sameAmount(prev.limits.maxPerPayment, next.limits.maxPerPayment)) {
		fields.push("maxPerPayment")
	}
	if (!sameAmount(prev.limits.cap30d, next.limits.cap30d)) {
		fields.push("cap30d")
	}
	const before = new Set(prev.suppliers.map((s) => s.address))
	const after = new Set(next.suppliers.map((s) => s.address))
	if (
		before.size !== after.size ||
		[...after].some((address) => !before.has(address))
	) {
		fields.push("suppliers")
	}
	return fields
}

/** The rules a setting is enforced by: limits live in `ordinary`, suppliers in both. */
export function rulesForField(field: ControlField): RuleName[] {
	return field === "suppliers" ? ["ordinary", "large"] : ["ordinary"]
}

/** The rules to replace for a set of changed settings, in the order they run. */
export function rulesToSwap(fields: ControlField[]): RuleName[] {
	const affected = new Set(fields.flatMap(rulesForField))
	return RULE_ORDER.filter((rule) => affected.has(rule))
}

/**
 * Checks a draft before anything is sent. The cap cannot go below what is
 * already spent (the contract checks it too, with error 4), and the allowlist
 * cannot be empty: no suppliers would mean nobody can be paid.
 */
export function validateSettings(
	next: ControlsConfig,
	spentInPeriod: number,
): CheckResult {
	const limits = validateLimitsChange(next.limits, spentInPeriod)
	if (!limits.ok) return limits
	if (next.suppliers.length === 0) {
		return {
			ok: false,
			reason: "Keep at least one supplier: with none, nobody can be paid",
		}
	}
	if (next.suppliers.length > MAX_SUPPLIERS) {
		return {
			ok: false,
			reason: `At most ${MAX_SUPPLIERS} suppliers are supported`,
		}
	}
	const seen = new Set<string>()
	for (const supplier of next.suppliers) {
		if (!looksLikeStellarAddress(supplier.address)) {
			return {
				ok: false,
				reason: `Invalid supplier address: ${supplier.address}`,
			}
		}
		if (seen.has(supplier.address)) {
			return { ok: false, reason: `Supplier listed twice: ${supplier.address}` }
		}
		seen.add(supplier.address)
	}
	return { ok: true }
}

const shortAddress = (address: string) =>
	`${address.slice(0, 6)}…${address.slice(-6)}`

/** A setting as the text the auditor sees in the change trail. */
export function describeValue(
	field: ControlField,
	config: ControlsConfig,
): string {
	if (field === "maxPerPayment") return String(config.limits.maxPerPayment)
	if (field === "cap30d") return String(config.limits.cap30d)
	return (
		config.suppliers
			.map((s) => `${s.label || "Unnamed"} (${shortAddress(s.address)})`)
			.join("; ") || "none"
	)
}

/**
 * The settings the chain enforces, from what is installed on the `ordinary`
 * rule. Labels are not on chain: they come from the addresses already known.
 */
export function configFromParams(
	params: ControlParamValues,
	known: Supplier[],
): ControlsConfig {
	if (params.maxPerPayment === null || params.capPerPeriod === null) {
		throw new Error("The ordinary rule has no per-payment maximum or cap")
	}
	return {
		limits: {
			maxPerPayment: Number(stroopsToXlm(params.maxPerPayment)),
			cap30d: Number(stroopsToXlm(params.capPerPeriod)),
			periodDays: Math.round(params.periodLedgers / LEDGERS_PER_DAY),
		},
		suppliers: params.allowlist.map(
			(address) =>
				known.find((s) => s.address === address) ?? {
					address,
					label: "",
					kind: "real",
				},
		),
	}
}

/** When a ledger closed, estimated from the current ledger. Approximate. */
export function ledgerToDate(
	ledger: number,
	currentLedger: number,
	now: Date = new Date(),
): Date {
	return new Date(
		now.getTime() - (currentLedger - ledger) * SECONDS_PER_LEDGER * 1000,
	)
}

/** The step of retiring `oldId` and installing its replacement `newId`. */
export interface RuleSwap {
	rule: RuleName
	oldId: number
	/** Set once the replacement rule is on chain. */
	newId?: number
	addHash?: string
	/** Set once the old rule is retired. */
	removeHash?: string
}

/** A settings change in progress. Saved after every step so it can resume. */
export interface PendingChange {
	startedAt: string
	prev: ControlsConfig
	next: ControlsConfig
	fields: ControlField[]
	swaps: RuleSwap[]
	/** Cap context for the audit trail, read before the first step. */
	spentAtChange?: number
	periodStart?: string
}

export type Step = { rule: RuleName; action: "add" | "remove" }

/**
 * Plans a change. Only rules that exist are swapped: a rule created later is
 * built from the saved settings. Returns null when nothing changed.
 */
export function startChange(input: {
	prev: ControlsConfig
	next: ControlsConfig
	existingRules: Partial<Record<RuleName, number>>
	spentAtChange?: number
	periodStart?: string
	now?: Date
}): PendingChange | null {
	const fields = changedFields(input.prev, input.next)
	if (fields.length === 0) return null
	const swaps: RuleSwap[] = []
	for (const rule of rulesToSwap(fields)) {
		const oldId = input.existingRules[rule]
		if (oldId !== undefined) swaps.push({ rule, oldId })
	}
	return {
		startedAt: (input.now ?? new Date()).toISOString(),
		prev: input.prev,
		next: input.next,
		fields,
		swaps,
		spentAtChange: input.spentAtChange,
		periodStart: input.periodStart,
	}
}

/**
 * Replaces rules without changing any setting: for rules that were created
 * with an older `control-policy`, or without one. Same steps as a change, no
 * entry in the audit trail (nothing the admin set has changed).
 */
export function startMigration(input: {
	config: ControlsConfig
	existingRules: Partial<Record<RuleName, number>>
	rules: RuleName[]
	now?: Date
}): PendingChange {
	const swaps: RuleSwap[] = []
	for (const rule of RULE_ORDER) {
		const oldId = input.existingRules[rule]
		if (input.rules.includes(rule) && oldId !== undefined) {
			swaps.push({ rule, oldId })
		}
	}
	return {
		startedAt: (input.now ?? new Date()).toISOString(),
		prev: input.config,
		next: input.config,
		fields: [],
		swaps,
	}
}

/** The next transaction to send, or undefined when the change is complete. */
export function nextStep(pending: PendingChange): Step | undefined {
	for (const swap of pending.swaps) {
		if (swap.newId === undefined) return { rule: swap.rule, action: "add" }
		if (swap.removeHash === undefined) {
			return { rule: swap.rule, action: "remove" }
		}
	}
	return undefined
}

/** Steps still to send, for the progress list. */
export function remainingSteps(pending: PendingChange): Step[] {
	return pending.swaps.flatMap((swap) => {
		const steps: Step[] = []
		if (swap.newId === undefined) steps.push({ rule: swap.rule, action: "add" })
		if (swap.removeHash === undefined) {
			steps.push({ rule: swap.rule, action: "remove" })
		}
		return steps
	})
}

/** Marks the replacement rule as added. Returns a new object. */
export function withAdded(
	pending: PendingChange,
	rule: RuleName,
	newId: number,
	hash: string,
): PendingChange {
	return {
		...pending,
		swaps: pending.swaps.map((swap) =>
			swap.rule === rule ? { ...swap, newId, addHash: hash } : swap,
		),
	}
}

/** Marks the old rule as retired. Returns a new object. */
export function withRemoved(
	pending: PendingChange,
	rule: RuleName,
	hash: string,
): PendingChange {
	return {
		...pending,
		swaps: pending.swaps.map((swap) =>
			swap.rule === rule ? { ...swap, removeHash: hash } : swap,
		),
	}
}

/**
 * Whether the change can be dropped without touching the chain: no
 * replacement rule was added yet, so nothing is left half done.
 */
export function canDiscard(pending: PendingChange): boolean {
	return pending.swaps.every((swap) => swap.newId === undefined)
}

/**
 * The change trail for the auditor: one entry per setting and per rule that
 * was replaced, with the hashes of its add and remove transactions.
 */
export function changeRecords(
	pending: PendingChange,
): Omit<ControlChange, "id" | "at">[] {
	const records: Omit<ControlChange, "id" | "at">[] = []
	for (const field of pending.fields) {
		for (const swap of pending.swaps) {
			if (!rulesForField(field).includes(swap.rule)) continue
			records.push({
				field,
				rule: swap.rule,
				previous: describeValue(field, pending.prev),
				next: describeValue(field, pending.next),
				...(field === "cap30d"
					? {
							spentAtChange: pending.spentAtChange,
							periodStart: pending.periodStart,
						}
					: {}),
				addTxHash: swap.addHash,
				removeTxHash: swap.removeHash,
			})
		}
	}
	return records
}
