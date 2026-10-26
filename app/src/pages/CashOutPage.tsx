import { useState } from "react"
import ui from "../styles/ui.module.css"
import styles from "./CashOutPage.module.css"
import {
	ANCHOR_NAME,
	type CashOutEvent,
	type CashOutState,
	type Step,
	USDC_TO_EUR,
	initialState,
	maskIban,
	newReference,
	next,
	quote,
	validateBankDetails,
} from "./cashout"

const STEPS: { step: Step; label: string }[] = [
	{ step: "amount", label: "Amount" },
	{ step: "bank", label: "Bank details" },
	{ step: "send", label: "Send to anchor" },
	{ step: "done", label: "Bank transfer sent" },
]

const usdc = (value: number) => `${value.toFixed(2)} USDC`
const eur = (value: number) => `${value.toFixed(2)} EUR`

function Rows({ rows }: { rows: [label: string, value: string][] }) {
	return (
		<dl className={styles.rows}>
			{rows.map(([label, value]) => (
				<div key={label} className={styles.row}>
					<dt className={ui.label}>{label}</dt>
					<dd className={ui.mono}>{value}</dd>
				</div>
			))}
		</dl>
	)
}

function RealAnchorNote({ children }: { children: string }) {
	return (
		<p className={`${ui.small} ${styles.note}`}>
			<strong>What a real anchor does:</strong> {children}
		</p>
	)
}

type StepProps = { state: CashOutState; dispatch: (event: CashOutEvent) => void }

function AmountStep({ state, dispatch }: StepProps) {
	const result = quote(state.amount)
	return (
		<section className={`${ui.card} ${styles.card}`} aria-labelledby="step-title">
			<h2 id="step-title" className={ui.sectionTitle}>
				Amount
			</h2>
			<label className={styles.field}>
				<span className={ui.label}>Amount (USDC)</span>
				<input
					className={styles.input}
					type="number"
					min={0}
					step={0.01}
					value={state.amount}
					onChange={(event) => dispatch({ type: "setAmount", amount: Number(event.target.value) })}
				/>
			</label>
			{result.ok ? (
				<Rows
					rows={[
						["Fee", usdc(result.fee)],
						["You receive (USDC)", usdc(result.net)],
						[`Paid to your bank (EUR), at ${USDC_TO_EUR} EUR per USDC, demo rate`, eur(result.eur)],
					]}
				/>
			) : (
				<p className={styles.error} role="alert">
					{result.error}
				</p>
			)}
			<div className={styles.actions}>
				<button
					className={`${ui.button} ${ui.primary}`}
					type="button"
					disabled={!result.ok}
					onClick={() => dispatch({ type: "continue" })}
				>
					Continue
				</button>
			</div>
			<RealAnchorNote>SEP-24 /info and a quote of fees and rate.</RealAnchorNote>
		</section>
	)
}

function BankStep({ state, dispatch }: StepProps) {
	const { bank } = state
	const errors = validateBankDetails(bank)
	return (
		<section className={`${ui.card} ${styles.card}`} aria-labelledby="step-title">
			<h2 id="step-title" className={ui.sectionTitle}>
				Bank details
			</h2>
			<label className={styles.field}>
				<span className={ui.label}>Account holder</span>
				<input
					className={styles.input}
					type="text"
					value={bank.holder}
					onChange={(event) => dispatch({ type: "setBank", bank: { ...bank, holder: event.target.value } })}
				/>
			</label>
			<label className={styles.field}>
				<span className={ui.label}>IBAN</span>
				<input
					className={`${styles.input} ${ui.mono}`}
					type="text"
					value={bank.iban}
					onChange={(event) => dispatch({ type: "setBank", bank: { ...bank, iban: event.target.value } })}
				/>
			</label>
			<label className={styles.check}>
				<input
					type="checkbox"
					checked={bank.kyc}
					onChange={(event) => dispatch({ type: "setBank", bank: { ...bank, kyc: event.target.checked } })}
				/>
				KYC verified by the anchor
			</label>
			{errors.length > 0 && (
				<ul className={styles.errors} role="alert">
					{errors.map((message) => (
						<li key={message}>{message}</li>
					))}
				</ul>
			)}
			<div className={styles.actions}>
				<button
					className={`${ui.button} ${ui.primary}`}
					type="button"
					disabled={errors.length > 0}
					onClick={() => dispatch({ type: "continue" })}
				>
					Continue
				</button>
			</div>
			<RealAnchorNote>The anchor's interactive SEP-24 page collects KYC and bank details.</RealAnchorNote>
		</section>
	)
}

function SendStep({ state, dispatch }: StepProps) {
	const result = quote(state.amount)
	return (
		<section className={`${ui.card} ${styles.card}`} aria-labelledby="step-title">
			<h2 id="step-title" className={ui.sectionTitle}>
				Send to anchor
			</h2>
			{result.ok && (
				<p>
					You are about to send <strong className={ui.mono}>{usdc(result.net)}</strong> to {ANCHOR_NAME}.
				</p>
			)}
			{state.reference ? (
				<>
					<p>USDC sent to the anchor</p>
					<Rows rows={[["Reference", state.reference]]} />
					<div className={styles.actions}>
						<button
							className={`${ui.button} ${ui.primary}`}
							type="button"
							onClick={() => dispatch({ type: "complete", at: new Date().toISOString() })}
						>
							Continue
						</button>
					</div>
				</>
			) : (
				<div className={styles.actions}>
					<button
						className={`${ui.button} ${ui.primary}`}
						type="button"
						onClick={() => dispatch({ type: "approve", reference: newReference() })}
					>
						Approve transfer
					</button>
				</div>
			)}
			<RealAnchorNote>
				The supplier's wallet sends a Stellar payment to the anchor with the memo it asked for.
			</RealAnchorNote>
		</section>
	)
}

function DoneStep({ state, dispatch }: StepProps) {
	const result = quote(state.amount)
	const date = state.completedAt ? new Date(state.completedAt).toLocaleString() : ""
	return (
		<section className={`${ui.card} ${styles.card}`} aria-labelledby="step-title">
			<h2 id="step-title" className={ui.sectionTitle}>
				Bank transfer sent
			</h2>
			{result.ok && (
				<Rows
					rows={[
						["Amount", usdc(result.amount)],
						["Fee", usdc(result.fee)],
						["Net", usdc(result.net)],
						["Paid to your bank", eur(result.eur)],
						["IBAN", maskIban(state.bank.iban)],
						["Reference", state.reference ?? ""],
						["Date", date],
					]}
				/>
			)}
			<div className={styles.actions}>
				<button className={ui.button} type="button" onClick={() => dispatch({ type: "restart" })}>
					Start again
				</button>
			</div>
			<RealAnchorNote>
				The anchor pays out to the bank and SEP-24 /transaction reports completed.
			</RealAnchorNote>
		</section>
	)
}

export default function CashOutPage() {
	const [state, setState] = useState(initialState)
	const dispatch = (event: CashOutEvent) => setState((current) => next(current, event))

	return (
		<div className={styles.page}>
			<header className={ui.pageHead}>
				<div className={styles.titleLine}>
					<h1>Cash out to bank</h1>
					<span className={ui.pill}>Simulated</span>
				</div>
				<p>How a paid supplier moves test USDC to their bank through {ANCHOR_NAME}.</p>
			</header>

			<div className={ui.alert} role="note">
				Simulated anchor flow — no funds move. Roadmap: SEP-24 withdrawal through a Stellar anchor.
			</div>

			<ol className={styles.steps} aria-label="Progress">
				{STEPS.map(({ step, label }, index) => (
					<li
						key={step}
						className={step === state.step ? `${styles.step} ${styles.stepActive}` : styles.step}
						aria-current={step === state.step ? "step" : undefined}
					>
						<span className={styles.stepNumber}>{index + 1}</span>
						{label}
					</li>
				))}
			</ol>

			{state.step === "amount" && <AmountStep state={state} dispatch={dispatch} />}
			{state.step === "bank" && <BankStep state={state} dispatch={dispatch} />}
			{state.step === "send" && <SendStep state={state} dispatch={dispatch} />}
			{state.step === "done" && <DoneStep state={state} dispatch={dispatch} />}
		</div>
	)
}
