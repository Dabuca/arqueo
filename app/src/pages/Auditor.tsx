import { ClipboardList, Download, ExternalLink, RefreshCw, SearchX } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { downloadPaymentsCsv } from "../components/paymentsCsv"
import { changesToCsv, createChangeLog } from "../controls/changeLog"
import { describeApproval } from "../controls/approval"
import  { type ControlChange, type ControlField } from "../controls/types"
import { type Payment, type RuleName, listPayments } from "../lib/stellar"
import ui from "../styles/ui.module.css"
import styles from "./Auditor.module.css"

type StatusFilter = "all" | "ok" | "rejected"
type RuleFilter = "all" | RuleName

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "rejected", label: "Refused" },
	{ value: "ok", label: "Settled" },
]

const FIELD_LABELS: Record<ControlField, string> = {
	maxPerPayment: "Per-payment maximum",
	cap30d: "30-day cap",
	suppliers: "Authorized suppliers",
}

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

const shortHash = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-6)}`

const downloadCsv = (filename: string, csv: string) => {
	const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }))
	const link = document.createElement("a")
	link.href = url
	link.download = filename
	document.body.append(link)
	link.click()
	link.remove()
	URL.revokeObjectURL(url)
}

const stamp = () => new Date().toISOString().slice(0, 10)

function TxLink({ hash }: { hash: string }) {
	return (
		<a className={styles.txLink} href={transactionUrl(hash)} target="_blank" rel="noreferrer">
			{shortHash(hash)}
			<ExternalLink size={14} strokeWidth={1.8} aria-hidden="true" />
		</a>
	)
}

export default function Auditor() {
	const [payments, setPayments] = useState<Payment[]>([])
	const [changes, setChanges] = useState<ControlChange[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string>()
	const [status, setStatus] = useState<StatusFilter>("all")
	const [rule, setRule] = useState<RuleFilter>("all")
	const [query, setQuery] = useState("")

	const refresh = useCallback(async () => {
		setError(undefined)
		try {
			const entries = await listPayments()
			setPayments([...entries].sort((a, b) => b.at.localeCompare(a.at)))
			setChanges(createChangeLog().list())
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

	const settled = payments.filter((payment) => payment.status === "ok").length
	const rejected = payments.length - settled

	const visible = useMemo(() => {
		const needle = query.trim().toLowerCase()
		return payments.filter(
			(payment) =>
				(status === "all" || payment.status === status) &&
				(rule === "all" || payment.rule === rule) &&
				(!needle ||
					payment.to.toLowerCase().includes(needle) ||
					payment.concept.toLowerCase().includes(needle)),
		)
	}, [payments, status, rule, query])

	const filtered = status !== "all" || rule !== "all" || query.trim() !== ""
	const clearFilters = () => {
		setStatus("all")
		setRule("all")
		setQuery("")
	}

	return (
		<div className={styles.page}>
			<header className={styles.head}>
				<div className={ui.pageHead}>
					<div className={styles.titleLine}>
						<h1>Payment journal</h1>
						<span className={ui.pill}>Read only</span>
					</div>
					<p>
						Every recorded payment attempt, refused ones included. Settled
						payments link to Stellar Expert.
					</p>
				</div>
				<div className={styles.actions}>
					<button
						className={ui.button}
						type="button"
						onClick={() => void refresh()}
					>
						<RefreshCw size={16} strokeWidth={1.8} aria-hidden="true" />
						Refresh
					</button>
					<button
						className={`${ui.button} ${ui.primary}`}
						type="button"
						disabled={visible.length === 0}
						onClick={() =>
							downloadPaymentsCsv(visible)
						}
					>
						<Download size={16} strokeWidth={1.8} aria-hidden="true" />
						Download CSV{visible.length > 0 ? ` (${visible.length})` : ""}
					</button>
				</div>
			</header>

			{error ? (
				<div className={ui.alert} role="alert">
					<strong>Could not load the journal</strong>
					<span>{error}</span>
				</div>
			) : loading ? (
				<div className={`${ui.card} ${styles.skeletons}`} role="status" aria-label="Loading payment records">
					<span />
					<span />
					<span />
				</div>
			) : payments.length === 0 ? (
				<div className={`${ui.card} ${styles.empty}`}>
					<ClipboardList size={28} strokeWidth={1.6} aria-hidden="true" />
					<h2>No payment attempts yet</h2>
					<p>
						Run a payment from the treasury and its result appears here, refused
						attempts too.
					</p>
					<Link className={`${ui.button} ${ui.primary}`} to="/app">
						Prepare a payment
					</Link>
				</div>
			) : (
				<section className={styles.section} aria-labelledby="payments-title">
					<h2 id="payments-title" className={ui.sectionTitle}>
						Payments
						<span className={styles.count}>
							{payments.length} {payments.length === 1 ? "attempt" : "attempts"} · {rejected} refused ·{" "}
							{settled} settled
						</span>
					</h2>

					<div className={styles.filters} role="group" aria-label="Filter payments">
						<div className={styles.segmented} role="group" aria-label="Status">
							{STATUS_OPTIONS.map((option) => (
								<button
									key={option.value}
									type="button"
									className={styles.segment}
									aria-pressed={status === option.value}
									onClick={() => setStatus(option.value)}
								>
									{option.label}
								</button>
							))}
						</div>
						<label className={styles.field}>
							<span className={ui.srOnly}>Rule</span>
							<select value={rule} onChange={(event) => setRule(event.target.value as RuleFilter)}>
								<option value="all">All rules</option>
								<option value="ordinary">Ordinary</option>
								<option value="large">Large</option>
							</select>
						</label>
						<label className={`${styles.field} ${styles.search}`}>
							<span className={ui.srOnly}>Search recipient or concept</span>
							<input
								type="search"
								placeholder="Search recipient or concept"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
							/>
						</label>
					</div>
					<p className={ui.srOnly} role="status">
						{visible.length} of {payments.length} attempts shown
					</p>

					{visible.length === 0 ? (
						<div className={`${ui.card} ${styles.empty}`}>
							<SearchX size={28} strokeWidth={1.6} aria-hidden="true" />
							<h2>No attempts match these filters</h2>
							<p>Try another status or rule, or clear the search.</p>
							<button className={ui.button} type="button" onClick={clearFilters}>
								Clear filters
							</button>
						</div>
					) : (
						<div className={`${ui.card} ${styles.tableCard}`}>
							<div className={styles.tableWrap}>
								<table>
									<caption className={ui.srOnly}>Payment attempts, newest first</caption>
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
										{visible.map((payment, index) => {
											const approval = describeApproval(payment)
											return (
											<tr key={`${payment.at}-${payment.hash ?? payment.reason ?? index}`}>
												<td data-label="Date">{formatDate(payment.at)}</td>
												<td data-label="Recipient" title={payment.to} className={styles.address}>
													{shortAddress(payment.to)}
												</td>
												<td data-label="Concept">{payment.concept || "—"}</td>
												<td data-label="Amount" className={styles.amount}>
													{formatAmount(payment.amount)} XLM
												</td>
												<td data-label="Signers" className={styles.signers}>
													{payment.signers.join(" + ")}
														{approval.missing.length > 0 && (
															<span className={styles.missing}>
																Missing: {approval.missing.join(", ")}
															</span>
														)}
												</td>
												<td data-label="Rule">
													<span className={ui.pill}>{approval.ruleLabel}</span>
												</td>
												<td data-label="Status">
													<span
														className={`${ui.pill} ${payment.status === "ok" ? ui.pillOk : ui.pillError}`}
													>
														{payment.status === "ok" ? "Settled" : "Refused"}
													</span>
													{payment.status === "rejected" && payment.reason && (
														<span className={styles.reason}>{payment.reason}</span>
													)}
												</td>
												<td data-label="Transaction">
													{payment.hash ? (
														<TxLink hash={payment.hash} />
													) : (
														<span className={styles.noHash}>Stopped before submission</span>
													)}
												</td>
											</tr>
											)
										})}
									</tbody>
								</table>
							</div>
						</div>
					)}
					{filtered && visible.length > 0 && (
						<button className={`${ui.button} ${ui.small} ${styles.clear}`} type="button" onClick={clearFilters}>
							Clear filters
						</button>
					)}
				</section>
			)}

			{!loading && !error && (
				<section className={styles.section} aria-labelledby="changes-title">
					<div className={styles.sectionHead}>
						<h2 id="changes-title" className={ui.sectionTitle}>
							Settings changes
						</h2>
						<button
							className={`${ui.button} ${ui.small}`}
							type="button"
							disabled={changes.length === 0}
							onClick={() =>
								downloadCsv(`arqueo-settings-changes-${stamp()}.csv`, changesToCsv(changes))
							}
						>
							<Download size={14} strokeWidth={1.8} aria-hidden="true" />
							Download CSV
						</button>
					</div>
					{changes.length === 0 ? (
						<div className={`${ui.card} ${styles.emptyInline}`}>
							<h3>No settings changes yet</h3>
							<p>
								Changes to limits and suppliers appear here with the previous and new
								value and the transactions that applied them.
							</p>
						</div>
					) : (
						<div className={`${ui.card} ${styles.tableCard}`}>
							<div className={styles.tableWrap}>
								<table>
									<caption className={ui.srOnly}>Settings changes, newest first</caption>
									<thead>
										<tr>
											<th scope="col">Date</th>
											<th scope="col">Setting</th>
											<th scope="col">Rule</th>
											<th scope="col">Previous</th>
											<th scope="col">New</th>
											<th scope="col">Spent at change</th>
											<th scope="col">Period start</th>
											<th scope="col">Removed</th>
											<th scope="col">Added</th>
										</tr>
									</thead>
									<tbody>
										{changes.map((change) => (
											<tr key={change.id}>
												<td data-label="Date">{formatDate(change.at)}</td>
												<td data-label="Setting">{FIELD_LABELS[change.field] ?? change.field}</td>
												<td data-label="Rule">{change.rule ?? "—"}</td>
												<td data-label="Previous" className={styles.value}>
													{change.previous || "—"}
												</td>
												<td data-label="New" className={styles.value}>
													{change.next || "—"}
												</td>
												<td data-label="Spent at change" className={styles.amount}>
													{change.spentAtChange === undefined
														? "—"
														: `${formatAmount(change.spentAtChange)} XLM`}
												</td>
												<td data-label="Period start">
													{change.periodStart ? formatDate(change.periodStart) : "—"}
												</td>
												<td data-label="Removed">
													{change.removeTxHash ? <TxLink hash={change.removeTxHash} /> : "—"}
												</td>
												<td data-label="Added">
													{change.addTxHash ? <TxLink hash={change.addTxHash} /> : "—"}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</section>
			)}

			<p className={styles.disclosure}>
				Read from the payment log stored in this browser. Refused attempts have no
				transaction because the account rules stopped them when the payment was
				simulated.
			</p>
		</div>
	)
}
