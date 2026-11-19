// Drives the halo's rings with the Web Animations API: they fall onto the
// panel when gravity turns on and play the fall backwards to fly home.
import { ringDrop, ringFallKeyframes } from "./orbitRings"

const HOME_ANGLE_DEG = -28
/** Each ring lands with its own small tilt, so the pile does not look stamped. */
const LAND_ANGLES_DEG = [-4, 3, -1.5]
const FALL_MS = 1100
const STAGGER_MS = 40
const RISE_RATE = 1.6

export interface HaloMotion {
	fall(floorTop: number): void
	rise(): void
	reset(): void
	/** Keeps landed rings on the panel when it moves in the page. */
	follow(floorTop: number): void
	/** Re-measures the rings after a resize, keeping where each one is in its fall. */
	relayout(floorTop: number): void
}

function readTranslate(element: HTMLElement): string {
	const value = getComputedStyle(element).translate
	return value === "none" ? "" : value
}

export function createHaloMotion(halo: HTMLElement, rings: readonly HTMLElement[]): HaloMotion {
	let animations: Animation[] = []
	let fallTop = 0
	let shift = 0

	const setShift = (next: number) => {
		if (next === shift) return
		shift = next
		const value = next === 0 ? "" : `0 ${next}px`
		for (const ring of rings) ring.style.translate = value
	}

	const build = (floorTop: number): Animation[] => {
		fallTop = floorTop
		return rings.map((ring, i) => {
			const box = ring.getBoundingClientRect()
			const land = LAND_ANGLES_DEG[i % LAND_ANGLES_DEG.length] ?? 0
			const drop = ringDrop(
				{
					centerY: box.top + box.height / 2 + window.scrollY,
					width: ring.offsetWidth,
					height: ring.offsetHeight,
				},
				land,
				floorTop,
			)
			return ring.animate(ringFallKeyframes(drop, HOME_ANGLE_DEG, land), {
				duration: FALL_MS,
				delay: i * STAGGER_MS,
				fill: "both",
			})
		})
	}

	return {
		fall(floorTop) {
			if (animations.length === 0) {
				// Freeze the scroll-driven drift where it is, so the landing spot is stable.
				halo.style.translate = readTranslate(halo)
				halo.dataset.detached = "true"
				animations = build(floorTop)
				return
			}
			for (const animation of animations) {
				animation.updatePlaybackRate(1)
				animation.play()
			}
		},
		rise() {
			setShift(0)
			for (const animation of animations) {
				animation.updatePlaybackRate(-RISE_RATE)
				animation.play()
			}
		},
		reset() {
			for (const animation of animations) animation.cancel()
			animations = []
			setShift(0)
			halo.style.translate = ""
			delete halo.dataset.detached
		},
		follow(floorTop) {
			if (animations.length > 0) setShift(floorTop - fallTop)
		},
		relayout(floorTop) {
			if (animations.length === 0) return
			// Rings are sized in percentages: re-measure them and keep each animation's progress.
			const progress = animations.map((a) => ({ time: a.currentTime, rate: a.playbackRate }))
			for (const animation of animations) animation.cancel()
			setShift(0)
			animations = build(floorTop)
			animations.forEach((animation, i) => {
				const state = progress[i]
				if (!state) return
				animation.updatePlaybackRate(state.rate)
				animation.currentTime = state.time
			})
		},
	}
}
