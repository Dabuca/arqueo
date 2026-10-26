import {
	Check,
	Circle,
	CircleCheck,
	Copy,
	ExternalLink,
	Minus,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import {
	createCompanyAccount,
	fundCompanyAccount,
	getBalance,
	getUsdcFundingAddress,
	installControlPolicy,
	listPayments,
	loadCompany,
	loadRecoveryPackage,
	loadControlsConfig,
	createRecoveryPackage,
	importRecoveryPackage,
	readControlState,
	prepareUsdcFundingAddress,
	fundCompanyXlmAccount,
	recoverAdminAccess,
	setupRecoveryRule,
	setupLargeRule,
	setupOrdinaryRule,
	type ControlState,
	type Payment,
	type PaymentAsset,
} from "../lib/stellar"
import ui from "../styles/ui.module.css"
import { Amount, AmountUnit } from "./Amount"
import styles from "./CompanyBalance.module.css"
import { formatUsdc } from "../controls/format"
import { Spinner, useChanged } from "./Spinner"

type BalanceState =
	| { status: "loading" }
	| { status: "ok"; xlm: number; usdc: number }
	| { status: "error"; message: string }

type Step =
	| "create"
	| "fund"
	| "ordinary"
	| "suppliers"
	| "manager"
	| "recovery-setup"
	| "recovery"
	| "recovery-import"

const errorMessage = (error: unknown) =>
	error instanceof Error ? error.message : String(error)

const testnetTx = (hash: string) =>
	`https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(hash)}`

const DAY_MS = 86_400_000

// Approximate: ordinary-rule payments that settled in this browser's journal, not read from the chain.
const spentInPeriod = (
	payments: Payment[],
	periodDays: number,
	asset: PaymentAsset,
) =>
	payments
		.filter(
			(payment) =>
				payment.status === "ok" &&
				payment.asset === asset &&
				payment.rule === "ordinary" &&
				Date.now() - new Date(payment.at).getTime() <= periodDays * DAY_MS,
		)
		.reduce((total, payment) => total + payment.amount, 0)

const STEP_COPY: Record<
	Exclude<Step, "create">,
	{ label: string; busy: string; note: string; optional?: boolean }
> = {
	fund: {
		label: "Prepare Circle funding",
		busy: "Funding…",
		note: "Request USDC from Circle's testnet faucet.",
	},
	ordinary: {
		label: "Set up ordinary rule",
		busy: "Setting up ordinary rule…",
		note: "Needs the admin passkey.",
	},
	suppliers: {
		label: "Add supplier list",
		busy: "Adding supplier list…",
		note: "Needs the admin passkey.",
	},
	manager: {
		label: "Set up manager rule",
		busy: "Setting up manager rule…",
		note: "Optional. Needs the admin passkey.",
		optional: true,
	},
	"recovery-setup": {
		label: "Set up 2-of-3 recovery",
		busy: "Setting up recovery passkeys…",
		note: "Enroll three guardian passkeys.",
	},
	recovery: {
		label: "Recover admin access",
		busy: "Recovering admin access…",
		note: "Two selected guardians must approve.",
	},
	"recovery-import": {
		label: "Import recovery package",
		busy: "Checking recovery package…",
		note: "Public account data only.",
	},
}

function RuleIcon({ done, optional }: { done: boolean; optional?: boolean }) {
	const changed = useChanged(done)
	return (
		<span
			className={`${styles.ruleIcon} ${done ? styles.done : ""} ${changed ? ui.popIn : ""}`}
			aria-hidden="true"
		>
			{done ? (
				<CircleCheck size={18} strokeWidth={1.8} />
			) : optional ? (
				<Minus size={18} strokeWidth={1.8} />
			) : (
				<Circle size={18} strokeWidth={1.8} />
			)}
		</span>
	)
}

export function CompanyBalance() {
	const [company, setCompany] = useState(() => loadCompany())
	const [recoveryPackage, setRecoveryPackage] = useState(() =>
		loadRecoveryPackage(),
	)
	const [balance, setBalance] = useState<BalanceState>({ status: "loading" })
	const [fundingAddress, setFundingAddress] = useState(() =>
		getUsdcFundingAddress(),
	)
	const [spent, setSpent] = useState<Partial<Record<PaymentAsset, number>>>({})
	// What the chain enforces, when it can be read: it wins over the journal.
	const [chain, setChain] = useState<
		Partial<Record<PaymentAsset, ControlState>>
	>({})
	const limits = (
		chain.USDC?.config ??
		chain.XLM?.config ??
		loadControlsConfig()
	).limits
	const [working, setWorking] = useState<Step>()
	const [error, setError] = useState<string>()
	const [lastTx, setLastTx] = useState<string>()
	const [fundCount, setFundCount] = useState(0)
	const [copied, setCopied] = useState(false)
	const [guardianIndexes, setGuardianIndexes] = useState([0, 1])
	// R20: off by default, so the four scenes keep their one-device flow.
	const [managerOnPhone, setManagerOnPhone] = useState(false)

	const address = company?.address

	useEffect(() => {
		const refresh = () => {
			setCompany(loadCompany())
			setRecoveryPackage(loadRecoveryPackage())
		}
		window.addEventListener("arqueo:company-updated", refresh)
		return () => window.removeEventListener("arqueo:company-updated", refresh)
	}, [])

	useEffect(() => {
		if (!address) return
		let cancelled = false
		setBalance({ status: "loading" })
		Promise.all([getBalance("XLM"), getBalance("USDC")])
			.then(([xlm, usdc]) => {
				if (!cancelled) setBalance({ status: "ok", xlm, usdc })
			})
			.catch((cause: unknown) => {
				if (!cancelled) {
					setBalance({ status: "error", message: errorMessage(cause) })
				}
			})
		return () => {
			cancelled = true
		}
	}, [address, fundCount])

	const refreshSpent = useCallback(() => {
		listPayments()
			.then((payments) =>
				setSpent((current) => ({
					...current,
					USDC: spentInPeriod(
						payments,
						loadControlsConfig().limits.periodDays,
						"USDC",
					),
				})),
			)
			.catch(() => setSpent((current) => ({ ...current, USDC: undefined })))
		listPayments()
			.then((payments) =>
				setSpent((current) => ({
					...current,
					XLM: spentInPeriod(
						payments,
						loadControlsConfig().limits.periodDays,
						"XLM",
					),
				})),
			)
			.catch(() => setSpent((current) => ({ ...current, XLM: undefined })))
		Promise.all([readControlState("USDC"), readControlState("XLM")])
			.then(([usdc, xlm]) => setChain({ USDC: usdc, XLM: xlm }))
			.catch(() => undefined)
	}, [])

	useEffect(() => {
		refreshSpent()
		window.addEventListener("arqueo:payment-recorded", refreshSpent)
		window.addEventListener("arqueo:company-updated", refreshSpent)
		window.addEventListener("storage", refreshSpent)
		return () => {
			window.removeEventListener("arqueo:company-updated", refreshSpent)
			window.removeEventListener("arqueo:payment-recorded", refreshSpent)
			window.removeEventListener("storage", refreshSpent)
		}
	}, [refreshSpent])

	useEffect(() => {
		if (!copied) return
		const timer = window.setTimeout(() => setCopied(false), 1500)
		return () => window.clearTimeout(timer)
	}, [copied])

	// Every step may change the saved company, even when it fails half way.
	const run = async (step: Step, action: () => Promise<unknown>) => {
		setWorking(step)
		setError(undefined)
		try {
			const result = await action()
			const hash =
				typeof result === "string"
					? result
					: (result as { hash?: string } | undefined)?.hash
			if (hash) setLastTx(hash)
			if (step === "fund") setFundingAddress(getUsdcFundingAddress())
			if (step === "fund") setFundCount((count) => count + 1)
		} catch (cause) {
			setError(errorMessage(cause))
		} finally {
			setCompany(loadCompany())
			setRecoveryPackage(loadRecoveryPackage())
			window.dispatchEvent(new Event("arqueo:company-updated"))
			setWorking(undefined)
		}
	}

	const copyAddress = async () => {
		if (!address) return
		try {
			await navigator.clipboard.writeText(address)
			setCopied(true)
		} catch {
			// Clipboard blocked: the address stays selectable through the explorer link.
		}
	}

	const copyFundingAddress = async () => {
		if (!fundingAddress) return
		try {
			await navigator.clipboard.writeText(fundingAddress)
			setCopied(true)
		} catch {
			// The address remains visible for manual selection.
		}
	}

	const downloadRecoveryPackage = () => {
		try {
			const data = createRecoveryPackage()
			const blob = new Blob([JSON.stringify(data, null, 2)], {
				type: "application/json",
			})
			const url = URL.createObjectURL(blob)
			const link = document.createElement("a")
			link.href = url
			link.download = `arqueo-recovery-${data.companyAddress.slice(0, 8)}.json`
			link.click()
			window.setTimeout(() => URL.revokeObjectURL(url), 1000)
		} catch (cause) {
			setError(errorMessage(cause))
		}
	}

	const importRecoveryFile = async (file: File | undefined) => {
		if (!file) return
		setWorking("recovery-import")
		setError(undefined)
		try {
			const imported = importRecoveryPackage(await file.text())
			setRecoveryPackage(imported)
		} catch (cause) {
			setError(errorMessage(cause))
		} finally {
			setWorking(undefined)
		}
	}

	const ordinaryReady = company?.rules?.ordinary !== undefined
	const suppliersReady =
		ordinaryReady && company?.controlPolicy?.ruleId === company?.rules?.ordinary
	const managerReady = company?.rules?.large !== undefined
	const xlmRules = company?.assetRules?.XLM ?? {}
	const ready =
		ordinaryReady &&
		suppliersReady &&
		xlmRules.ordinary !== undefined &&
		balance.status === "ok"
	const readyChanged = useChanged(ready)

	// One step at a time: funds, then the ordinary rule, its supplier list, and the optional manager rule.
	const next: Exclude<Step, "create"> | undefined = !ordinaryReady
		? "ordinary"
		: !suppliersReady
			? "suppliers"
			: !managerReady
				? "manager"
				: undefined

	const nextChanged = useChanged(next)

	const runNext = () => {
		if (next === "ordinary")
			void run("ordinary", () => setupOrdinaryRule("USDC"))
		else if (next === "suppliers") void run("suppliers", installControlPolicy)
		else if (next === "manager") void run("manager", setupLargeRule)
	}

	const rules = [
		{
			key: "ordinary",
			name: "Ordinary rule",
			done: ordinaryReady,
			text: ordinaryReady
				? `Employee, up to ${formatUsdc(limits.maxPerPayment)} USDC per payment`
				: "Not set up",
		},
		{
			key: "suppliers",
			name: "Supplier list",
			done: suppliersReady,
			text: suppliersReady
				? "Allowlist on the ordinary rule"
				: ordinaryReady
					? "Not added"
					: "Needs the ordinary rule",
		},
		{
			key: "manager",
			name: "Manager rule",
			done: managerReady,
			optional: true,
			text: managerReady
				? "Employee and manager"
				: "Optional until a payment needs the manager",
		},
	]

	return (
		<section
			className={`${ui.card} ${styles.card}`}
			aria-labelledby="treasury-title"
		>
			<div className={styles.head}>
				<h2 id="treasury-title" className={ui.sectionTitle}>
					Company account
				</h2>
				{company && (
					<span
						className={`${ui.pill} ${ready ? ui.pillOk : ""} ${readyChanged ? ui.popIn : ""}`}
					>
						{ready ? "Ready to pay" : "Setup needed"}
					</span>
				)}
			</div>

			{!company ? (
				<div className={styles.first}>
					<div className={styles.firstCopy}>
						<h3>Create the company account</h3>
						<p>
							A smart account on Stellar testnet with your passkey as admin. It
							holds the treasury and enforces the payment rules. XLM and Circle
							USDC test tokens only; no real funds.
						</p>
						<label className={styles.phoneOption}>
							<input
								type="checkbox"
								checked={managerOnPhone}
								onChange={(event) => setManagerOnPhone(event.target.checked)}
								disabled={working !== undefined}
							/>
							<span>
								Register the manager's passkey on a phone
								<span className={styles.phoneHint}>
									Your browser will show a QR code. Scan it with the manager's
									phone.
								</span>
							</span>
						</label>
					</div>
					<button
						type="button"
						className={`${ui.button} ${ui.primary} ${styles.big}`}
						onClick={() =>
							void run("create", () => createCompanyAccount({ managerOnPhone }))
						}
						disabled={working !== undefined}
					>
						{working === "create" && <Spinner />}
						{working === "create"
							? "Creating account…"
							: "Create company account"}
					</button>
					<div className={styles.recovery}>
						<div>
							<strong>Recover an existing treasury</strong>
							<p className={styles.caption}>
								Import the public recovery package exported from the original
								profile.
							</p>
							<label className={ui.button}>
								Import recovery package
								<input
									type="file"
									accept="application/json,.json"
									hidden
									onChange={(event) => {
										void importRecoveryFile(event.target.files?.[0])
										event.target.value = ""
									}}
								/>
							</label>
							{recoveryPackage && (
								<>
									<p className={styles.address}>
										{recoveryPackage.companyAddress.slice(0, 8)}…
										{recoveryPackage.companyAddress.slice(-6)}
									</p>
									<fieldset className={styles.guardians}>
										<legend>Choose two guardians to approve recovery</legend>
										{recoveryPackage.recovery.guardians.map(
											(guardian, index) => (
												<label key={guardian.credentialId}>
													<input
														type="checkbox"
														checked={guardianIndexes.includes(index)}
														onChange={(event) =>
															setGuardianIndexes((current) =>
																event.target.checked
																	? [...current, index].slice(-2)
																	: current.filter(
																			(selected) => selected !== index,
																		),
															)
														}
													/>
													Guardian {index + 1}
												</label>
											),
										)}
									</fieldset>
									<button
										type="button"
										className={ui.button}
										onClick={() =>
											void run("recovery", () =>
												recoverAdminAccess(guardianIndexes),
											)
										}
										disabled={
											working !== undefined || guardianIndexes.length !== 2
										}
									>
										{working === "recovery" && <Spinner />}
										Recover admin access
									</button>
								</>
							)}
						</div>
					</div>
				</div>
			) : (
				<>
					<dl className={styles.summary}>
						<div className={styles.item}>
							<dt className={ui.label}>Account</dt>
							<dd className={styles.addressRow}>
								<span className={styles.address} title={address}>
									{address?.slice(0, 8)}…{address?.slice(-6)}
								</span>
								<button
									type="button"
									className={styles.iconButton}
									onClick={() => void copyAddress()}
									aria-label="Copy account address"
								>
									{copied ? (
										<Check size={15} strokeWidth={2} aria-hidden="true" />
									) : (
										<Copy size={15} strokeWidth={1.8} aria-hidden="true" />
									)}
								</button>
								<a
									className={styles.iconButton}
									href={`https://stellar.expert/explorer/testnet/contract/${address}`}
									target="_blank"
									rel="noreferrer"
									aria-label="View account on Stellar Expert"
								>
									<ExternalLink
										size={15}
										strokeWidth={1.8}
										aria-hidden="true"
									/>
								</a>
								<span className={ui.srOnly} role="status">
									{copied ? "Address copied" : ""}
								</span>
							</dd>
						</div>

						<div className={styles.item}>
							<dt className={ui.label}>Balance</dt>
							<dd>
								{balance.status === "loading" && (
									<span
										className={styles.skeleton}
										role="status"
										aria-label="Reading testnet balance"
									/>
								)}
								{balance.status === "error" && (
									<span className={styles.muted}>Unavailable</span>
								)}
								{balance.status === "ok" && (
									<span className={styles.balancePair}>
										<span>
											<Amount value={balance.usdc} asset="USDC" />{" "}
											<AmountUnit asset="USDC" />
										</span>
										<span>
											<Amount value={balance.xlm} asset="XLM" />{" "}
											<AmountUnit asset="XLM" />
										</span>
									</span>
								)}
							</dd>
						</div>

						{(["USDC", "XLM"] as const).map((asset) => {
							const state = chain[asset]
							const amount =
								state?.source === "chain" ? state.spentXlm : spent[asset]
							return amount === undefined ? null : (
								<div className={styles.item} key={asset}>
									<dt className={ui.label}>{asset} spent, 30 days</dt>
									<dd>
										<span className={styles.spent}>
											{state?.source === "chain" ? "" : "≈ "}
											<Amount value={amount} asset={asset} /> /{" "}
											<Amount value={limits.cap30d} asset={asset} /> {asset}
										</span>
										<span className={styles.caption}>
											{state?.source === "chain"
												? "Ordinary rule, read from the chain"
												: "Ordinary rule, from this browser\u2019s journal"}
										</span>
									</dd>
								</div>
							)
						})}
					</dl>

					<div className={styles.setup}>
						<ul className={styles.rules} aria-label="Account rules">
							{rules.map((rule) => (
								<li key={rule.key}>
									<RuleIcon done={rule.done} optional={rule.optional} />
									<span className={styles.ruleText}>
										<strong>
											{rule.name}
											<span className={ui.srOnly}>
												{rule.done
													? ": ready"
													: rule.optional
														? ": optional"
														: ": to do"}
											</span>
										</strong>
										<span>{rule.text}</span>
									</span>
								</li>
							))}
						</ul>
						<div className={styles.assetRules}>
							<strong>XLM rules</strong>
							<span>
								{xlmRules.ordinary === undefined
									? "Ordinary rule not set up"
									: "Ordinary rule ready"}
							</span>
							{xlmRules.ordinary === undefined && (
								<button
									type="button"
									className={`${ui.button} ${ui.small}`}
									disabled={working !== undefined}
									onClick={() =>
										void run("ordinary", () => setupOrdinaryRule("XLM"))
									}
								>
									Set up XLM ordinary rule
								</button>
							)}
							{xlmRules.large === undefined && (
								<button
									type="button"
									className={`${ui.button} ${ui.small}`}
									disabled={working !== undefined}
									onClick={() =>
										void run("manager", () => setupLargeRule("XLM"))
									}
								>
									Set up XLM manager rule
								</button>
							)}
						</div>
						<div className={styles.assetRules}>
							<strong>USDC funding</strong>
							<p>
								Prepare a temporary G address, request Circle test USDC to it
								(the faucet provides 20 USDC per request), then transfer it to
								the treasury. The treasury address itself cannot receive faucet
								funds because it is a smart contract account.
							</p>
							{fundingAddress && (
								<code className={styles.address}>{fundingAddress}</code>
							)}
							<div className={styles.actions}>
								<button
									type="button"
									className={`${ui.button} ${ui.small}`}
									disabled={working !== undefined}
									onClick={() => void run("fund", prepareUsdcFundingAddress)}
								>
									Prepare faucet address
								</button>
								{fundingAddress && (
									<button
										type="button"
										className={`${ui.button} ${ui.small}`}
										onClick={() => void copyFundingAddress()}
									>
										Copy address
									</button>
								)}
								<a
									className={`${ui.button} ${ui.small}`}
									href="https://faucet.circle.com/"
									target="_blank"
									rel="noreferrer"
								>
									Open Circle faucet
								</a>

								<button
									type="button"
									className={`${ui.button} ${ui.small}`}
									disabled={working !== undefined || !fundingAddress}
									onClick={() => void run("fund", fundCompanyAccount)}
								>
									Transfer USDC to treasury
								</button>
								<button
									type="button"
									className={`${ui.button} ${ui.small}`}
									disabled={working !== undefined}
									onClick={() => void run("fund", fundCompanyXlmAccount)}
								>
									Fund test XLM
								</button>
							</div>
						</div>

						{next && (
							<div
								key={next}
								className={`${styles.next} ${nextChanged ? ui.enter : ""}`}
							>
								<button
									type="button"
									className={`${ui.button} ${STEP_COPY[next].optional ? "" : ui.primary}`}
									onClick={runNext}
									disabled={working !== undefined}
								>
									{working === next && <Spinner />}
									{working === next
										? STEP_COPY[next].busy
										: STEP_COPY[next].label}
								</button>
								<span className={styles.caption}>{STEP_COPY[next].note}</span>
							</div>
						)}
					</div>
					<div className={styles.recovery}>
						<div>
							<strong>Admin recovery</strong>
							<p className={styles.caption}>
								{company.recovery
									? "Two of three recovery passkeys can replace the admin passkey."
									: "Enroll three guardian passkeys before you need to recover access. Choose a different authenticator for each guardian."}
							</p>
							<p className={styles.caption}>
								Export the public recovery package and give each guardian a
								copy. It contains no private keys.
							</p>
							{company.recovery && (
								<fieldset className={styles.guardians}>
									<legend>Choose two guardians to approve recovery</legend>
									{company.recovery.guardians.map((guardian, index) => (
										<label key={guardian.credentialId}>
											<input
												type="checkbox"
												checked={guardianIndexes.includes(index)}
												onChange={(event) => {
													setGuardianIndexes((current) =>
														event.target.checked
															? [...current, index].slice(-2)
															: current.filter(
																	(selected) => selected !== index,
																),
													)
												}}
											/>
											Guardian {index + 1}
										</label>
									))}
								</fieldset>
							)}
						</div>
						<button
							type="button"
							className={ui.button}
							onClick={() =>
								void run(
									company.recovery ? "recovery" : "recovery-setup",
									() =>
										company.recovery
											? recoverAdminAccess(guardianIndexes)
											: setupRecoveryRule(),
								)
							}
							disabled={
								working !== undefined ||
								(company.recovery !== undefined && guardianIndexes.length !== 2)
							}
						>
							{working?.startsWith("recovery") && <Spinner />}
							{company.recovery
								? "Recover admin access"
								: "Set up 2-of-3 recovery"}
						</button>
						{company.recovery && (
							<button
								type="button"
								className={ui.button}
								onClick={downloadRecoveryPackage}
							>
								Export recovery package
							</button>
						)}
					</div>
				</>
			)}

			{error && (
				<p className={ui.alert} role="alert">
					<strong>Could not complete the step</strong>
					<span>{error}</span>
				</p>
			)}
			{company && balance.status === "error" && (
				<p className={ui.alert} role="alert">
					<strong>Could not read the balance</strong>
					<span>{balance.message}</span>
				</p>
			)}
			{company?.recoveredFromPackage && (
				<p className={ui.alert} role="status">
					<strong>Admin access restored</strong>
					<span>
						The public recovery package does not contain the employee's private
						payment key or the local payment journal. Re-enroll payment signers
						before sending payments from this device.
					</span>
				</p>
			)}
			{lastTx && (
				<a
					className={styles.txLink}
					href={testnetTx(lastTx)}
					target="_blank"
					rel="noreferrer"
				>
					Last transaction
					<ExternalLink size={14} strokeWidth={1.8} aria-hidden="true" />
				</a>
			)}
		</section>
	)
}
