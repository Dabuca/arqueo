import { expect, test } from "@playwright/test"
import {
	buildPaymentsCsv,
	downloadPaymentsCsv,
	type PaymentCsvRow,
} from "../../app/src/components/paymentsCsv"

test("CSV includes accepted and rejected payment details", () => {
	const payments: PaymentCsvRow[] = [
		{
			to: "GAuthorizedSupplier",
			amount: 200,
			concept: "Office supplies",
			signers: ["employee"],
			rule: "ordinary",
			status: "ok",
			hash: "abc123",
			at: "2026-10-25T10:00:00.000Z",
		},
		{
			to: "GUnknownSupplier",
			amount: 100,
			concept: "Unknown vendor",
			signers: ["employee", "manager"],
			rule: "large",
			status: "rejected",
			reason: "Supplier not authorized",
			at: "2026-10-25T10:01:00.000Z",
		},
	]

	const csv = buildPaymentsCsv(payments)
	const rows = csv.split("\r\n")

	expect(rows[0]).toBe(
		'"to","amount","concept","signers","rule","status","hash","reason","at"',
	)
	expect(rows).toHaveLength(3)
	expect(rows[1]).toContain(
		'"200","Office supplies","employee","ordinary","ok","abc123"',
	)
	expect(rows[2]).toContain(
		'"100","Unknown vendor","employee; manager","large","rejected","","Supplier not authorized"',
	)
})

test("CSV escapes delimiters and neutralizes spreadsheet formulas", () => {
	const csv = buildPaymentsCsv([
		{
			to: "GSupplier",
			amount: 1,
			concept: '=HYPERLINK("https://example.com","click"),\nsecond line',
			signers: ["employee"],
			rule: "ordinary",
			status: "rejected",
			reason: "Rejected",
			at: "2026-10-25T10:00:00.000Z",
		},
	])

	expect(csv).toContain("'=HYPERLINK")
	expect(csv).toContain('"\'=HYPERLINK(""https://example.com"",""click"")')
	expect(csv).toContain(",\nsecond line")
})

test("empty payment lists produce a header-only CSV", () => {
	expect(buildPaymentsCsv([])).toBe(
		'"to","amount","concept","signers","rule","status","hash","reason","at"',
	)
})

test("download creates a dated UTF-8 CSV and releases its object URL", async () => {
	const originalDocument = Object.getOwnPropertyDescriptor(
		globalThis,
		"document",
	)
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
	const originalCreateObjectURL = URL.createObjectURL
	const originalRevokeObjectURL = URL.revokeObjectURL
	let downloadedBlob: Blob | undefined
	let filename = ""
	let revokedUrl = ""
	let clicked = false

	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: {
			createElement: () => ({
				href: "",
				download: "",
				click() {
					clicked = true
					filename = this.download
				},
			}),
		},
	})
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			setTimeout(callback: () => void, delay: number) {
				expect(delay).toBe(1_000)
				callback()
				return 1
			},
		},
	})
	URL.createObjectURL = (blob) => {
		downloadedBlob = blob
		return "blob:payments-csv"
	}
	URL.revokeObjectURL = (url) => {
		revokedUrl = url
	}

	try {
		downloadPaymentsCsv([], new Date(2026, 9, 25))
		expect(clicked).toBe(true)
		expect(filename).toBe("arqueo-payments-2026-10-25.csv")
		expect(downloadedBlob?.type).toBe("text/csv;charset=utf-8")
		const bytes = new Uint8Array(await downloadedBlob!.arrayBuffer())
		expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
		expect(revokedUrl).toBe("blob:payments-csv")
	} finally {
		URL.createObjectURL = originalCreateObjectURL
		URL.revokeObjectURL = originalRevokeObjectURL
		if (originalDocument) {
			Object.defineProperty(globalThis, "document", originalDocument)
		} else {
			Reflect.deleteProperty(globalThis, "document")
		}
		if (originalWindow) {
			Object.defineProperty(globalThis, "window", originalWindow)
		} else {
			Reflect.deleteProperty(globalThis, "window")
		}
	}
})
