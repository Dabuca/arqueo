export interface PaymentCsvRow {
	to: string
	amount: number
	concept: string
	signers: readonly string[]
	rule: string
	status: "ok" | "rejected"
	hash?: string
	reason?: string
	at: string
}

const columns = [
	"to",
	"amount",
	"concept",
	"signers",
	"rule",
	"status",
	"hash",
	"reason",
	"at",
] as const

const escapeCell = (value: string): string => {
	const spreadsheetSafe = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value
	return `"${spreadsheetSafe.replaceAll('"', '""')}"`
}

export function buildPaymentsCsv(payments: readonly PaymentCsvRow[]): string {
	const rows = payments.map((payment) => [
		payment.to,
		String(payment.amount),
		payment.concept,
		payment.signers.join("; "),
		payment.rule,
		payment.status,
		payment.hash ?? "",
		payment.reason ?? "",
		payment.at,
	])

	return [columns, ...rows]
		.map((row) => row.map((cell) => escapeCell(String(cell))).join(","))
		.join("\r\n")
}

const localDateStamp = (date: Date): string => {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, "0")
	const day = String(date.getDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
}

export function downloadPaymentsCsv(
	payments: readonly PaymentCsvRow[],
	date = new Date(),
): void {
	const blob = new Blob([`\uFEFF${buildPaymentsCsv(payments)}`], {
		type: "text/csv;charset=utf-8",
	})
	const url = URL.createObjectURL(blob)
	const link = document.createElement("a")
	link.href = url
	link.download = `arqueo-payments-${localDateStamp(date)}.csv`
	link.click()
	window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
