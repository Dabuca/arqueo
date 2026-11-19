import { describe, expect, it } from "vitest"
import { ORBIT_COLS, ORBIT_ROWS, renderOrbitFrame } from "./orbitAscii"

const LAYERS = ["light", "shade", "amber"] as const

function cells(text: string): string[][] {
	return text.split("\n").map((line) => [...line])
}

describe("renderOrbitFrame", () => {
	it("returns three layers with a fixed character grid", () => {
		const frame = renderOrbitFrame(0)
		for (const layer of LAYERS) {
			const rows = cells(frame[layer])
			expect(rows).toHaveLength(ORBIT_ROWS)
			for (const row of rows) expect(row).toHaveLength(ORBIT_COLS)
		}
	})

	it("never draws two layers on the same cell", () => {
		for (const time of [0, 1300, 4200, 9100]) {
			const frame = renderOrbitFrame(time)
			const grids = LAYERS.map((layer) => cells(frame[layer]))
			for (let y = 0; y < ORBIT_ROWS; y++) {
				for (let x = 0; x < ORBIT_COLS; x++) {
					const drawn = grids.filter((grid) => grid[y]?.[x] !== " ")
					expect(drawn.length).toBeLessThanOrEqual(1)
				}
			}
		}
	})

	it("draws the planet in both lit and shaded characters", () => {
		const frame = renderOrbitFrame(0)
		expect(frame.light.trim().length).toBeGreaterThan(200)
		expect(frame.shade.trim().length).toBeGreaterThan(100)
		expect(frame.amber.trim().length).toBeGreaterThan(0)
	})

	it("is deterministic for a given time and changes as time passes", () => {
		expect(renderOrbitFrame(2500)).toEqual(renderOrbitFrame(2500))
		expect(renderOrbitFrame(0)).not.toEqual(renderOrbitFrame(1500))
	})
})
