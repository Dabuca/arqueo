import { downloadPaymentsCsv, type PaymentCsvRow } from "./paymentsCsv"

interface PaymentsCsvDownloadButtonProps {
	payments: readonly PaymentCsvRow[]
}

export function PaymentsCsvDownloadButton({
	payments,
}: PaymentsCsvDownloadButtonProps) {
	return (
		<button type="button" onClick={() => downloadPaymentsCsv(payments)}>
			Download CSV
		</button>
	)
}
