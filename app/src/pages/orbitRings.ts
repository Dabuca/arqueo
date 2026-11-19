// The halo's rings fall with the glyphs: each drops onto the payment panel's
// top edge, tips over a little, bounces once and settles.

export interface RingBox {
	/** Centre of the ring in page coordinates. */
	centerY: number
	/** Untransformed size of the ring's ellipse. */
	width: number
	height: number
}

const HIT_OFFSET = 0.72
const BOUNCE_TOP_OFFSET = 0.86
const BOUNCE_SHARE = 0.06
const MAX_BOUNCE_PX = 28
// Accelerating into the floor, decelerating up the bounce.
const EASE_IN = "cubic-bezier(0.55, 0, 1, 0.45)"
const EASE_OUT = "cubic-bezier(0, 0.55, 0.45, 1)"
// The drop itself leaves home with some speed, so the rings react to the first scroll.
const DROP_EASE = "cubic-bezier(0.3, 0.1, 0.9, 0.6)"

/** Vertical half-extent of an ellipse rotated by `angleDeg`. */
export function ellipseHalfHeight(width: number, height: number, angleDeg: number): number {
	const angle = (angleDeg * Math.PI) / 180
	const a = width / 2
	const b = height / 2
	return Math.sqrt((a * Math.sin(angle)) ** 2 + (b * Math.cos(angle)) ** 2)
}

/** How far a ring has to fall for its lowest point to touch `floorTop`. */
export function ringDrop(ring: RingBox, landAngleDeg: number, floorTop: number): number {
	const bottom = ring.centerY + ellipseHalfHeight(ring.width, ring.height, landAngleDeg)
	return Math.max(0, floorTop - bottom)
}

function frame(y: number, angle: number, offset: number, easing: string): Keyframe {
	return { transform: `translateY(${y}px) rotate(${angle}deg)`, offset, easing }
}

/** Web Animations keyframes for one ring falling `drop` px and landing at `landAngleDeg`. */
export function ringFallKeyframes(drop: number, homeAngleDeg: number, landAngleDeg: number): Keyframe[] {
	const bounce = Math.min(drop * BOUNCE_SHARE, MAX_BOUNCE_PX)
	const hitAngle = homeAngleDeg + (landAngleDeg - homeAngleDeg) * 0.8
	return [
		frame(0, homeAngleDeg, 0, DROP_EASE),
		frame(drop, hitAngle, HIT_OFFSET, EASE_OUT),
		frame(drop - bounce, landAngleDeg, BOUNCE_TOP_OFFSET, EASE_IN),
		frame(drop, landAngleDeg, 1, "linear"),
	]
}
