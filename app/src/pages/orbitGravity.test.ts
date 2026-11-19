import { describe, expect, it } from "vitest"
import {
	beginFall,
	beginRise,
	createFall,
	isRisen,
	isSettled,
	nextPhase,
	stepFall,
	stepRise,
	type FallGlyph,
	type Floor,
	type Phase,
	type World,
} from "./orbitGravity"

const FLOOR: Floor = { top: 1000, left: 0, right: 1200, cellWidth: 6, lineHeight: 12 }
const STEP = 1 / 60

function glyph(index: number, row: number, home: { x: number; y: number }): FallGlyph {
	return { char: "#", layer: "light", index, row, home }
}

function run(world: World, seconds: number, floor: Floor = FLOOR): World {
	let next = world
	for (let t = 0; t < seconds; t += STEP) next = stepFall(next, STEP, floor)
	return next
}

function runRise(world: World, seconds: number): World {
	let next = world
	for (let t = 0; t < seconds; t += STEP) next = stepRise(next, STEP)
	return next
}

describe("nextPhase", () => {
	const top = { scrollY: 0, settled: false, risen: false }
	const down = { scrollY: 40, settled: false, risen: false }
	const cases: [Phase, typeof top, Phase][] = [
		["assembled", top, "assembled"],
		["assembled", down, "falling"],
		["falling", down, "falling"],
		["falling", { ...down, settled: true }, "fallen"],
		["falling", top, "rising"],
		["fallen", down, "fallen"],
		["fallen", top, "rising"],
		["rising", top, "rising"],
		["rising", { ...top, risen: true }, "assembled"],
		["rising", down, "falling"],
	]
	it.each(cases)("%s with %o becomes %s", (phase, input, expected) => {
		expect(nextPhase(phase, input)).toBe(expected)
	})
})

describe("createFall", () => {
	it("starts every glyph at home, upright and not yet released", () => {
		const world = createFall([glyph(1, 0, { x: 10, y: 20 })])
		expect(world.particles[0]).toMatchObject({ x: 10, y: 20, angle: 0, state: "waiting" })
	})

	it("releases the first glyph the moment the fall starts", () => {
		const glyphs = Array.from({ length: 40 }, (_, i) => glyph(i, 10 + (i % 20), { x: i, y: 0 }))
		const delays = createFall(glyphs).particles.map((p) => p.delay)
		expect(Math.min(...delays)).toBe(0)
		expect(Math.max(...delays)).toBeLessThanOrEqual(0.3)
	})

	it("releases lower rows before upper rows", () => {
		const low = Array.from({ length: 40 }, (_, i) => glyph(i, 39, { x: i, y: 0 }))
		const high = Array.from({ length: 40 }, (_, i) => glyph(100 + i, 0, { x: i, y: 0 }))
		const world = createFall([...low, ...high])
		const mean = (from: number, to: number) =>
			world.particles.slice(from, to).reduce((sum, p) => sum + p.delay, 0) / 40
		expect(mean(0, 40)).toBeLessThan(mean(40, 80))
	})
})

describe("stepFall", () => {
	it("does not mutate the world it is given", () => {
		const world = createFall([glyph(1, 39, { x: 100, y: 100 })])
		const snapshot = structuredClone(world)
		run(world, 1)
		expect(world).toEqual(snapshot)
	})

	it("lets a released glyph fall faster and faster", () => {
		let world = createFall([glyph(1, 39, { x: 100, y: 100 })])
		world = run(world, 0.6)
		const a = world.particles[0]?.y ?? 0
		world = run(world, 0.1)
		const b = world.particles[0]?.y ?? 0
		world = run(world, 0.1)
		const c = world.particles[0]?.y ?? 0
		expect(c - b).toBeGreaterThan(b - a)
	})

	it("lands glyphs above the panel on its top edge and keeps them there", () => {
		const world = run(createFall([glyph(1, 39, { x: 600, y: 300 })]), 5)
		const p = world.particles[0]
		expect(p?.state).toBe("resting")
		expect(p?.y ?? 0).toBeLessThan(FLOOR.top)
		expect(p?.y ?? 0).toBeGreaterThan(FLOOR.top - FLOOR.lineHeight * 2)
		expect(isSettled(world)).toBe(true)
	})

	it("moves resting glyphs with the panel when the page scrolls or reflows", () => {
		const world = run(createFall([glyph(1, 39, { x: 600, y: 300 })]), 5)
		const moved = stepFall(world, STEP, { ...FLOOR, top: FLOOR.top + 50 })
		expect((moved.particles[0]?.y ?? 0) - (world.particles[0]?.y ?? 0)).toBeCloseTo(50)
	})

	it("piles glyphs that land in the same spot on top of each other", () => {
		const glyphs = Array.from({ length: 200 }, (_, i) => glyph(i, 39, { x: 600, y: 300 }))
		const world = run(createFall(glyphs), 6)
		const ys = world.particles.map((p) => p.y)
		expect(Math.min(...ys)).toBeLessThan(FLOOR.top - FLOOR.lineHeight * 2)
	})

	it("lets glyphs beside the panel fall past it and disappear", () => {
		const world = run(createFall([glyph(1, 39, { x: 1500, y: 300 })]), 6)
		expect(world.particles[0]?.state).toBe("gone")
		expect(isSettled(world)).toBe(true)
	})
})

describe("rising", () => {
	it("starts from where the glyphs lie and ends exactly at home, upright", () => {
		const fallen = run(createFall([glyph(1, 39, { x: 600, y: 300 })]), 5)
		const rising = beginRise(fallen)
		expect(rising.particles[0]).toMatchObject({
			x: fallen.particles[0]?.x,
			y: fallen.particles[0]?.y,
		})
		expect(isRisen(rising)).toBe(false)
		const done = runRise(rising, 3)
		expect(done.particles[0]).toMatchObject({ x: 600, y: 300, angle: 0 })
		expect(isRisen(done)).toBe(true)
	})

	it("can fall again from mid-air when the user scrolls down during the rise", () => {
		const fallen = run(createFall([glyph(1, 39, { x: 600, y: 300 })]), 5)
		const midway = runRise(beginRise(fallen), 0.3)
		const again = beginFall(midway)
		expect(again.particles[0]).toMatchObject({
			x: midway.particles[0]?.x,
			y: midway.particles[0]?.y,
		})
		expect(run(again, 5).particles[0]?.state).toBe("resting")
	})
})
