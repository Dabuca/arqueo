import { describe, expect, it } from "vitest"

// U+FFFD is what a decoder writes for a byte it cannot read. If it reaches the
// source, the interface shows a question-mark diamond in place of the character.
const REPLACEMENT_CHARACTER = String.fromCharCode(0xfffd)

// Every ts, tsx, html and md file under app/src, read as a string by Vite (no
// Node types needed). Stylesheets are left out: Vite turns CSS modules into objects.
const sources = import.meta.glob("./**/*.{ts,tsx,html,md}", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>

describe("source encoding", () => {
	it("reads the source files it is meant to check", () => {
		expect(Object.keys(sources).length).toBeGreaterThan(20)
	})

	it("has no replacement characters in app/src", () => {
		const broken = Object.entries(sources)
			.filter(([, text]) => text.includes(REPLACEMENT_CHARACTER))
			.map(([file]) => file)
		expect(broken).toEqual([])
	})
})
