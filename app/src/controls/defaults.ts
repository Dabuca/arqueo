import { type ControlsConfig, type Limits } from "./types"

export const DEFAULT_LIMITS: Limits = {
	maxPerPayment: 500,
	cap30d: 1000,
	periodDays: 30,
}

export const DEFAULT_CONFIG: ControlsConfig = {
	limits: DEFAULT_LIMITS,
	suppliers: [],
}

/**
 * Amounts (XLM) for the demo scenes, tuned to the default limits.
 * 800 exceeds the 500 per-payment maximum without exceeding the 1,000
 * 30-day cap (not even after the 200 of scene 1 is spent), so scene 2 is
 * rejected because of the maximum and the "manager approval required"
 * message is shown.
 */
export const DEMO_AMOUNTS = { below: 200, above: 800, unknown: 100 } as const
