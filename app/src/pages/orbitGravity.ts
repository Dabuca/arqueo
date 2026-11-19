// "Gravity on" for the hero logo: glyphs fall onto the payment panel, bounce,
// pile up like sand and fly back home when the page returns to the top.
// All positions are page (document) coordinates, so the pile scrolls with the page.
import { ORBIT_ROWS } from "./orbitAscii"
import { type GlyphLayer, type Point } from "./orbitScatter"

export type Phase = "assembled" | "falling" | "fallen" | "rising"

type ParticleState = "waiting" | "flying" | "resting" | "gone" | "rising" | "home"

interface Placement extends Point {
	angle: number
}

export interface FallGlyph {
	char: string
	layer: GlyphLayer
	index: number
	row: number
	home: Point
}

export interface Particle extends FallGlyph, Placement {
	state: ParticleState
	vx: number
	vy: number
	spin: number
	/** Seconds after the fall starts before this glyph lets go. */
	delay: number
	/** Distance from the panel's top edge while resting. */
	restOffset: number
	/** Where a rise started, and when this glyph sets off. */
	from: Placement
	riseDelay: number
}

export interface World {
	particles: Particle[]
	/** Pile height per column bin along the panel's top edge. */
	heights: number[]
	time: number
}

/** The landing surface: the top edge of the payment panel. */
export interface Floor {
	top: number
	left: number
	right: number
	cellWidth: number
	lineHeight: number
}

export interface PhaseInput {
	scrollY: number
	settled: boolean
	risen: boolean
}

const TOP_THRESHOLD_PX = 1
const GRAVITY = 2400
const MAX_DELAY_S = 0.3
const ROW_STAGGER = 0.7
const POP_VX = 90
const POP_VY_MIN = 20
const POP_VY_MAX = 160
const MAX_SPIN = 5
const BOUNCE_MIN_VY = 140
const RESTITUTION = 0.38
const FRICTION = 0.55
const STACK_SHARE = 0.45
const SLIDE_SHARE = 0.9
const MAX_SLIDE_STEPS = 6
const FALL_OUT_PX = 1200
const RISE_DURATION_S = 0.9
const RISE_MAX_DELAY_S = 0.35
const BACK_OVERSHOOT = 1.4

function hash(index: number, salt: number): number {
	const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453
	return value - Math.floor(value)
}

function signed(index: number, salt: number): number {
	return hash(index, salt) * 2 - 1
}

function easeOutBack(t: number): number {
	const c = BACK_OVERSHOOT
	return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}

export function nextPhase(phase: Phase, { scrollY, settled, risen }: PhaseInput): Phase {
	const atTop = scrollY <= TOP_THRESHOLD_PX
	switch (phase) {
		case "assembled":
			return atTop ? "assembled" : "falling"
		case "falling":
			if (atTop) return "rising"
			return settled ? "fallen" : "falling"
		case "fallen":
			return atTop ? "rising" : "fallen"
		case "rising":
			if (!atTop) return "falling"
			return risen ? "assembled" : "rising"
	}
}

function launch(p: Particle): Particle {
	return {
		...p,
		state: "flying",
		vx: signed(p.index, 1) * POP_VX,
		vy: -(POP_VY_MIN + hash(p.index, 2) * (POP_VY_MAX - POP_VY_MIN)),
		spin: signed(p.index, 3) * MAX_SPIN,
	}
}

/** Glyphs at home, waiting to let go: bottom rows first, with some jitter. */
export function createFall(glyphs: readonly FallGlyph[]): World {
	const raw = glyphs.map((g) => {
		const fromBottom = 1 - g.row / (ORBIT_ROWS - 1)
		return (fromBottom * ROW_STAGGER + hash(g.index, 4) * (1 - ROW_STAGGER)) * MAX_DELAY_S
	})
	// The lowest glyph lets go on the first frame, so the fall answers the scroll at once.
	const first = raw.length > 0 ? Math.min(...raw) : 0
	const particles = glyphs.map((g, i): Particle => {
		const delay = (raw[i] ?? 0) - first
		const home = { ...g.home, angle: 0 }
		return {
			...g,
			...home,
			state: "waiting",
			vx: 0,
			vy: 0,
			spin: 0,
			delay,
			restOffset: 0,
			from: home,
			riseDelay: 0,
		}
	})
	return { particles, heights: [], time: 0 }
}

/** Drops every glyph from wherever it is right now (e.g. mid-rise). */
export function beginFall(world: World): World {
	const particles = world.particles.map((p) => launch({ ...p, delay: 0 }))
	return { particles, heights: [], time: 0 }
}

function binCount(floor: Floor): number {
	return Math.max(0, Math.ceil((floor.right - floor.left) / floor.cellWidth))
}

function surface(floor: Floor, heights: readonly number[], bin: number): number {
	return floor.top - floor.lineHeight / 2 - (heights[bin] ?? 0)
}

// Like sand: a glyph on a steep spot slides to a lower neighbouring column.
function slide(heights: readonly number[], bin: number, floor: Floor): number {
	const limit = floor.lineHeight * SLIDE_SHARE
	let current = bin
	for (let step = 0; step < MAX_SLIDE_STEPS; step++) {
		const here = heights[current] ?? 0
		const options = [current - 1, current + 1].filter((b) => b >= 0 && b < heights.length)
		const lowest = options.reduce(
			(best, b) => ((heights[b] ?? 0) < (heights[best] ?? 0) ? b : best),
			current,
		)
		if (lowest === current || here - (heights[lowest] ?? 0) <= limit) break
		current = lowest
	}
	return current
}

function settle(p: Particle, bin: number, floor: Floor, heights: number[]): Particle {
	const target = slide(heights, bin, floor)
	const x = target === bin ? p.x : floor.left + (target + 0.5) * floor.cellWidth
	const y = surface(floor, heights, target)
	heights[target] = (heights[target] ?? 0) + floor.lineHeight * STACK_SHARE
	return { ...p, state: "resting", x, y, vx: 0, vy: 0, spin: 0, restOffset: floor.top - y }
}

function fly(p: Particle, dt: number, floor: Floor, heights: number[]): Particle {
	const vy = p.vy + GRAVITY * dt
	const moved = { ...p, vy, x: p.x + p.vx * dt, y: p.y + vy * dt, angle: p.angle + p.spin * dt }
	const overPanel = moved.x >= floor.left && moved.x < floor.right
	if (overPanel && vy > 0) {
		const bin = Math.floor((moved.x - floor.left) / floor.cellWidth)
		const ground = surface(floor, heights, bin)
		if (moved.y >= ground) {
			if (vy <= BOUNCE_MIN_VY) return settle(moved, bin, floor, heights)
			return {
				...moved,
				y: ground,
				vy: -vy * RESTITUTION,
				vx: moved.vx * FRICTION,
				spin: moved.spin * FRICTION,
			}
		}
	}
	if (moved.y > floor.top + FALL_OUT_PX) return { ...moved, state: "gone" }
	return moved
}

/** Advances the fall by `dt` seconds against the panel's current position. */
export function stepFall(world: World, dt: number, floor: Floor): World {
	const time = world.time + dt
	const bins = binCount(floor)
	const heights = world.heights.length === bins ? [...world.heights] : Array<number>(bins).fill(0)
	const particles = world.particles.map((p): Particle => {
		switch (p.state) {
			case "waiting":
				return time >= p.delay ? launch(p) : p
			case "flying":
				return fly(p, dt, floor, heights)
			case "resting":
				return { ...p, y: floor.top - p.restOffset }
			default:
				return p
		}
	})
	return { particles, heights, time }
}

export function isSettled(world: World): boolean {
	return world.particles.every((p) => p.state !== "waiting" && p.state !== "flying")
}

/** Every glyph sets off home from where it lies, with a little stagger. */
export function beginRise(world: World): World {
	const particles = world.particles.map(
		(p): Particle => ({
			...p,
			state: "rising",
			from: { x: p.x, y: p.y, angle: p.angle },
			riseDelay: hash(p.index, 5) * RISE_MAX_DELAY_S,
		}),
	)
	return { particles, heights: [], time: 0 }
}

/** Advances the rise; glyphs overshoot home slightly before settling into it. */
export function stepRise(world: World, dt: number): World {
	const time = world.time + dt
	const particles = world.particles.map((p): Particle => {
		if (p.state !== "rising") return p
		const t = Math.min(1, Math.max(0, (time - p.riseDelay) / RISE_DURATION_S))
		if (t >= 1) return { ...p, ...p.home, angle: 0, state: "home" }
		const e = easeOutBack(t)
		return {
			...p,
			x: p.from.x + (p.home.x - p.from.x) * e,
			y: p.from.y + (p.home.y - p.from.y) * e,
			angle: p.from.angle * (1 - t),
		}
	})
	return { particles, heights: world.heights, time }
}

export function isRisen(world: World): boolean {
	return world.particles.every((p) => p.state === "home")
}
