import { downloadPaymentsCsv, type PaymentCsvRow } from "./paymentsCsv"

interface PaymentsCsvDownloadButtonProps {
	payments: readonly PaymentCsvRow[]
	className?: string
	disabled?: boolean
}

export function PaymentsCsvDownloadButton({
	payments,
	className,
	disabled = false,
}: PaymentsCsvDownloadButtonProps) {
	return (
		<button
			className={className}
			type="button"
			disabled={disabled}
			onClick={() => downloadPaymentsCsv(payments)}
		>
			Download CSV
		</button>
	)
}
