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
	installControlPolicy,
	listPayments,
	loadCompany,
	loadControlsConfig,
	readControlState,
	setupLargeRule,
	setupOrdinaryRule,
	type ControlState,
	type Payment,
} from "../lib/stellar"
import ui from "../styles/ui.module.css"
import { Amount, AmountUnit } from "./Amount"
import styles from "./CompanyBalance.module.css"
import { formatXlm } from "../controls/format"
import { useCurrency } from "../providers/CurrencyProvider"
import { Spinner, useChanged } from "./Spinner"

type BalanceState =
	| { status: "loading" }
	| { status: "ok"; xlm: number }
	| { status: "error"; message: string }

type Step = "create" | "fund" | "ordinary" | "suppliers" | "manager"

const errorMessage = (error: unknown) =>
	error instanceof Error ? error.message : String(error)

const testnetTx = (hash: string) =>
	`https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(hash)}`

const DAY_MS = 86_400_000

// Approximate: ordinary-rule payments that settled in this browser's journal, not read from the chain.
const spentInPeriod = (payments: Payment[], periodDays: number) =>
	payments
		.filter(
			(payment) =>
				payment.status === "ok" &&
				payment.rule === "ordinary" &&
				Date.now() - new Date(payment.at).getTime() <= periodDays * DAY_MS,
		)
		.reduce((total, payment) => total + payment.amount, 0)

const STEP_COPY: Record<
	Exclude<Step, "create">,
	{ label: string; busy: string; note: string; optional?: boolean }
> = {
	fund: {
		label: "Fund with testnet XLM",
		busy: "Funding…",
		note: "Test XLM from Friendbot.",
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
	const { rate } = useCurrency()
	const [company, setCompany] = useState(() => loadCompany())
	const [balance, setBalance] = useState<BalanceState>({ status: "loading" })
	const [spent, setSpent] = useState<number>()
	// What the chain enforces, when it can be read: it wins over the journal.
	const [chain, setChain] = useState<ControlState>()
	const fromChain = chain?.source === "chain" ? chain : undefined
	const limits = (fromChain?.config ?? loadControlsConfig()).limits
	const [working, setWorking] = useState<Step>()
	const [error, setError] = useState<string>()
	const [lastTx, setLastTx] = useState<string>()
	const [fundCount, setFundCount] = useState(0)
	const [copied, setCopied] = useState(false)

	const address = company?.address

	useEffect(() => {
		const refresh = () => setCompany(loadCompany())
		window.addEventListener("arqueo:company-updated", refresh)
		return () => window.removeEventListener("arqueo:company-updated", refresh)
	}, [])

	useEffect(() => {
		if (!address) return
		let cancelled = false
		setBalance({ status: "loading" })
		getBalance()
			.then((xlm) => {
				if (!cancelled) setBalance({ status: "ok", xlm })
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
				setSpent(
					spentInPeriod(payments, loadControlsConfig().limits.periodDays),
				),
			)
			.catch(() => setSpent(undefined))
		readControlState()
			.then(setChain)
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
			if (step === "fund") setFundCount((count) => count + 1)
		} catch (cause) {
			setError(errorMessage(cause))
		} finally {
			setCompany(loadCompany())
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

	const ordinaryReady = company?.rules?.ordinary !== undefined
	const suppliersReady =
		ordinaryReady && company?.controlPolicy?.ruleId === company?.rules?.ordinary
	const managerReady = company?.rules?.large !== undefined
	const needsFunds = balance.status === "ok" && balance.xlm === 0
	const ready =
		ordinaryReady && suppliersReady && balance.status === "ok" && !needsFunds
	const readyChanged = useChanged(ready)

	// One step at a time: funds, then the ordinary rule, its supplier list, and the optional manager rule.
	const next: Exclude<Step, "create"> | undefined = needsFunds
		? "fund"
		: !ordinaryReady
			? "ordinary"
			: !suppliersReady
				? "suppliers"
				: !managerReady
					? "manager"
					: undefined

	const nextChanged = useChanged(next)

	const runNext = () => {
		if (next === "fund") void run("fund", fundCompanyAccount)
		else if (next === "ordinary") void run("ordinary", setupOrdinaryRule)
		else if (next === "suppliers") void run("suppliers", installControlPolicy)
		else if (next === "manager") void run("manager", setupLargeRule)
	}

	const rules = [
		{
			key: "ordinary",
			name: "Ordinary rule",
			done: ordinaryReady,
			text: ordinaryReady
				? `Employee, up to ${formatXlm(limits.maxPerPayment, rate)} XLM per payment`
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
							holds the treasury and enforces the payment rules. Test XLM only,
							no real funds.
						</p>
					</div>
					<button
						type="button"
						className={`${ui.button} ${ui.primary} ${styles.big}`}
						onClick={() => void run("create", createCompanyAccount)}
						disabled={working !== undefined}
					>
						{working === "create" && <Spinner />}
						{working === "create"
							? "Creating account…"
							: "Create company account"}
					</button>
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
									<span className={styles.balance}>
										<Amount xlm={balance.xlm} />
										<span className={styles.unit}><AmountUnit /></span>
									</span>
								)}
							</dd>
						</div>

						{(fromChain ? true : spent !== undefined) && (
							<div className={styles.item}>
								<dt className={ui.label}>Spent, 30 days</dt>
								<dd>
									<span className={styles.spent}>
										{fromChain ? "" : "≈ "}
										<Amount
											xlm={fromChain ? fromChain.spentXlm : (spent ?? 0)}
										/>{" "}
										/ <Amount xlm={limits.cap30d} />
										<span className={styles.unit}><AmountUnit /></span>
									</span>
									<span className={styles.caption}>
										{fromChain
											? "Ordinary rule, read from the chain"
											: "Ordinary rule, from this browser\u2019s journal"}
									</span>
								</dd>
							</div>
						)}
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
