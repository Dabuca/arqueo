import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { createChangeLog } from "../controls/changeLog"
import {
	changedFields,
	describeValue,
	remainingSteps,
	startChange,
	validateSettings,
	type PendingChange,
} from "../controls/settings"
import {
	addDemoSupplier,
	addRealSupplier,
	createOutsiderAccount,
	removeSupplier,
} from "../controls/suppliers"
import {
	type ControlChange,
	type ControlField,
	type ControlsConfig,
	type Supplier,
} from "../controls/types"
import {
	applyControlChange,
	discardPendingChange,
	loadPendingChange,
	migrateRules,
	readControlState,
	resumePendingChange,
	supplierDeps,
	type ControlState,
} from "../lib/stellar"
import { Amount, AmountUnit } from "../components/Amount"
import { formatUsdc } from "../controls/format"
import ui from "../styles/ui.module.css"
import styles from "./Settings.module.css"

// Admin settings (R17, AGENTS.md §3.1): who can be paid, the maximum per
// payment and the cap per period. The account enforces them; each change
// replaces the affected rules and the admin passkey signs every step.

const FIELD_LABELS: Record<ControlField, string> = {
	maxPerPayment: "Max per payment",
	cap30d: "30-day cap",
	suppliers: "Suppliers",
}

const txUrl = (hash: string) =>
	`https://stellar.expert/explorer/testnet/tx/${hash}`

const shortAddress = (address: string) =>
	`${address.slice(0, 6)}…${address.slice(-6)}`

const shortHash = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-6)}`

// Amounts read better rounded. The stored values stay exact.
const shownChangeValue = (field: ControlField, value: string) =>
	field === "suppliers" || !value ? value : formatUsdc(Number(value))

const formatDate = (iso: string) =>
	new Date(iso).toLocaleString(undefined, { timeZoneName: "short" })

const message = (error: unknown) =>
	error instanceof Error ? error.message : String(error)

function Steps({ pending }: { pending: PendingChange }) {
	return (
		<ol className={styles.steps}>
			{pending.swaps.flatMap((swap) => [
				<li key={`${swap.asset}-${swap.rule}-add`} data-done={swap.newId !== undefined}>
					<span>
						Add the new <strong>{swap.asset} {swap.rule}</strong> rule
					</span>
					{swap.addHash && (
						<a href={txUrl(swap.addHash)} target="_blank" rel="noreferrer">
							{shortHash(swap.addHash)}
						</a>
					)}
				</li>,
				<li
					key={`${swap.asset}-${swap.rule}-remove`}
					data-done={swap.removeHash !== undefined}
				>
					<span>
						Retire the old <strong>{swap.asset} {swap.rule}</strong> rule
					</span>
					{swap.removeHash && (
						<a href={txUrl(swap.removeHash)} target="_blank" rel="noreferrer">
							{shortHash(swap.removeHash)}
						</a>
					)}
				</li>,
			])}
		</ol>
	)
}

export default function Settings() {
	const [state, setState] = useState<ControlState>()
	const [xlmState, setXlmState] = useState<ControlState>()
	const [loading, setLoading] = useState(true)
	const [pending, setPending] = useState<PendingChange | null>(() =>
		loadPendingChange(),
	)
	const [history, setHistory] = useState<ControlChange[]>(() =>
		createChangeLog().list(),
	)

	// The draft the admin is editing.
	const [maxText, setMaxText] = useState("")
	const [capText, setCapText] = useState("")
	const [suppliers, setSuppliers] = useState<Supplier[]>([])

	const [realAddress, setRealAddress] = useState("")
	const [realLabel, setRealLabel] = useState("")
	const [demoLabel, setDemoLabel] = useState("")
	const [outsider, setOutsider] = useState<string>()

	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [notice, setNotice] = useState<string>()
	const [running, setRunning] = useState<PendingChange | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		const [next, nextXlm] = await Promise.all([
			readControlState("USDC"),
			readControlState("XLM"),
		])
		setState(next)
		setXlmState(nextXlm)
		setMaxText(String(next.config.limits.maxPerPayment))
		setCapText(String(next.config.limits.cap30d))
		setSuppliers(next.config.suppliers)
		setPending(loadPendingChange())
		setHistory(createChangeLog().list())
		setLoading(false)
	}, [])

	useEffect(() => {
		void load()
	}, [load])

	const draft = useMemo<ControlsConfig | undefined>(() => {
		if (!state || maxText.trim() === "" || capText.trim() === "")
			return undefined
		const maxPerPayment = Number(maxText)
		const cap30d = Number(capText)
		if (!Number.isFinite(maxPerPayment) || !Number.isFinite(cap30d)) {
			return undefined
		}
		return {
			limits: { ...state.config.limits, maxPerPayment, cap30d },
			suppliers,
		}
	}, [state, maxText, capText, suppliers])

	const check = useMemo(
		() =>
			state && draft
				? validateSettings(draft, Math.max(state.spentXlm, xlmState?.spentXlm ?? 0))
				: ({ ok: false, reason: "Enter the two limits as numbers" } as const),
		[state, draft, xlmState],
	)

	const plan = useMemo(
		() =>
			state && draft && check.ok
				? startChange({
						prev: state.config,
						next: draft,
						existingRules: {
							USDC: state.rules,
							XLM: xlmState?.rules ?? {},
						},
						assets: ["USDC", "XLM"],
						spentAtChangeByAsset: {
							USDC: state.spentXlm,
							XLM: xlmState?.spentXlm ?? 0,
						},
						periodStartByAsset: {
							USDC: state.periodStart,
							XLM: xlmState?.periodStart,
						},
					})
				: null,
		[state, draft, check, xlmState],
	)
	const fields = state && draft ? changedFields(state.config, draft) : []

	const guard = async (work: () => Promise<void>) => {
		setBusy(true)
		setError(undefined)
		setNotice(undefined)
		try {
			await work()
		} catch (e) {
			setError(message(e))
		} finally {
			setBusy(false)
			setRunning(null)
			setPending(loadPendingChange())
		}
	}

	const addReal = () =>
		guard(async () => {
			if (!draft) throw new Error("Fix the limits before adding suppliers")
			const result = await addRealSupplier(
				draft,
				realAddress.trim(),
				realLabel.trim(),
				supplierDeps,
			)
			if (!result.ok) throw new Error(result.reason)
			setSuppliers(result.config.suppliers)
			setRealAddress("")
			setRealLabel("")
		})

	const addDemo = () =>
		guard(async () => {
			if (!draft) throw new Error("Fix the limits before adding suppliers")
			const result = await addDemoSupplier(
				draft,
				demoLabel.trim(),
				supplierDeps,
			)
			if (!result.ok) throw new Error(result.reason)
			setSuppliers(result.config.suppliers)
			setDemoLabel("")
		})

	const remove = (address: string) => {
		if (!draft) return
		const result = removeSupplier(draft, address)
		if (result.ok) setSuppliers(result.config.suppliers)
	}

	const makeOutsider = () =>
		guard(async () => {
			setOutsider(await createOutsiderAccount(supplierDeps))
		})

	const apply = () =>
		guard(async () => {
			if (!draft) return
			const done = await applyControlChange(draft, setRunning)
			setNotice(
				!done
					? "Nothing to change."
					: done.swaps.length === 0
						? "Saved. These settings are used when the rules are created."
						: `Settings applied: ${done.swaps.length * 2} transactions signed with the admin passkey.`,
			)
			await load()
		})

	const resume = () =>
		guard(async () => {
			await resumePendingChange(setRunning)
			setNotice("The pending change is finished.")
			await load()
		})

	const discard = () =>
		guard(async () => {
			discardPendingChange()
			setNotice("The pending change was discarded.")
			await load()
		})

	const migrate = () =>
		guard(async () => {
			if (!state) return
			await migrateRules(state.legacyRules, setRunning)
			setNotice("Rules migrated to the current control-policy.")
			await load()
		})

	if (loading && !state) {
		return (
			<div className={styles.loading} role="status" aria-label="Loading">
				<span className={ui.srOnly}>Reading the rules from the chain…</span>
				<div className={`${ui.card} ${styles.skelCard}`} aria-hidden="true">
					<div className={styles.skelHead}>
						<span className={`${styles.bone} ${styles.boneTitle}`} />
						<span className={`${styles.bone} ${styles.boneLine}`} />
					</div>
					<div className={styles.figures}>
						{[0, 1, 2, 3, 4].map((i) => (
							<div key={i}>
								<span className={`${styles.bone} ${styles.boneLabel}`} />
								<span className={`${styles.bone} ${styles.boneFigure}`} />
							</div>
						))}
					</div>
					<span className={`${styles.bone} ${styles.boneBar}`} />
				</div>
				<div className={`${ui.card} ${styles.skelCard}`} aria-hidden="true">
					<span className={`${styles.bone} ${styles.boneTitle}`} />
					<div className={styles.fields}>
						<span className={`${styles.bone} ${styles.boneField}`} />
						<span className={`${styles.bone} ${styles.boneField}`} />
					</div>
					<span className={`${styles.bone} ${styles.boneLine}`} />
				</div>
				<div className={`${ui.card} ${styles.skelCard}`} aria-hidden="true">
					<span className={`${styles.bone} ${styles.boneTitle}`} />
					{[0, 1, 2].map((i) => (
						<span key={i} className={`${styles.bone} ${styles.boneRow}`} />
					))}
				</div>
			</div>
		)
	}
	if (!state) return null

	const locked = busy || pending !== null || state.legacyRules.length > 0
	const { limits } = state.config
	const remaining = Math.max(limits.cap30d - state.spentXlm, 0)
	const usedPercent =
		limits.cap30d > 0
			? Math.min(Math.round((state.spentXlm / limits.cap30d) * 100), 100)
			: 0
	const shownProgress = running ?? pending
	const lockReason = busy
		? "A transaction is in progress."
		: pending
			? "Finish or discard the pending change first."
			: state.legacyRules.length > 0
				? "Migrate the old rules first."
				: undefined

	return (
		<div className={styles.page}>
			<div className={ui.pageHead}>
				<h1>Settings</h1>
				<p>
					Set who can be paid and how much. The account enforces these on chain:
					a payment that breaks them is rejected. Each change replaces the
					affected rules and is signed with the admin passkey. Testnet only.
				</p>
			</div>

			<div className={styles.notes}>
				{!state.hasAccount && (
					<p className={styles.note} role="status">
						There is no company account in this browser yet.{" "}
						<Link to="/app">Create it first</Link>. Changes made now are used
						when its rules are created.
					</p>
				)}
				{state.hasAccount && state.rules.ordinary === undefined && (
					<p className={styles.note} role="status">
						The ordinary rule is not set up yet. Changes made now are used when
						it is created, from the payment screen.
					</p>
				)}
				{state.chainError && (
					<p className={ui.alert} role="alert">
						Could not read the rules from the chain, so the saved settings are
						shown: {state.chainError}
					</p>
				)}
				{state.warnings.map((warning) => (
					<p key={warning} className={ui.alert} role="alert">
						{warning}
					</p>
				))}
				{state.legacyRules.length > 0 && (
					<div className={`${styles.note} ${styles.noteAction}`}>
						<span>
							The {state.legacyRules.join(" and ")} rule
							{state.legacyRules.length > 1 ? "s use" : " uses"} an older
							control-policy.
						</span>
						<button
							type="button"
							className={`${ui.button} ${ui.primary} ${ui.small}`}
							onClick={() => void migrate()}
							disabled={busy}
						>
							Migrate {state.legacyRules.join(" and ")} rule
							{state.legacyRules.length > 1 ? "s" : ""}
						</button>
					</div>
				)}
				{error && (
					<p className={ui.alert} role="alert">
						{error}
					</p>
				)}
				{notice && (
					<p className={styles.note} role="status">
						{notice}
					</p>
				)}
			</div>

			{pending && (
				<section
					className={`${ui.card} ${styles.section}`}
					aria-label="Pending change"
				>
					<h2 className={ui.sectionTitle}>A change is half done</h2>
					<p className={styles.hint}>
						It started {formatDate(pending.startedAt)}. Finish it so the old and
						new rules do not stay side by side.
					</p>
					<Steps pending={pending} />
					<div className={styles.actions}>
						<button
							type="button"
							className={`${ui.button} ${ui.primary}`}
							onClick={() => void resume()}
							disabled={busy}
						>
							Finish the change
						</button>
						<button
							type="button"
							className={ui.button}
							onClick={() => void discard()}
							disabled={busy || remainingSteps(pending).length === 0}
						>
							Discard
						</button>
					</div>
				</section>
			)}

			<section
				className={`${ui.card} ${styles.current}`}
				aria-label="Current limits"
			>
				<div className={styles.currentHead}>
					<h2 className={ui.sectionTitle}>In force now</h2>
					<p className={styles.source}>
						{state.source === "chain"
							? "Read from the chain."
							: "Saved settings, not read from the chain."}{" "}
						{state.periodEnds
							? `The period ends around ${formatDate(state.periodEnds)}.`
							: "The period starts with the next payment."}
					</p>
				</div>
				<dl className={styles.figures}>
					<div>
						<dt>Max per payment</dt>
						<dd>
							<Amount value={limits.maxPerPayment} asset="USDC" />
							<span className={styles.unit}>
								<AmountUnit asset="USDC" />
							</span>
						</dd>
					</div>
					<div>
						<dt>{limits.periodDays}-day cap</dt>
						<dd>
							<Amount value={limits.cap30d} asset="USDC" />
							<span className={styles.unit}>
								<AmountUnit asset="USDC" />
							</span>
						</dd>
					</div>
					<div>
						<dt>Spent this period</dt>
						<dd>
							<Amount value={state.spentXlm} asset="USDC" />
							<span className={styles.unit}>
								<AmountUnit asset="USDC" />
							</span>
						</dd>
					</div>
					<div>
						<dt>Left this period</dt>
						<dd>
							<Amount value={remaining} asset="USDC" />
							<span className={styles.unit}>
								<AmountUnit asset="USDC" />
							</span>
						</dd>
					</div>
					<div>
						<dt>Suppliers</dt>
						<dd>{state.config.suppliers.length}</dd>
					</div>
				</dl>
				<div className={styles.usage}>
					<div
						className={styles.bar}
						role="meter"
						aria-label="Share of the cap spent"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={usedPercent}
						aria-valuetext={`${usedPercent}% of the cap spent`}
					>
						<span
							className={styles.barFill}
							style={{ width: `${usedPercent}%` }}
						/>
					</div>
				</div>
			</section>

			<div className={styles.layout}>
				<div className={styles.edits}>
					<section
						className={`${ui.card} ${styles.section}`}
						aria-label="Limits"
					>
						<h2 className={ui.sectionTitle}>Limits</h2>
						<div className={styles.fields}>
							<label className={styles.field}>
								Max per payment (same numeric value in XLM and USDC)
								<input
									type="number"
									min="0"
									step="any"
									value={maxText}
									disabled={locked}
									onChange={(e) => setMaxText(e.target.value)}
								/>
							</label>
							<label className={styles.field}>
								{limits.periodDays}-day cap (same numeric value in XLM and USDC)
								<input
									type="number"
									min="0"
									step="any"
									value={capText}
									disabled={locked}
									onChange={(e) => setCapText(e.target.value)}
								/>
							</label>
						</div>
						<p className={styles.hint}>
							A payment above the maximum needs the manager&apos;s second
							signature. These values apply independently to each asset. Spend is
							tracked separately and carries over when a rule changes. Current USDC
							spend: <Amount value={state.spentXlm} asset="USDC" /> <AmountUnit asset="USDC" />; XLM spend: <Amount value={xlmState?.spentXlm ?? 0} asset="XLM" /> <AmountUnit asset="XLM" />.
						</p>
					</section>

					<section
						className={`${ui.card} ${styles.section}`}
						aria-label="Suppliers"
					>
						<h2 className={ui.sectionTitle}>Suppliers</h2>
						<p className={styles.hint}>
							Only these addresses can be paid. Keep at least one. A supplier
							must exist on testnet, or the payment would fail for another
							reason.
						</p>
						<div className={styles.tableWrap}>
							<table>
								<thead>
									<tr>
										<th>Name</th>
										<th>Address</th>
										<th>Type</th>
										<th>
											<span className={ui.srOnly}>Action</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{suppliers.map((supplier) => (
										<tr key={supplier.address}>
											<td data-label="Name">{supplier.label || "Unnamed"}</td>
											<td data-label="Address" title={supplier.address}>
												<code className={styles.address}>
													{shortAddress(supplier.address)}
												</code>
											</td>
											<td data-label="Type">{supplier.kind}</td>
											<td data-label="Action">
												<button
													type="button"
													className={`${ui.button} ${ui.small}`}
													disabled={locked || suppliers.length <= 1}
													title={
														suppliers.length <= 1
															? "Keep at least one supplier"
															: undefined
													}
													onClick={() => remove(supplier.address)}
												>
													Remove
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<div className={styles.subgroup}>
							<h3>Add a supplier</h3>
							<div className={styles.fields}>
								<label className={styles.field}>
									Address
									<input
										type="text"
										value={realAddress}
										placeholder="G…"
										disabled={locked}
										onChange={(e) => setRealAddress(e.target.value)}
									/>
								</label>
								<label className={styles.field}>
									Name
									<input
										type="text"
										value={realLabel}
										disabled={locked}
										onChange={(e) => setRealLabel(e.target.value)}
									/>
								</label>
								<button
									type="button"
									className={ui.button}
									onClick={() => void addReal()}
									disabled={locked || realAddress.trim() === ""}
								>
									Add supplier
								</button>
							</div>
						</div>

						<div className={styles.subgroup}>
							<h3>Demo accounts</h3>
							<div className={styles.fields}>
								<label className={styles.field}>
									Demo supplier name
									<input
										type="text"
										value={demoLabel}
										disabled={locked}
										onChange={(e) => setDemoLabel(e.target.value)}
									/>
								</label>
								<button
									type="button"
									className={ui.button}
									onClick={() => void addDemo()}
									disabled={locked}
								>
									Add a demo supplier
								</button>
								<button
									type="button"
									className={ui.button}
									onClick={() => void makeOutsider()}
									disabled={busy}
								>
									Create an account outside the list
								</button>
							</div>
							{outsider && (
								<p className={`${styles.hint} ${styles.outsider}`}>
									Account outside the list (for the rejected-supplier scene):{" "}
									<code className={styles.address}>{outsider}</code>
								</p>
							)}
						</div>
					</section>
				</div>

				<section
					className={`${ui.card} ${styles.review}`}
					aria-label="Review"
				>
					<h2 className={ui.sectionTitle}>Review and apply</h2>
					{!check.ok ? (
						<p className={ui.alert} role="alert">
							{check.reason}
						</p>
					) : fields.length === 0 ? (
						<p className={styles.hint}>No changes yet.</p>
					) : (
						<>
							<ul className={styles.changes}>
								{fields.map((field) => (
									<li key={field}>
										<strong>{FIELD_LABELS[field]}</strong>
										<span className={styles.diff}>
											{state && describeValue(field, state.config)}
											{" → "}
											{draft && describeValue(field, draft)}
										</span>
									</li>
								))}
							</ul>
							<p className={styles.hint}>
								{plan && plan.swaps.length > 0
									? `${plan.swaps.length * 2} transactions, each signed with the admin passkey: for every affected rule the new one is added first, then the old one is retired, so payments are never left uncontrolled. A tighter limit or a removed supplier applies once the old rule is retired, a few seconds after the new one is added.`
									: "No rule exists on chain yet: these settings are used when the rules are created."}
							</p>
						</>
					)}
					{shownProgress && shownProgress.swaps.length > 0 && busy && (
						<Steps pending={shownProgress} />
					)}
					{lockReason && !busy && (
						<p className={styles.hint}>{lockReason}</p>
					)}
					<div className={styles.actions}>
						<button
							type="button"
							className={`${ui.button} ${ui.primary}`}
							onClick={() => void apply()}
							disabled={locked || !check.ok || fields.length === 0}
						>
							{busy
								? "Waiting for the passkey and the network…"
								: "Apply changes"}
						</button>
						<button
							type="button"
							className={ui.button}
							onClick={() => void load()}
							disabled={busy}
						>
							Discard edits
						</button>
					</div>
				</section>
			</div>

			<section
				className={`${ui.card} ${styles.tableCard}`}
				aria-label="Change history"
			>
				<div className={styles.tableCardHead}>
					<h2 className={ui.sectionTitle}>Change history</h2>
				</div>
				{history.length === 0 ? (
					<p className={styles.empty}>No changes yet.</p>
				) : (
					<div className={styles.tableWrap}>
						<table>
							<thead>
								<tr>
									<th>Date</th>
										<th>Setting</th>
										<th>Asset</th>
										<th>Rule</th>
									<th>Previous</th>
									<th>New</th>
									<th>Spent then</th>
									<th>Transactions</th>
								</tr>
							</thead>
							<tbody>
								{history.map((change) => (
									<tr key={change.id}>
										<td data-label="Date">{formatDate(change.at)}</td>
										<td data-label="Setting">
											{FIELD_LABELS[change.field] ?? change.field}
										</td>
										<td data-label="Asset">{change.asset ?? "—"}</td>
										<td data-label="Rule">{change.rule ?? "—"}</td>
										<td data-label="Previous" className={styles.num}>
											{shownChangeValue(change.field, change.previous)}
										</td>
										<td data-label="New" className={styles.num}>
											{shownChangeValue(change.field, change.next)}
										</td>
										<td data-label="Spent then" className={styles.num}>
											{change.spentAtChange === undefined ? "—" : `${formatUsdc(change.spentAtChange)} ${change.asset ?? "USDC"}`}
										</td>
										<td data-label="Transactions">
											<span className={styles.txLinks}>
												{[change.addTxHash, change.removeTxHash].map(
													(hash, index) =>
														hash ? (
															<a
																key={hash}
																href={txUrl(hash)}
																target="_blank"
																rel="noreferrer"
															>
																{index === 0 ? "add" : "retire"}
															</a>
														) : null,
												)}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	)
}
