import { describe, expect, it } from "vitest"
import { ellipseHalfHeight, ringDrop, ringFallKeyframes } from "./orbitRings"

describe("ellipseHalfHeight", () => {
	it("is half the height when the ellipse is level", () => {
		expect(ellipseHalfHeight(200, 100, 0)).toBeCloseTo(50)
	})

	it("is half the width when the ellipse stands upright", () => {
		expect(ellipseHalfHeight(200, 100, 90)).toBeCloseTo(100)
	})

	it("lies between both semi-axes when tilted", () => {
		const half = ellipseHalfHeight(200, 100, -28)
		expect(half).toBeGreaterThan(50)
		expect(half).toBeLessThan(100)
	})
})

describe("ringDrop", () => {
	it("drops the ring until its lowest point touches the floor", () => {
		const ring = { centerY: 300, width: 200, height: 100 }
		expect(ringDrop(ring, 0, 1000)).toBeCloseTo(1000 - 300 - 50)
	})

	it("never lifts a ring that already sits below the floor", () => {
		const ring = { centerY: 1200, width: 200, height: 100 }
		expect(ringDrop(ring, 0, 1000)).toBe(0)
	})
})

describe("ringFallKeyframes", () => {
	it("starts at home and ends on the floor with the landing tilt", () => {
		const frames = ringFallKeyframes(500, -28, -4)
		expect(frames[0]?.transform).toBe("translateY(0px) rotate(-28deg)")
		expect(frames.at(-1)?.transform).toBe("translateY(500px) rotate(-4deg)")
		expect(frames.at(-1)?.offset).toBe(1)
	})

	it("bounces back up once before settling", () => {
		const frames = ringFallKeyframes(500, -28, -4)
		const ys = frames.map((f) => Number(/translateY\((-?[\d.]+)px\)/.exec(String(f.transform))?.[1]))
		const firstHit = ys.indexOf(500)
		expect(firstHit).toBeGreaterThan(0)
		expect(Math.min(...ys.slice(firstHit))).toBeLessThan(500)
	})

	it("keeps offsets increasing", () => {
		const offsets = ringFallKeyframes(500, -28, -4).map((f) => Number(f.offset))
		expect(offsets).toEqual([...offsets].sort((a, b) => a - b))
	})
})
