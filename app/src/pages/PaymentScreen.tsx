import {
	Check,
	ChevronDown,
	CircleCheck,
	ExternalLink,
	Minus,
	ShieldX,
	TriangleAlert,
	UserRound,
	Users,
	X,
} from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { Spinner, useChanged } from "../components/Spinner"
import { DEMO_AMOUNTS } from "../controls/defaults"
import { capShortfall, remainingCap, ruleForSigners } from "../controls/rules"
import {
	loadCompany,
	loadControlsConfig,
	loadDemoOutsider,
	pay,
	readControlState,
	type ControlState,
} from "../lib/stellar"
import { Amount, AmountUnit } from "../components/Amount"
import ui from "../styles/ui.module.css"
import {
	UNKNOWN_SUPPLIER_DEMO,
	fieldErrors,
	type FieldErrors,
} from "./paymentFields"
import { outcomeFromResult, type Outcome } from "./paymentOutcome"
import { formatUsdc } from "../controls/format"
import styles from "./PaymentScreen.module.css"

type SignatureChoice = "employee" | "manager"
type CheckState = "pass" | "fail" | "idle"

const testnetTx = (hash: string) =>
	`https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(hash)}`

const shortAddress = (address: string) =>
	`${address.slice(0, 6)}…${address.slice(-5)}`

function CheckIcon({ state }: { state: CheckState }) {
	const changed = useChanged(state)
	return (
		<span
			className={`${styles.checkIcon} ${changed ? ui.popIn : ""}`}
			aria-hidden="true"
		>
			{state === "pass" ? (
				<Check size={13} strokeWidth={2.4} />
			) : state === "fail" ? (
				<X size={13} strokeWidth={2.4} />
			) : (
				<Minus size={13} strokeWidth={2.4} />
			)}
		</span>
	)
}

export default function PaymentScreen() {
	// What the admin set in Settings, and what the chain reports (R17, R23).
	const [controls, setControls] = useState(() => loadControlsConfig())
	const [chain, setChain] = useState<ControlState>()
	const fromChain = chain?.source === "chain" ? chain : undefined
	const limits = (fromChain?.config ?? controls).limits
	const configuredSuppliers = (fromChain?.config ?? controls).suppliers.map(
		(s) => s.address,
	)
	const [supplier, setSupplier] = useState(configuredSuppliers[0] ?? "")
	const [customSupplier, setCustomSupplier] = useState(false)
	const [amount, setAmount] = useState(String(DEMO_AMOUNTS.below))
	const [concept, setConcept] = useState("")
	const [signature, setSignature] = useState<SignatureChoice>("employee")
	const [busy, setBusy] = useState(false)
	const [outcome, setOutcome] = useState<Outcome>()
	const [errors, setErrors] = useState<FieldErrors>({})
	const clearError = (field: keyof FieldErrors) =>
		setErrors((current) => ({ ...current, [field]: undefined }))

	const [company, setCompany] = useState(() => loadCompany())
	useEffect(() => {
		let cancelled = false
		const refresh = () => {
			setCompany(loadCompany())
			setControls(loadControlsConfig())
			readControlState()
				.then((state) => {
					if (!cancelled) setChain(state)
				})
				.catch(() => undefined)
		}
		refresh()
		// A payment changes what is left of the cap; a setup or a settings change
		// changes the limits.
		const events = ["arqueo:company-updated", "arqueo:payment-recorded"]
		events.forEach((name) => window.addEventListener(name, refresh))
		return () => {
			cancelled = true
			events.forEach((name) => window.removeEventListener(name, refresh))
		}
	}, [])
	const numericAmount = Number(amount)
	const amountIsValid = Number.isFinite(numericAmount) && numericAmount > 0
	const signers =
		signature === "employee"
			? (["employee"] as const)
			: (["employee", "manager"] as const)
	const selectedRule = ruleForSigners([...signers])
	const recipient = supplier
	const ordinaryReady = company?.rules?.ordinary !== undefined
	const largeReady = company?.rules?.large !== undefined
	const ruleReady = signature === "manager" ? largeReady : ordinaryReady

	const pickScenario = (nextAmount: number, useUnknownSupplier = false) => {
		setAmount(String(nextAmount))
		setSignature("employee")
		setOutcome(undefined)
		if (useUnknownSupplier) {
			setCustomSupplier(true)
			setSupplier(loadDemoOutsider() ?? UNKNOWN_SUPPLIER_DEMO)
		} else if (configuredSuppliers[0]) {
			setCustomSupplier(false)
			setSupplier(configuredSuppliers[0])
		}
	}

	const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const found = fieldErrors({ supplier: recipient, amount, concept })
		setErrors(found)
		if (Object.keys(found).length > 0) return
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

	const canSubmit = Boolean(company) && ruleReady && !busy
	// The account is prepared in the Company account card; the form only says what is missing.
	const actionNote = !company
		? "Create the company account above to enable payments."
		: !ordinaryReady
			? "Set up the ordinary rule in the Company account card first."
			: signature === "manager" && !largeReady
				? "Set up the manager rule in the Company account card first."
				: "The account checks this before submission."

	// A hint only: the account decides on-chain. Mirrors the checks of the ordinary and large rules.
	const trimmedRecipient = recipient.trim()
	const listed =
		configuredSuppliers.length > 0 && trimmedRecipient
			? configuredSuppliers.includes(trimmedRecipient)
			: undefined
	const underLimit = amountIsValid
		? numericAmount <= limits.maxPerPayment
		: undefined
	// What is left of the cap is only known when the chain could be read.
	const cap = limits.cap30d
	const left = fromChain ? remainingCap(limits, fromChain.spentXlm) : undefined
	const overCap =
		fromChain && amountIsValid
			? capShortfall(numericAmount, limits, fromChain.spentXlm)
			: undefined
	const stateOf = (ok: boolean | undefined): CheckState =>
		ok === undefined ? "idle" : ok ? "pass" : "fail"
	const checks: { label: string; detail?: string; state: CheckState }[] = [
		{
			label: "Supplier is on the allowlist",
			state: stateOf(listed),
			detail:
				listed === false
					? "The account refuses unlisted accounts."
					: configuredSuppliers.length === 0
						? "No supplier list in this build."
						: !trimmedRecipient
							? "Choose or paste a supplier."
							: undefined,
		},
		signature === "manager"
			? { label: "No per-payment limit on the large rule", state: "pass" }
			: {
					label: `Within ${formatUsdc(limits.maxPerPayment)} USDC per payment`,
					state: stateOf(underLimit),
					detail:
						underLimit === false
							? "Add the manager's signature to go above it."
							: undefined,
				},
		...(signature === "manager"
			? []
			: [
					{
						label:
							left === undefined
								? `Within ${formatUsdc(cap)} USDC every ${limits.periodDays} days`
								: `Within what is left of the ${formatUsdc(cap)} USDC ${limits.periodDays}-day cap`,
						state:
							overCap === undefined
								? ("idle" as const)
								: overCap === 0
									? ("pass" as const)
									: ("fail" as const),
						detail:
							left === undefined
								? "Spending is checked on-chain."
								: overCap
									? left === 0
										? `The cap is used up. Add the manager's signature to pay ${formatUsdc(overCap)} USDC.`
										: `${formatUsdc(overCap)} USDC over what is left (${formatUsdc(left)} of ${formatUsdc(cap)} USDC). Add the manager's signature to go above it.`
									: `${formatUsdc(left)} of ${formatUsdc(cap)} USDC left this period.`,
					},
				]),
		{
			label:
				signature === "manager"
					? "Signed by employee and manager"
					: "Signed by employee",
			state: "pass",
		},
	]

	return (
		<section className={styles.screen} aria-labelledby="payment-title">
			<div className={styles.heading}>
				<h2 id="payment-title" className={ui.sectionTitle}>
					Prepare a payment
				</h2>
				<p>
					The account checks the supplier, amount and signatures before anything
					leaves the treasury.
				</p>
			</div>

			<div className={styles.workspace}>
				<form
					className={`${ui.card} ${styles.form}`}
					noValidate
					onSubmit={(event) => void submitPayment(event)}
				>
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
								<ChevronDown
									className={styles.selectMark}
									size={18}
									strokeWidth={1.8}
									aria-hidden="true"
								/>
							</div>
						) : (
							<div className={styles.addressInput}>
								<input
									id="payment-supplier"
									value={supplier}
									onChange={(event) => {
										setSupplier(event.target.value)
										clearError("supplier")
									}}
									placeholder="Paste a Stellar G… address"
									autoComplete="off"
									spellCheck={false}
								/>
								{configuredSuppliers.length > 0 && (
									<button
										type="button"
										className={`${ui.button} ${ui.small}`}
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
						{errors.supplier && (
							<p className={styles.inlineError} role="alert">
								{errors.supplier}
							</p>
						)}
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
									onChange={(event) => {
										setAmount(event.target.value)
										clearError("amount")
									}}
								/>
								<span>USDC</span>
							</div>
							{errors.amount && (
								<p className={styles.inlineError} role="alert">
									{errors.amount}
								</p>
							)}
						</div>
						<div className={styles.field}>
							<label htmlFor="payment-concept">Payment concept</label>
							<input
								id="payment-concept"
								value={concept}
								onChange={(event) => {
									setConcept(event.target.value)
									clearError("concept")
								}}
								placeholder="e.g. Office supplies"
								maxLength={80}
							/>
							{errors.concept && (
								<p className={styles.inlineError} role="alert">
									{errors.concept}
								</p>
							)}
						</div>
					</div>

					<fieldset className={styles.signers}>
						<legend>Who will sign this instruction?</legend>
						<div className={styles.signerOptions}>
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
								<span className={styles.signerIcon} aria-hidden="true">
									<UserRound size={18} strokeWidth={1.8} />
								</span>
								<span className={styles.signerCopy}>
									<strong>Employee</strong>
									<small>Single signature</small>
								</span>
								<Check
									className={styles.signerCheck}
									size={16}
									strokeWidth={2.2}
									aria-hidden="true"
								/>
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
								<span className={styles.signerIcon} aria-hidden="true">
									<Users size={18} strokeWidth={1.8} />
								</span>
								<span className={styles.signerCopy}>
									<strong>Employee + manager</strong>
									<small>Two signatures required</small>
								</span>
								<Check
									className={styles.signerCheck}
									size={16}
									strokeWidth={2.2}
									aria-hidden="true"
								/>
							</label>
						</div>
					</fieldset>

					<div className={styles.quickAmounts} aria-label="Demo scenarios">
						<span className={ui.label}>Try a scene</span>
						<button
							type="button"
							className={`${ui.button} ${ui.small}`}
							onClick={() => pickScenario(DEMO_AMOUNTS.below)}
						>
							Within limit <b>{DEMO_AMOUNTS.below}</b>
						</button>
						<button
							type="button"
							className={`${ui.button} ${ui.small}`}
							onClick={() => pickScenario(DEMO_AMOUNTS.above)}
						>
							Needs approval <b>{DEMO_AMOUNTS.above}</b>
						</button>
						<button
							type="button"
							className={`${ui.button} ${ui.small}`}
							onClick={() => pickScenario(DEMO_AMOUNTS.unknown, true)}
						>
							Unknown supplier <b>{DEMO_AMOUNTS.unknown}</b>
						</button>
					</div>

					<div className={styles.actions}>
						<button
							className={`${ui.button} ${ui.primary}`}
							type="submit"
							disabled={!canSubmit}
						>
							{busy && <Spinner />}
							{busy ? "Checking account rules…" : "Simulate & pay"}
						</button>
						<span className={styles.actionNote}>{actionNote}</span>
					</div>
				</form>

				<aside
					className={`${ui.card} ${styles.preview}`}
					aria-label="Rule preview"
				>
					<div className={styles.previewHead}>
						<h3>Rule preview</h3>
						<span
							className={`${ui.pill} ${selectedRule === "large" ? ui.pillDark : ui.pillOk}`}
						>
							{selectedRule ?? "—"}
						</span>
					</div>
					<div className={styles.summary}>
						<span className={styles.amountFigure}>
							{amountIsValid ? <Amount usdc={numericAmount} /> : "—"}
							<small>
								<AmountUnit />
							</small>
						</span>
						<span className={styles.summaryTo}>
							{recipient ? (
								<>
									to <span className={ui.mono}>{shortAddress(recipient)}</span>
								</>
							) : (
								"No supplier chosen"
							)}
						</span>
						{concept.trim() && (
							<span className={styles.summaryConcept}>{concept.trim()}</span>
						)}
					</div>

					<div className={styles.tear} aria-hidden="true">
						<span />
						<span />
					</div>

					<ul className={styles.checks} aria-label="Rule checks, preview">
						{checks.map((check) => (
							<li key={check.label} data-state={check.state}>
								<CheckIcon state={check.state} />
								<span className={styles.checkText}>
									{check.label}
									<span className={ui.srOnly}>
										{check.state === "pass"
											? ": passes"
											: check.state === "fail"
												? ": fails"
												: ": not checked here"}
									</span>
									{check.detail && (
										<span className={styles.checkDetail}>{check.detail}</span>
									)}
								</span>
							</li>
						))}
					</ul>
					<p className={styles.previewNote}>
						Preview only. The account decides when you submit.
					</p>

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
								{outcome.kind === "accepted" ? (
									<CircleCheck size={18} strokeWidth={1.8} aria-hidden="true" />
								) : outcome.kind === "rejected" ? (
									<ShieldX size={18} strokeWidth={1.8} aria-hidden="true" />
								) : (
									<TriangleAlert
										size={18}
										strokeWidth={1.8}
										aria-hidden="true"
									/>
								)}
								{outcome.kind === "accepted"
									? "Payment accepted"
									: outcome.kind === "rejected"
										? "Refused by the account rules"
										: "Payment not sent"}
							</strong>
							{outcome.kind === "accepted" ? (
								<a
									className={styles.resultLink}
									href={testnetTx(outcome.hash)}
									target="_blank"
									rel="noreferrer"
								>
									View transaction
									<ExternalLink
										size={14}
										strokeWidth={1.8}
										aria-hidden="true"
									/>
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
									? "The simulation result will appear here."
									: "Set up the ordinary rule in the Company account card."}
							</span>
						</div>
					)}
					<p className={styles.foot}>
						Refused attempts are logged in the{" "}
						<Link className={ui.link} to="/auditor">
							auditor journal
						</Link>
						.
					</p>
				</aside>
			</div>
		</section>
	)
}
