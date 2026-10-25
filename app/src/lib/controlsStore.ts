import { type PendingChange } from "../controls/settings"
import { type ControlsConfig, type Supplier } from "../controls/types"

// Browser-side memory of the Settings flow: the settings the admin last
// applied (they carry the supplier labels, which are not on chain) and a change
// that is half done. Network-free so it can be tested.

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

const CONFIG_KEY = "arqueo.controls"
const PENDING_KEY = "arqueo.pendingChange"

const isSupplier = (value: unknown): value is Supplier => {
	if (typeof value !== "object" || value === null) return false
	const s = value as Record<string, unknown>
	return (
		typeof s.address === "string" &&
		typeof s.label === "string" &&
		(s.kind === "demo" || s.kind === "real")
	)
}

const isConfig = (value: unknown): value is ControlsConfig => {
	if (typeof value !== "object" || value === null) return false
	const c = value as { limits?: Record<string, unknown>; suppliers?: unknown }
	return (
		typeof c.limits === "object" &&
		c.limits !== null &&
		typeof c.limits.maxPerPayment === "number" &&
		typeof c.limits.cap30d === "number" &&
		typeof c.limits.periodDays === "number" &&
		Array.isArray(c.suppliers) &&
		c.suppliers.every(isSupplier)
	)
}

function read(storage: KeyValueStorage, key: string): unknown {
	try {
		const raw = storage.getItem(key)
		return raw ? (JSON.parse(raw) as unknown) : undefined
	} catch {
		return undefined
	}
}

export function controlsStore(storage: KeyValueStorage) {
	return {
		/** The settings last applied, or `fallback` when none or corrupt. */
		loadConfig(fallback: ControlsConfig): ControlsConfig {
			const saved = read(storage, CONFIG_KEY)
			return isConfig(saved) ? saved : fallback
		},
		saveConfig(config: ControlsConfig): void {
			storage.setItem(CONFIG_KEY, JSON.stringify(config))
		},
		loadPending(): PendingChange | null {
			const saved = read(storage, PENDING_KEY) as PendingChange | undefined
			return saved &&
				isConfig(saved.prev) &&
				isConfig(saved.next) &&
				Array.isArray(saved.swaps) &&
				Array.isArray(saved.fields)
				? saved
				: null
		},
		savePending(pending: PendingChange): void {
			storage.setItem(PENDING_KEY, JSON.stringify(pending))
		},
		clearPending(): void {
			storage.removeItem(PENDING_KEY)
		},
	}
}
