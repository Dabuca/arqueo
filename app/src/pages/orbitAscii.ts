// Procedural ASCII rendering of the Arqueo orbit mark: a shaded planet that
// spins, a tilted orbit ring and a satellite that passes behind the planet.

export const ORBIT_COLS = 88
export const ORBIT_ROWS = 40

export interface OrbitFrame {
	light: string
	shade: string
	amber: string
}

type Layer = 0 | 1 | 2 | 3 // empty, light, shade, amber

// Flat row-major grid: cell (col, row) lives at row * ORBIT_COLS + col.
interface Canvas {
	chars: string[]
	layers: Layer[]
}

// A monospace cell is about twice as tall as it is wide.
const CELL_ASPECT = 2
const CENTER_COL = ORBIT_COLS / 2
const CENTER_ROW = ORBIT_ROWS / 2
const PLANET_RADIUS = 25
const RING_A = 41
const RING_B = 11
const RING_TILT = (-28 * Math.PI) / 180
const RING_STEP = 0.008
const DASH_COUNT = 34
const DASH_FILL = 0.62
const SPIN_SPEED = 0.00022
const DASH_SPEED = 0.00018
const SATELLITE_SPEED = 0.00045
const STAR_TWINKLE_SPEED = 0.0015
// Satellite head first, then its fading trail.
const TRAIL = ["@", "O", "o", "+", ":", "."]
const TRAIL_GAP = 0.05
const LIT_THRESHOLD = 0.14
const LIT_RAMP = ".:-=+*#%@"
const SHADE_RAMP = ".:-=+"
const LIGHT = normalize([-0.55, -0.45, 0.7])
const STARS = createStars(16)

function normalize([x, y, z]: readonly [number, number, number]) {
	const length = Math.hypot(x, y, z)
	return { x: x / length, y: y / length, z: z / length }
}

function fraction(value: number): number {
	return value - Math.floor(value)
}

function createStars(count: number) {
	return Array.from({ length: count }, (_, i) => ({
		col: Math.floor(fraction(Math.sin(i * 91.7 + 13.3) * 43758.5453) * ORBIT_COLS),
		row: Math.floor(fraction(Math.sin(i * 47.1 + 3.7) * 12543.123) * ORBIT_ROWS),
		phase: i * 1.9,
	}))
}

function pick(ramp: string, value: number): string {
	const clamped = Math.min(0.999, Math.max(0, value))
	return ramp.charAt(Math.floor(clamped * ramp.length))
}

function inBounds(col: number, row: number): boolean {
	return row >= 0 && row < ORBIT_ROWS && col >= 0 && col < ORBIT_COLS
}

function plot(canvas: Canvas, col: number, row: number, char: string, layer: Layer) {
	if (!inBounds(col, row)) return
	const index = row * ORBIT_COLS + col
	canvas.chars[index] = char
	canvas.layers[index] = layer
}

function isEmpty(canvas: Canvas, col: number, row: number): boolean {
	return canvas.layers[row * ORBIT_COLS + col] === 0
}

function insidePlanet(col: number, row: number): boolean {
	const wx = col + 0.5 - CENTER_COL
	const wy = (row + 0.5 - CENTER_ROW) * CELL_ASPECT
	return wx * wx + wy * wy < PLANET_RADIUS * PLANET_RADIUS
}

function ringPoint(t: number) {
	const px = RING_A * Math.cos(t)
	const py = RING_B * Math.sin(t)
	const x = px * Math.cos(RING_TILT) - py * Math.sin(RING_TILT)
	const y = px * Math.sin(RING_TILT) + py * Math.cos(RING_TILT)
	const col = Math.floor(CENTER_COL + x)
	const row = Math.floor(CENTER_ROW + y / CELL_ASPECT)
	const front = Math.sin(t) > 0
	return { col, row, front, hidden: !front && insidePlanet(col, row) }
}

function drawPlanet(canvas: Canvas, spin: number) {
	for (let row = 0; row < ORBIT_ROWS; row++) {
		for (let col = 0; col < ORBIT_COLS; col++) {
			if (!insidePlanet(col, row)) continue
			const nx = (col + 0.5 - CENTER_COL) / PLANET_RADIUS
			const ny = ((row + 0.5 - CENTER_ROW) * CELL_ASPECT) / PLANET_RADIUS
			const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
			const diffuse = nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z
			const lon = Math.atan2(nx, nz) + spin
			const lat = Math.asin(Math.max(-1, Math.min(1, ny)))
			const texture =
				0.5 + 0.5 * Math.sin(lon * 4 + Math.sin(lat * 3) * 1.6) * Math.cos(lat * 2.2)
			if (diffuse > LIT_THRESHOLD) {
				plot(canvas, col, row, pick(LIT_RAMP, diffuse * 0.9 + texture * 0.14), 1)
			} else {
				plot(canvas, col, row, pick(SHADE_RAMP, texture * 0.75 + 0.1), 2)
			}
		}
	}
}

function drawRing(canvas: Canvas, dashShift: number) {
	for (let t = 0; t < Math.PI * 2; t += RING_STEP) {
		if (fraction((t / (Math.PI * 2)) * DASH_COUNT - dashShift) > DASH_FILL) continue
		const p = ringPoint(t)
		if (!p.hidden) plot(canvas, p.col, p.row, p.front ? "+" : ".", 3)
	}
}

function drawSatellite(canvas: Canvas, angle: number) {
	// Paint the tail first so the satellite head always wins its cell.
	TRAIL.map((char, i) => ({ char, p: ringPoint(angle - i * TRAIL_GAP) }))
		.reverse()
		.forEach(({ char, p }) => {
			if (!p.hidden) plot(canvas, p.col, p.row, char, 3)
		})
}

function drawStars(canvas: Canvas, time: number) {
	for (const star of STARS) {
		if (!isEmpty(canvas, star.col, star.row)) continue
		const twinkle = Math.sin(time * STAR_TWINKLE_SPEED + star.phase)
		if (twinkle < 0.1) continue
		plot(canvas, star.col, star.row, twinkle > 0.75 ? "+" : ".", 2)
	}
}

function toLayer(canvas: Canvas, layer: Layer): string {
	const masked = canvas.chars.map((char, i) => (canvas.layers[i] === layer ? char : " "))
	return Array.from({ length: ORBIT_ROWS }, (_, row) =>
		masked.slice(row * ORBIT_COLS, (row + 1) * ORBIT_COLS).join(""),
	).join("\n")
}

/** Renders one frame; `time` is in milliseconds. */
export function renderOrbitFrame(time: number): OrbitFrame {
	const size = ORBIT_COLS * ORBIT_ROWS
	const canvas: Canvas = {
		chars: Array<string>(size).fill(" "),
		layers: Array<Layer>(size).fill(0),
	}
	drawPlanet(canvas, time * SPIN_SPEED)
	drawRing(canvas, time * DASH_SPEED * DASH_COUNT)
	drawSatellite(canvas, time * SATELLITE_SPEED)
	drawStars(canvas, time)
	return {
		light: toLayer(canvas, 1),
		shade: toLayer(canvas, 2),
		amber: toLayer(canvas, 3),
	}
}
