import { describe, expect, it } from "vitest"
import { renderOrbitFrame, ORBIT_COLS, ORBIT_ROWS } from "./orbitAscii"
import { glyphIndex, orbitGlyphs } from "./orbitScatter"

describe("orbitGlyphs", () => {
	it("lists every drawn cell once with its layer and grid position", () => {
		const frame = renderOrbitFrame(0)
		const glyphs = orbitGlyphs(frame)
		const drawn = (frame.light + frame.shade + frame.amber).replace(/[\s]/g, "")
		expect(glyphs).toHaveLength(drawn.length)
		for (const glyph of glyphs) {
			expect(glyph.char).not.toBe(" ")
			expect(glyph.col).toBeGreaterThanOrEqual(0)
			expect(glyph.col).toBeLessThan(ORBIT_COLS)
			expect(glyph.row).toBeGreaterThanOrEqual(0)
			expect(glyph.row).toBeLessThan(ORBIT_ROWS)
			const line = frame[glyph.layer].split("\n")[glyph.row]
			expect(line?.[glyph.col]).toBe(glyph.char)
		}
	})
})

describe("glyphIndex", () => {
	it("gives each grid cell its own index", () => {
		const glyphs = orbitGlyphs(renderOrbitFrame(0))
		const indexes = new Set(glyphs.map(glyphIndex))
		expect(indexes.size).toBe(glyphs.length)
	})
})
