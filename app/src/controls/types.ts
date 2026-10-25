// One definition for the whole app: stellar.ts owns these (AGENTS.md §6.1).
// Type-only, so nothing from the network layer is loaded at runtime.
export type { Role, RuleName } from "../lib/stellar"

/** Limits set by the admin. Amounts in XLM. They apply to the `ordinary` rule. */
export interface Limits {
	maxPerPayment: number
	cap30d: number
	periodDays: number
}

export interface Supplier {
	address: string // G...
	label: string
	kind: "demo" | "real"
}

export interface ControlsConfig {
	limits: Limits
	suppliers: Supplier[]
}

export type ControlField = "maxPerPayment" | "cap30d" | "suppliers"

/** One change made in Settings. Shown to the auditor. */
export interface ControlChange {
	id: string
	at: string // ISO date
	field: ControlField
	previous: string
	next: string
	spentAtChange?: number // XLM, only for cap30d
	periodStart?: string // ISO date, only for cap30d
	removeTxHash?: string
	addTxHash?: string
}

export type CheckResult = { ok: true } | { ok: false; reason: string }
