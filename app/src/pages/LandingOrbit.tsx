import { useEffect, useRef } from "react"
import styles from "./Landing.module.css"
import { ORBIT_COLS, renderOrbitFrame, type OrbitFrame } from "./orbitAscii"
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
	type Particle,
	type Phase,
	type World,
} from "./orbitGravity"
import { createHaloMotion } from "./orbitHaloMotion"
import { glyphIndex, orbitGlyphs, type GlyphLayer } from "./orbitScatter"

const FRAME_INTERVAL_MS = 1000 / 24
const MAX_STEP_S = 1 / 30
const AMBER_GLOW_PX = 8
const CULL_MARGIN_PX = 24
const SPRITE_PAD_PX = 2
const FIRST_FRAME = renderOrbitFrame(0)

type Pres = Record<GlyphLayer, HTMLPreElement>

interface Typography {
	font: string
	cellWidth: number
	lineHeight: number
	colors: Record<GlyphLayer, string>
}

interface LandingOrbitProps {
	/** Id of the element whose top edge the glyphs land on. */
	landOn: string
}

function readTypography(pres: Pres): Typography {
	const style = getComputedStyle(pres.light)
	return {
		font: `${style.fontSize} ${style.fontFamily}`,
		cellWidth: pres.light.getBoundingClientRect().width / ORBIT_COLS,
		lineHeight: parseFloat(style.lineHeight),
		colors: {
			light: style.color,
			shade: getComputedStyle(pres.shade).color,
			amber: getComputedStyle(pres.amber).color,
		},
	}
}

function resizeCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
	const ratio = window.devicePixelRatio || 1
	canvas.width = Math.round(canvas.clientWidth * ratio)
	canvas.height = Math.round(canvas.clientHeight * ratio)
	ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
}

function clearCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
	ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
}

interface Sprite {
	image: HTMLCanvasElement
	/** Side of the square sprite in CSS pixels. */
	size: number
}

type SpriteCache = Map<string, Sprite>

// Text with a canvas shadow is very slow to draw thousands of times per frame,
// so each glyph is rendered once (glow included) and stamped with drawImage.
function buildSprite(char: string, layer: GlyphLayer, type: Typography, ratio: number): Sprite {
	const glow = layer === "amber"
	const pad = glow ? AMBER_GLOW_PX * 2 : SPRITE_PAD_PX
	const size = Math.ceil(Math.max(type.cellWidth, type.lineHeight) + pad * 2)
	const image = document.createElement("canvas")
	image.width = Math.ceil(size * ratio)
	image.height = image.width
	const ctx = image.getContext("2d")
	if (!ctx) return { image, size }
	ctx.scale(ratio, ratio)
	ctx.font = type.font
	ctx.textAlign = "center"
	ctx.textBaseline = "middle"
	ctx.fillStyle = type.colors[layer]
	ctx.shadowColor = glow ? type.colors.amber : "transparent"
	ctx.shadowBlur = glow ? AMBER_GLOW_PX : 0
	ctx.fillText(char, size / 2, size / 2)
	return { image, size }
}

function spriteFor(
	cache: SpriteCache,
	p: Particle,
	type: Typography,
	ratio: number,
): Sprite {
	const key = `${p.layer}:${p.char}`
	const cached = cache.get(key)
	if (cached) return cached
	const sprite = buildSprite(p.char, p.layer, type, ratio)
	cache.set(key, sprite)
	return sprite
}

/** Glyphs of the current frame with their home centres in page coordinates. */
function snapshotGlyphs(art: HTMLElement, frame: OrbitFrame, type: Typography): FallGlyph[] {
	const box = art.getBoundingClientRect()
	const left = box.left + window.scrollX
	const top = box.top + window.scrollY
	return orbitGlyphs(frame).map((glyph) => ({
		char: glyph.char,
		layer: glyph.layer,
		row: glyph.row,
		index: glyphIndex(glyph),
		home: {
			x: left + (glyph.col + 0.5) * type.cellWidth,
			y: top + (glyph.row + 0.5) * type.lineHeight,
		},
	}))
}

/** The landing element's top edge in page coordinates. */
function readFloor(target: HTMLElement | null, type: Typography): Floor {
	const box = target?.getBoundingClientRect()
	const base = { cellWidth: type.cellWidth, lineHeight: type.lineHeight }
	if (!box) return { ...base, top: document.documentElement.scrollHeight, left: 0, right: 0 }
	return {
		...base,
		top: box.top + window.scrollY,
		left: box.left + window.scrollX,
		right: box.right + window.scrollX,
	}
}

function drawWorld(
	canvas: HTMLCanvasElement,
	ctx: CanvasRenderingContext2D,
	world: World,
	type: Typography,
	sprites: SpriteCache,
) {
	const ratio = canvas.width / (canvas.clientWidth || 1)
	// Relative to the canvas' real box, in case an ancestor becomes its containing block.
	const origin = canvas.getBoundingClientRect()
	const offsetX = window.scrollX + origin.left
	const offsetY = window.scrollY + origin.top
	const bottom = canvas.clientHeight + CULL_MARGIN_PX
	clearCanvas(canvas, ctx)
	for (const p of world.particles) {
		if (p.state === "gone") continue
		const x = p.x - offsetX
		const y = p.y - offsetY
		if (y < -CULL_MARGIN_PX || y > bottom) continue
		const sprite = spriteFor(sprites, p, type, ratio)
		const half = sprite.size / 2
		if (p.angle === 0) {
			ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
			ctx.drawImage(sprite.image, x - half, y - half, sprite.size, sprite.size)
			continue
		}
		const cos = Math.cos(p.angle) * ratio
		const sin = Math.sin(p.angle) * ratio
		ctx.setTransform(cos, sin, -sin, cos, x * ratio, y * ratio)
		ctx.drawImage(sprite.image, -half, -half, sprite.size, sprite.size)
	}
	ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
}

function writeFrame(pres: Pres, frame: OrbitFrame) {
	pres.light.textContent = frame.light
	pres.shade.textContent = frame.shade
	pres.amber.textContent = frame.amber
}

export function LandingOrbit({ landOn }: LandingOrbitProps) {
	const haloRef = useRef<HTMLDivElement>(null)
	const artRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const lightRef = useRef<HTMLPreElement>(null)
	const shadeRef = useRef<HTMLPreElement>(null)
	const amberRef = useRef<HTMLPreElement>(null)

	useEffect(() => {
		const [halo, art, canvas] = [haloRef.current, artRef.current, canvasRef.current]
		const [light, shade, amber] = [lightRef.current, shadeRef.current, amberRef.current]
		const ctx = canvas?.getContext("2d")
		if (!halo || !art || !canvas || !ctx || !light || !shade || !amber) return
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

		const pres: Pres = { light, shade, amber }
		const rings = [...halo.querySelectorAll<HTMLElement>("[data-ring]")]
		const haloMotion = createHaloMotion(halo, rings)
		const target = document.getElementById(landOn)
		let type = readTypography(pres)
		let frame = FIRST_FRAME
		let phase: Phase = "assembled"
		let world: World | null = null
		let frameId = 0
		let lastFrame = 0
		let lastTick = performance.now()
		// A settled pile only needs redrawing when the view or layout moves.
		let lastView = ""
		const sprites: SpriteCache = new Map()
		const start = lastTick

		const enter = (next: Phase) => {
			if (next === "falling") {
				world = phase === "rising" && world ? beginFall(world) : createFall(snapshotGlyphs(art, frame, type))
				haloMotion.fall(readFloor(target, type).top)
			} else if (next === "rising" && world) {
				world = beginRise(world)
				haloMotion.rise()
			} else if (next === "assembled") {
				world = null
				haloMotion.reset()
				clearCanvas(canvas, ctx)
				writeFrame(pres, frame)
			}
			art.dataset.detached = String(next !== "assembled")
			phase = next
			lastView = ""
		}

		const tick = (now: number) => {
			frameId = requestAnimationFrame(tick)
			const dt = Math.min((now - lastTick) / 1000, MAX_STEP_S)
			lastTick = now
			if (document.hidden) return
			if (now - lastFrame >= FRAME_INTERVAL_MS) {
				lastFrame = now
				frame = renderOrbitFrame(now - start)
				if (phase === "assembled") writeFrame(pres, frame)
			}
			const settled = world ? isSettled(world) : false
			const risen = world ? isRisen(world) : false
			const next = nextPhase(phase, { scrollY: window.scrollY, settled, risen })
			if (next !== phase) enter(next)
			if (!world) return
			const floor = readFloor(target, type)
			if (phase !== "rising") haloMotion.follow(floor.top)
			const view = `${window.scrollX}|${window.scrollY}|${floor.top}|${floor.left}`
			// A settled pile is static: no physics and no redraw until the view moves.
			if (phase === "fallen" && view === lastView) return
			lastView = view
			if (phase === "rising") world = stepRise(world, dt)
			else world = stepFall(world, dt, floor)
			drawWorld(canvas, ctx, world, type, sprites)
		}

		const resize = new ResizeObserver(() => {
			resizeCanvas(canvas, ctx)
			type = readTypography(pres)
			sprites.clear()
			haloMotion.relayout(readFloor(target, type).top)
			lastView = ""
		})
		resize.observe(art)
		resize.observe(canvas)
		frameId = requestAnimationFrame(tick)

		return () => {
			cancelAnimationFrame(frameId)
			resize.disconnect()
			haloMotion.reset()
			delete art.dataset.detached
		}
	}, [landOn])

	return (
		<>
			<div ref={haloRef} className={styles.orbitHalo} aria-hidden="true">
				<div className={styles.orbitGlow} />
				<div className={styles.orbitRing} data-ring />
				<div className={`${styles.orbitRing} ${styles.orbitRingTall}`} data-ring />
				<div className={`${styles.orbitRing} ${styles.orbitRingDashed}`} data-ring />
			</div>
			<div ref={artRef} className={styles.orbitArt} aria-hidden="true">
				<pre ref={lightRef}>{FIRST_FRAME.light}</pre>
				<pre ref={shadeRef} className={styles.orbitShade}>
					{FIRST_FRAME.shade}
				</pre>
				<pre ref={amberRef} className={styles.orbitAmber}>
					{FIRST_FRAME.amber}
				</pre>
			</div>
			{/* Outside .orbitArt: its container query containment would trap position: fixed. */}
			<canvas ref={canvasRef} className={styles.orbitField} aria-hidden="true" />
		</>
	)
}
