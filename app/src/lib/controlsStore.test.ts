import { describe, expect, it } from "vitest"
import { DEFAULT_LIMITS } from "../controls/defaults"
import { startChange } from "../controls/settings"
import { type ControlsConfig } from "../controls/types"
import { controlsStore } from "./controlsStore"

const A = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI"

const config: ControlsConfig = {
	limits: DEFAULT_LIMITS,
	suppliers: [{ address: A, label: "Acme", kind: "demo" }],
}

function memory() {
	const data = new Map<string, string>()
	return {
		data,
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		removeItem: (key: string) => void data.delete(key),
	}
}

describe("controlsStore", () => {
	it("returns the fallback until settings are saved", () => {
		expect(controlsStore(memory()).loadConfig(config)).toBe(config)
	})

	it("saves and loads the settings with their supplier labels", () => {
		const storage = memory()
		const next: ControlsConfig = {
			...config,
			limits: { ...DEFAULT_LIMITS, cap30d: 1_500 },
		}
		controlsStore(storage).saveConfig(next)
		expect(controlsStore(storage).loadConfig(config)).toEqual(next)
	})

	it("falls back when the saved settings are corrupt or the wrong shape", () => {
		const storage = memory()
		storage.setItem("arqueo.controls", "{not json")
		expect(controlsStore(storage).loadConfig(config)).toBe(config)
		storage.setItem(
			"arqueo.controls",
			JSON.stringify({ limits: {}, suppliers: 3 }),
		)
		expect(controlsStore(storage).loadConfig(config)).toBe(config)
	})

	it("keeps a pending change until it is cleared", () => {
		const storage = memory()
		const store = controlsStore(storage)
		const pending = startChange({
			prev: config,
			next: { ...config, limits: { ...DEFAULT_LIMITS, cap30d: 1_500 } },
			existingRules: { ordinary: 4 },
		})!
		expect(store.loadPending()).toBeNull()
		store.savePending(pending)
		expect(controlsStore(storage).loadPending()).toEqual(pending)
		store.clearPending()
		expect(store.loadPending()).toBeNull()
	})

	it("ignores a pending change that is corrupt", () => {
		const storage = memory()
		storage.setItem("arqueo.pendingChange", JSON.stringify({ swaps: [] }))
		expect(controlsStore(storage).loadPending()).toBeNull()
	})
})
