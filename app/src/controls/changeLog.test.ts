import { describe, expect, it } from "vitest"
import { changesToCsv, createChangeLog } from "./changeLog"
import type { ControlChange } from "./types"

const KEY = "arqueo.controlChanges"

function fakeStorage(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial))
	return {
		data,
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k),
	}
}

function brokenStorage() {
	const boom = () => {
		throw new Error("storage blocked")
	}
	return { getItem: boom, setItem: boom, removeItem: boom }
}

const maxChange = {
	field: "maxPerPayment" as const,
	previous: "500",
	next: "300",
	removeTxHash: "aaa",
	addTxHash: "bbb",
}

describe("createChangeLog", () => {
	it("records a change with id and ISO date, and lists it", () => {
		const log = createChangeLog(fakeStorage())
		const now = new Date("2026-10-25T12:00:00.000Z")
		const saved = log.record(maxChange, now)

		expect(saved.id).toMatch(/^[0-9a-f-]{36}$/)
		expect(saved.at).toBe("2026-10-25T12:00:00.000Z")
		expect(saved).toMatchObject(maxChange)
		expect(log.list()).toEqual([saved])
	})

	it("uses the current date when none is given", () => {
		const before = Date.now()
		const saved = createChangeLog(fakeStorage()).record(maxChange)
		expect(Date.parse(saved.at)).toBeGreaterThanOrEqual(before)
	})

	it("lists newest first", () => {
		const log = createChangeLog(fakeStorage())
		const first = log.record(maxChange, new Date("2026-10-25T10:00:00Z"))
		const second = log.record(maxChange, new Date("2026-10-25T11:00:00Z"))
		expect(log.list().map((c) => c.id)).toEqual([second.id, first.id])
	})

	it("clear removes everything", () => {
		const storage = fakeStorage()
		const log = createChangeLog(storage)
		log.record(maxChange)
		log.clear()
		expect(log.list()).toEqual([])
		expect(createChangeLog(storage).list()).toEqual([])
	})

	it("a second log on the same storage sees the first one's changes", () => {
		const storage = fakeStorage()
		const saved = createChangeLog(storage).record(maxChange)
		expect(createChangeLog(storage).list()).toEqual([saved])
		expect(JSON.parse(storage.data.get(KEY)!)).toHaveLength(1)
	})

	it("keeps working in memory when storage throws", () => {
		const log = createChangeLog(brokenStorage())
		const saved = log.record(maxChange)
		expect(log.list()).toEqual([saved])
		expect(() => log.clear()).not.toThrow()
		expect(log.list()).toEqual([])
	})

	it("starts empty when the stored JSON is corrupt", () => {
		const log = createChangeLog(fakeStorage({ [KEY]: "{not json" }))
		expect(log.list()).toEqual([])
		const saved = log.record(maxChange)
		expect(log.list()).toEqual([saved])
	})

	it("starts empty when the stored JSON is not a list", () => {
		const log = createChangeLog(fakeStorage({ [KEY]: '{"a":1}' }))
		expect(log.list()).toEqual([])
	})
})

describe("changesToCsv", () => {
	const header =
		"at,field,previous,next,spentAtChange,periodStart,removeTxHash,addTxHash"

	function change(over: Partial<ControlChange> = {}): ControlChange {
		return {
			id: "1",
			at: "2026-10-25T12:00:00.000Z",
			field: "maxPerPayment",
			previous: "500",
			next: "300",
			...over,
		}
	}

	it("has the exact header and nothing else when empty", () => {
		expect(changesToCsv([])).toBe(header)
	})

	it("leaves missing fields empty and keeps the received order", () => {
		const csv = changesToCsv([
			change({ removeTxHash: "r1", addTxHash: "a1" }),
			change({
				at: "2026-10-26T00:00:00.000Z",
				field: "cap30d",
				previous: "1000",
				next: "1500",
				spentAtChange: 500,
				periodStart: "2026-10-01T00:00:00.000Z",
			}),
		])
		expect(csv.split("\n")).toEqual([
			header,
			"2026-10-25T12:00:00.000Z,maxPerPayment,500,300,,,r1,a1",
			"2026-10-26T00:00:00.000Z,cap30d,1000,1500,500,2026-10-01T00:00:00.000Z,,",
		])
	})

	it("writes a spent amount of zero", () => {
		const csv = changesToCsv([change({ spentAtChange: 0 })])
		expect(csv.split("\n")[1]).toBe(
			"2026-10-25T12:00:00.000Z,maxPerPayment,500,300,0,,,",
		)
	})

	it("quotes fields with commas, doubles quotes and keeps newlines quoted", () => {
		const csv = changesToCsv([
			change({
				field: "suppliers",
				previous: "G1,G2",
				next: 'say "hi"',
				removeTxHash: "line1\nline2",
			}),
		])
		expect(csv).toBe(
			`${header}\n2026-10-25T12:00:00.000Z,suppliers,"G1,G2","say ""hi""",,,"line1\nline2",`,
		)
	})
})
