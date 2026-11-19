// Turns an ASCII frame into individual glyphs that can leave the grid.
import { ORBIT_COLS, type OrbitFrame } from "./orbitAscii"

export type GlyphLayer = keyof OrbitFrame

export interface Glyph {
	char: string
	col: number
	row: number
	layer: GlyphLayer
}

export interface Point {
	x: number
	y: number
}

const LAYERS: readonly GlyphLayer[] = ["light", "shade", "amber"]

/** Every non-blank cell of a frame, with its grid position, grouped by layer. */
export function orbitGlyphs(frame: OrbitFrame): Glyph[] {
	return LAYERS.flatMap((layer) =>
		frame[layer].split("\n").flatMap((line, row) =>
			[...line].flatMap((char, col) => (char === " " ? [] : [{ char, col, row, layer }])),
		),
	)
}

/** Stable per-cell index, so a cell always behaves the same way. */
export function glyphIndex(glyph: Glyph): number {
	return glyph.row * ORBIT_COLS + glyph.col
}
