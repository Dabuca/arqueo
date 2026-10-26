import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, extname } from "node:path"
import { describe, expect, it } from "vitest"

// U+FFFD is what a decoder writes for a byte it cannot read. If it reaches the
// source, the interface shows a question-mark diamond in place of the character.
const REPLACEMENT_CHARACTER = String.fromCharCode(0xfffd)
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".html", ".md"])

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name)
		if (statSync(path).isDirectory()) return sourceFiles(path)
		return SOURCE_EXTENSIONS.has(extname(path)) ? [path] : []
	})
}

describe("source encoding", () => {
	it("has no replacement characters in app/src", () => {
		const broken = sourceFiles(join(__dirname))
			.filter((file) => readFileSync(file, "utf8").includes(REPLACEMENT_CHARACTER))
			.map((file) => file.replace(__dirname, "app/src"))
		expect(broken).toEqual([])
	})
})
