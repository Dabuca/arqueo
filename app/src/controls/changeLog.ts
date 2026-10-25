import type { ControlChange } from "./types"

type ChangeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

const STORAGE_KEY = "arqueo.controlChanges"

const CSV_COLUMNS = [
	"at",
	"field",
	"previous",
	"next",
	"spentAtChange",
	"periodStart",
	"removeTxHash",
	"addTxHash",
] as const

function defaultStorage(): ChangeStorage | null {
	try {
		return globalThis.localStorage ?? null
	} catch {
		return null
	}
}

/**
 * Settings change log shown to the auditor. Persists to storage when it can
 * and falls back to memory when storage is missing, blocked or corrupt.
 * Entries are kept oldest first internally; `list` returns newest first.
 */
export function createChangeLog(storage?: ChangeStorage | null) {
	const store = storage === undefined ? defaultStorage() : storage
	let changes: ControlChange[] = []

	try {
		const raw = store?.getItem(STORAGE_KEY)
		const parsed: unknown = raw ? JSON.parse(raw) : []
		if (Array.isArray(parsed)) changes = parsed as ControlChange[]
	} catch {
		changes = []
	}

	function persist() {
		try {
			store?.setItem(STORAGE_KEY, JSON.stringify(changes))
		} catch {
			// Storage blocked or full: keep the in-memory log.
		}
	}

	return {
		record(
			input: Omit<ControlChange, "id" | "at">,
			now: Date = new Date(),
		): ControlChange {
			const change: ControlChange = {
				...input,
				id: crypto.randomUUID(),
				at: now.toISOString(),
			}
			changes = [...changes, change]
			persist()
			return change
		},
		list(): ControlChange[] {
			return [...changes].reverse()
		},
		clear() {
			changes = []
			try {
				store?.removeItem(STORAGE_KEY)
			} catch {
				// Nothing to remove if storage is unavailable.
			}
		},
	}
}

function csvField(value: string | number | undefined): string {
	if (value === undefined) return ""
	const text = String(value)
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function changesToCsv(changes: ControlChange[]): string {
	const rows = changes.map((change) =>
		CSV_COLUMNS.map((column) => csvField(change[column])).join(","),
	)
	return [CSV_COLUMNS.join(","), ...rows].join("\n")
}
