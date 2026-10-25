import { useEffect, useState, type FormEvent } from "react"
import { DEFAULT_LIMITS, DEMO_AMOUNTS } from "../controls/defaults"
import { requiredRule, ruleForSigners } from "../controls/rules"
import {
	installControlPolicy,
	loadCompany,
	pay,
	setupOrdinaryRule,
} from "../lib/stellar"
import { outcomeFromResult, type Outcome } from "./paymentOutcome"
import styles from "./PaymentScreen.module.css"

type SignatureChoice = "employee" | "manager"

const testnetTx = (hash: string) =>
	`https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(hash)}`

const configuredSuppliers: string[] = (import.meta.env.PUBLIC_SUPPLIERS ?? "")
	.split(",")
	.map((address: string) => address.trim())
	.filter(Boolean)

const shortAddress = (address: string) =>
	`${address.slice(0, 6)}…${address.slice(-5)}`

export default function PaymentScreen() {
	const [supplier, setSupplier] = useState(configuredSuppliers[0] ?? "")
	const [customSupplier, setCustomSupplier] = useState(false)
	const [amount, setAmount] = useState(String(DEMO_AMOUNTS.below))
	const [concept, setConcept] = useState("")
	const [signature, setSignature] = useState<SignatureChoice>("employee")
	const [busy, setBusy] = useState(false)
	const [setupHash, setSetupHash] = useState<string>()
	const [setupError, setSetupError] = useState<string>()
	const [outcome, setOutcome] = useState<Outcome>()

	const [company, setCompany] = useState(() => loadCompany())
	useEffect(() => {
		const refreshCompany = () => setCompany(loadCompany())
		window.addEventListener("arqueo:company-updated", refreshCompany)
		return () =>
			window.removeEventListener("arqueo:company-updated", refreshCompany)
	}, [])
	const numericAmount = Number(amount)
	const amountIsValid = Number.isFinite(numericAmount) && numericAmount > 0
	const signers =
		signature === "employee"
			? (["employee"] as const)
			: (["employee", "manager"] as const)
	const selectedRule = ruleForSigners([...signers])
	const suggestedRule = amountIsValid
		? requiredRule(numericAmount, DEFAULT_LIMITS, 0)
		: "ordinary"
	const recipient = supplier
	const ordinaryReady = company?.rules?.ordinary !== undefined

	const pickScenario = (nextAmount: number, useUnknownSupplier = false) => {
		setAmount(String(nextAmount))
		setSignature("employee")
		setOutcome(undefined)
		if (useUnknownSupplier) {
			setCustomSupplier(true)
			setSupplier("")
		} else if (configuredSuppliers[0]) {
			setCustomSupplier(false)
			setSupplier(configuredSuppliers[0])
		}
	}

	const prepareRule = async () => {
		setBusy(true)
		setSetupError(undefined)
		try {
			const result = await setupOrdinaryRule()
			setSetupHash(result.hash)
			setCompany(loadCompany())
		} catch (error) {
			setSetupError(error instanceof Error ? error.message : String(error))
		} finally {
			setBusy(false)
		}
	}

	// Accounts created before the policy was configured need it added to their rule.
	const addControlPolicy = async () => {
		setBusy(true)
		setSetupError(undefined)
		try {
			await installControlPolicy()
			setCompany(loadCompany())
		} catch (error) {
			setSetupError(error instanceof Error ? error.message : String(error))
		} finally {
			setBusy(false)
		}
	}

	const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setOutcome(undefined)
		setBusy(true)
		try {
			const result = await pay({
				to: recipient.trim(),
				amount: numericAmount,
				concept: concept.trim(),
				signers: [...signers],
			})
			setOutcome(outcomeFromResult(result))
		} catch (error) {
			setOutcome({
				kind: "error",
				message: error instanceof Error ? error.message : String(error),
			})
		} finally {
			setBusy(false)
		}
	}

	const canSubmit =
		Boolean(company) &&
		ordinaryReady &&
		Boolean(recipient.trim()) &&
		amountIsValid &&
		Boolean(concept.trim()) &&
		!busy

	return (
		<section className={styles.screen} aria-labelledby="payment-title">
			<div className={styles.heading}>
				<div>
					<h2 id="payment-title">Prepare a payment</h2>
					<p className={styles.intro}>
						The account checks the supplier, amount and signatures before
						anything leaves the treasury.
					</p>
				</div>
				<span className={styles.network}>STELLAR TESTNET</span>
			</div>

			<div className={styles.workspace}>
				<form
					className={styles.form}
					onSubmit={(event) => void submitPayment(event)}
				>
					<div className={styles.formTopline}>
						<span>Payment instruction</span>
						<span>Draft · XLM</span>
					</div>

					<div className={styles.field}>
						<label htmlFor="payment-supplier">Supplier account</label>
						{configuredSuppliers.length > 0 && !customSupplier ? (
							<div className={styles.supplierSelect}>
								<select
									id="payment-supplier"
									value={supplier}
									required
									onChange={(event) => {
										if (event.target.value === "__custom__") {
											setCustomSupplier(true)
											setSupplier("")
										} else setSupplier(event.target.value)
									}}
								>
									{configuredSuppliers.map((address) => (
										<option key={address} value={address}>
											Authorized · {shortAddress(address)}
										</option>
									))}
									<option value="__custom__">Enter another account…</option>
								</select>
								<span aria-hidden="true" className={styles.selectMark} />
							</div>
						) : (
							<div className={styles.addressInput}>
								<input
									id="payment-supplier"
									value={supplier}
									onChange={(event) => setSupplier(event.target.value)}
									placeholder="Paste a Stellar G… address"
									autoComplete="off"
									spellCheck={false}
									required
								/>
								{configuredSuppliers.length > 0 && (
									<button
										type="button"
										className={styles.subtleButton}
										onClick={() => {
											setCustomSupplier(false)
											setSupplier(configuredSuppliers[0] ?? "")
										}}
									>
										Choose authorized
									</button>
								)}
							</div>
						)}
						<p className={styles.hint}>
							{configuredSuppliers.length
								? customSupplier
									? "Unlisted accounts are checked by the account policy and should be rejected."
									: "Only suppliers on the account allowlist can receive a payment."
								: "No supplier list is configured in this testnet build. Enter an address to try the account rules."}
						</p>
					</div>

					<div className={styles.amountConcept}>
						<div className={styles.field}>
							<label htmlFor="payment-amount">Amount</label>
							<div className={styles.amountInput}>
								<input
									id="payment-amount"
									type="number"
									min="0.0000001"
									step="0.0000001"
									value={amount}
									onChange={(event) => setAmount(event.target.value)}
									required
								/>
								<span>XLM</span>
							</div>
						</div>
						<div className={styles.field}>
							<label htmlFor="payment-concept">Payment concept</label>
							<input
								id="payment-concept"
								value={concept}
								onChange={(event) => setConcept(event.target.value)}
								placeholder="e.g. Office supplies"
								maxLength={80}
								required
							/>
						</div>
					</div>

					<fieldset className={styles.signers}>
						<legend>Who will sign this instruction?</legend>
						<label
							className={signature === "employee" ? styles.signerActive : ""}
						>
							<input
								type="radio"
								name="signatures"
								value="employee"
								checked={signature === "employee"}
								onChange={() => setSignature("employee")}
							/>
							<span className={styles.signerSeal} aria-hidden="true">
								E
							</span>
							<span className={styles.signerCopy}>
								<strong>Employee</strong>
								<small>Single signature</small>
							</span>
							<span className={styles.signerCheck} aria-hidden="true" />
						</label>
						<label
							className={signature === "manager" ? styles.signerActive : ""}
						>
							<input
								type="radio"
								name="signatures"
								value="manager"
								checked={signature === "manager"}
								onChange={() => setSignature("manager")}
							/>
							<span
								className={`${styles.signerSeal} ${styles.managerSeal}`}
								aria-hidden="true"
							>
								<span>M</span>
							</span>
							<span className={styles.signerCopy}>
								<strong>Employee + manager</strong>
								<small>Two signatures required</small>
							</span>
							<span className={styles.signerCheck} aria-hidden="true" />
						</label>
					</fieldset>

					<div className={styles.quickAmounts} aria-label="Demo scenarios">
						<span>Try a scene</span>
						<button
							type="button"
							onClick={() => pickScenario(DEMO_AMOUNTS.below)}
						>
							Within limit <b>{DEMO_AMOUNTS.below}</b>
						</button>
						<button
							type="button"
							onClick={() => pickScenario(DEMO_AMOUNTS.above)}
						>
							Needs approval <b>{DEMO_AMOUNTS.above}</b>
						</button>
						<button
							type="button"
							onClick={() => pickScenario(DEMO_AMOUNTS.unknown, true)}
						>
							Unknown supplier <b>{DEMO_AMOUNTS.unknown}</b>
						</button>
					</div>

					<div className={styles.actions}>
						{!ordinaryReady ? (
							<button
								className={styles.primary}
								type="button"
								onClick={() => void prepareRule()}
								disabled={busy || !company}
							>
								{busy ? "Preparing account…" : "Set up payment rule"}
							</button>
						) : (
							<button
								className={styles.primary}
								type="submit"
								disabled={!canSubmit}
							>
								{busy ? "Checking account rules…" : "Simulate & pay"}
							</button>
						)}
						<span className={styles.actionNote}>
							{company
								? ordinaryReady
									? "The account checks this before submission."
									: "Add the ordinary rule before sending a payment."
								: "Create a company account above to enable payments."}
						</span>
					</div>
					{ordinaryReady && company && !company.controlPolicy && (
						<p>
							<button
								className={styles.primary}
								type="button"
								onClick={() => void addControlPolicy()}
								disabled={busy}
							>
								{busy
									? "Adding supplier list…"
									: "Add supplier list to ordinary rule (admin passkey)"}
							</button>
						</p>
					)}
					{setupError && (
						<p className={styles.inlineError} role="alert">
							{setupError}
						</p>
					)}
				</form>

				<aside className={styles.receipt} aria-label="Account rule preview">
					<div className={styles.receiptHead}>
						<span className={styles.receiptLight} />
						<span>ARQUEO · CONTROL SLIP</span>
						<span>TESTNET</span>
					</div>
					<div className={styles.slip}>
						<div className={styles.slipTitle}>
							<span>Rule preview</span>
							<strong>{selectedRule ?? "—"}</strong>
						</div>
						<dl>
							<div>
								<dt>PAY TO</dt>
								<dd>
									{recipient ? shortAddress(recipient) : "Choose a supplier"}
								</dd>
							</div>
							<div>
								<dt>AMOUNT</dt>
								<dd>
									{amountIsValid
										? numericAmount.toLocaleString("en-US", {
												maximumFractionDigits: 7,
											})
										: "—"}{" "}
									XLM
								</dd>
							</div>
							<div>
								<dt>CONCEPT</dt>
								<dd>{concept.trim() || "Add a concept"}</dd>
							</div>
							<div>
								<dt>CONTROL</dt>
								<dd>
									{suggestedRule === "ordinary"
										? "Within ordinary limit"
										: "Manager approval indicated"}
								</dd>
							</div>
							<div>
								<dt>SIGNERS</dt>
								<dd>{signers.join(" + ")}</dd>
							</div>
						</dl>
						<p className={styles.ruleNote}>
							{suggestedRule === "ordinary"
								? `Ordinary allows up to ${DEFAULT_LIMITS.maxPerPayment} XLM per payment.`
								: "The amount exceeds the ordinary limit. The account decides whether these signatures satisfy its large rule."}
						</p>
						<div className={styles.perforation} aria-hidden="true" />
						{!company ? (
							<div className={styles.resultEmpty}>
								<strong>Awaiting company account</strong>
								<span>
									Create the treasury above to prepare a signed instruction.
								</span>
							</div>
						) : outcome ? (
							<div
								className={`${styles.result} ${styles[outcome.kind]}`}
								aria-live="polite"
							>
								<strong>
									{outcome.kind === "accepted"
										? "PAYMENT ACCEPTED"
										: outcome.kind === "rejected"
											? "RULE REJECTED"
											: "PAYMENT NOT SENT"}
								</strong>
								{outcome.kind === "accepted" ? (
									<a
										href={testnetTx(outcome.hash)}
										target="_blank"
										rel="noreferrer"
									>
										View transaction ↗
									</a>
								) : (
									<>
										<span>
											{outcome.kind === "rejected"
												? outcome.reason
												: outcome.message}
										</span>
										{outcome.kind === "rejected" && outcome.details && (
											<details>
												<summary>Details</summary>
												<code>{outcome.details}</code>
											</details>
										)}
									</>
								)}
							</div>
						) : (
							<div className={styles.resultEmpty}>
								<strong>
									{ordinaryReady
										? "Ready for account review"
										: "Ordinary rule needs setup"}
								</strong>
								<span>
									{ordinaryReady
										? "Simulation and signature result will print here."
										: "Install the employee rule, then submit for a simulation."}
								</span>
							</div>
						)}
						{setupHash && (
							<a
								className={styles.setupLink}
								href={testnetTx(setupHash)}
								target="_blank"
								rel="noreferrer"
							>
								Ordinary rule transaction ↗
							</a>
						)}
					</div>
					<p className={styles.receiptFoot}>
						A failed simulation is logged here. Stellar enforces the same rules
						on-chain.
					</p>
				</aside>
			</div>
		</section>
	)
}
