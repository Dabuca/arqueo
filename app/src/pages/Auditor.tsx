import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import type { Payment } from "../lib/stellar"
import { listPayments } from "../lib/stellar"
import styles from "./Auditor.module.css"

const transactionUrl = (hash: string) =>
	`https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(hash)}`

const formatAmount = (amount: number) =>
	new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 7,
	}).format(amount)

const formatDate = (at: string) => {
	const date = new Date(at)
	return Number.isNaN(date.getTime())
		? at
		: new Intl.DateTimeFormat("en", {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(date)
}

const shortAddress = (address: string) =>
	address.length > 24 ? `${address.slice(0, 10)}…${address.slice(-8)}` : address

export default function Auditor() {
	const [payments, setPayments] = useState<Payment[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string>()

	const refresh = useCallback(async () => {
		setError(undefined)
		try {
			const entries = await listPayments()
			setPayments(entries.sort((a, b) => b.at.localeCompare(a.at)))
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause))
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void refresh()
		const handleUpdate = () => void refresh()
		window.addEventListener("arqueo:payment-recorded", handleUpdate)
		window.addEventListener("storage", handleUpdate)
		return () => {
			window.removeEventListener("arqueo:payment-recorded", handleUpdate)
			window.removeEventListener("storage", handleUpdate)
		}
	}, [refresh])

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<Link className={styles.back} to="/app">← Back to treasury</Link>
				<span className={styles.network}>STELLAR TESTNET</span>
			</header>
			<main className={styles.main}>
				<div className={styles.titleRow}>
					<div>
					<p className={styles.eyebrow}>READ ONLY · AUDITOR ACCESS</p>
					<h1>Payment journal</h1>
					<p className={styles.intro}>
						Every recorded payment attempt, including instructions the account
						rejected. Successful transactions link to Stellar Expert.
					</p>
				</div>
				<button className={styles.refresh} type="button" onClick={() => void refresh()}>
					Refresh journal
				</button>
				</div>

				<div className={styles.summary}>
					<span><strong>{payments.length}</strong> recorded {payments.length === 1 ? "attempt" : "attempts"}</span>
					<span>{payments.filter((payment) => payment.status === "ok").length} settled · {payments.filter((payment) => payment.status === "rejected").length} rejected</span>
				</div>

				{error ? (
					<div className={styles.message} role="alert">
						<strong>Could not load the journal</strong>
						<span>{error}</span>
					</div>
				) : loading ? (
					<div className={styles.message} role="status">Loading payment records…</div>
				) : payments.length === 0 ? (
					<div className={styles.empty}>
						<span className={styles.emptyMark} aria-hidden="true">∅</span>
						<h2>No payment attempts yet</h2>
						<p>Once a payment is simulated, its result will appear here for review.</p>
						<Link to="/app">Prepare a payment →</Link>
					</div>
				) : (
					<div className={styles.tableWrap}>
						<table>
							<caption className={styles.srOnly}>Payment attempts, newest first</caption>
							<thead>
								<tr>
									<th scope="col">Date</th>
									<th scope="col">Recipient</th>
									<th scope="col">Concept</th>
									<th scope="col">Amount</th>
									<th scope="col">Signers</th>
									<th scope="col">Rule</th>
									<th scope="col">Status</th>
									<th scope="col">Transaction</th>
								</tr>
							</thead>
							<tbody>
								{payments.map((payment, index) => (
									<tr key={`${payment.at}-${payment.hash ?? payment.reason ?? index}`}>
										<td data-label="Date">{formatDate(payment.at)}</td>
										<td data-label="Recipient" title={payment.to} className={styles.address}>{shortAddress(payment.to)}</td>
										<td data-label="Concept">{payment.concept || "—"}</td>
										<td data-label="Amount" className={styles.amount}>{formatAmount(payment.amount)} XLM</td>
										<td data-label="Signers" className={styles.signers}>{payment.signers.join(" + ")}</td>
										<td data-label="Rule"><span className={styles.rule}>{payment.rule}</span></td>
										<td data-label="Status">
											<span className={`${styles.status} ${payment.status === "ok" ? styles.settled : styles.rejected}`}>
												<span aria-hidden="true" />{payment.status === "ok" ? "Settled" : "Rejected"}
											</span>
											{payment.status === "rejected" && payment.reason && <span className={styles.reason}>{payment.reason}</span>}
										</td>
										<td data-label="Transaction">
											{payment.hash ? <a href={transactionUrl(payment.hash)} target="_blank" rel="noreferrer">View on Stellar Expert ↗</a> : <span className={styles.noHash}>No on-chain transaction</span>}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				<p className={styles.disclosure}>This journal reads the payment log stored in this browser. Rejected simulations have no transaction hash because they never settled on-chain.</p>
			</main>
		</div>
	)
}
