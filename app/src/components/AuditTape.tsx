import { type CSSProperties } from "react"
import styles from "./AuditTape.module.css"

// The four MVP scenes (AGENTS.md §2) as journal-tape entries. Illustrative:
// the hashes are placeholders; the demo prints real testnet ones.
interface TapeEntry {
	time: string
	amount: string
	to: string
	signers: string
	rule: string
	approved: boolean
	result: string
	checks: string[]
}

const ENTRIES: TapeEntry[] = [
	{
		time: "09:14",
		amount: "200.00",
		to: "Supplier 1",
		signers: "employee",
		rule: "ordinary",
		approved: true,
		result: "tx 3f9c…a21e",
		checks: [
			"Supplier is on the allowlist",
			"200 is within 500 per payment",
			"Within 1,000 every 30 days",
			"1 of 1 signatures",
		],
	},
	{
		time: "09:31",
		amount: "2,000.00",
		to: "Supplier 2",
		signers: "employee",
		rule: "ordinary",
		approved: false,
		result: "Over the per-payment limit: manager approval required",
		checks: ["Supplier is on the allowlist", "2,000 is over 500 per payment"],
	},
	{
		time: "09:33",
		amount: "2,000.00",
		to: "Supplier 2",
		signers: "employee + manager",
		rule: "large",
		approved: true,
		result: "tx 81d4…07bc",
		checks: [
			"Supplier is on the allowlist",
			"No per-payment maximum on this rule",
			"2 of 2 signatures",
		],
	},
	{
		time: "10:02",
		amount: "100.00",
		to: "GBXQ…unknown",
		signers: "employee",
		rule: "ordinary",
		approved: false,
		result: "Supplier not authorized",
		checks: ["Recipient is not on the allowlist"],
	},
]

/**
 * A journal tape hanging from a print head. Each payment prints just under
 * the head and pushes the older lines down; rejected attempts stay printed.
 */
export function AuditTape() {
	// Newest first: the latest line sits under the print head.
	const printed = [...ENTRIES].reverse()

	return (
		<figure className={styles.roll} aria-label="Illustrative treasury journal">
			<div className={styles.printHead} aria-hidden="true">
				<span className={styles.led} />
				<span className={styles.slot} />
			</div>
			<div className={styles.paper}>
				<ol
					className={styles.entries}
					aria-label="Treasury journal, newest first"
				>
					{printed.map((entry, index) => (
						<li
							key={`${entry.time}-${entry.rule}`}
							className={styles.feed}
							style={{ "--order": printed.length - 1 - index } as CSSProperties}
						>
							<details className={styles.entry}>
								<summary>
									<span className={styles.line}>
										<span>{entry.time}</span>
										<span>PAY {entry.amount} XLM</span>
									</span>
									<span className={styles.line}>
										<span>TO {entry.to}</span>
										<span>RULE {entry.rule.toUpperCase()}</span>
									</span>
									<span className={styles.line}>
										<span>SIGNED {entry.signers}</span>
									</span>
									<span
										className={
											entry.approved ? styles.approved : styles.rejected
										}
									>
										<strong>{entry.approved ? "APPROVED" : "REJECTED"}</strong>
										<span>{entry.result}</span>
									</span>
								</summary>
								<ul className={styles.checks}>
									{entry.checks.map((check) => (
										<li key={check}>{check}</li>
									))}
								</ul>
							</details>
						</li>
					))}
				</ol>
				<p className={styles.start}>
					ARQUEO TREASURY JOURNAL
					<br />
					TESTNET XLM, ILLUSTRATIVE TAPE
				</p>
			</div>
		</figure>
	)
}
