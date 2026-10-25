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
import styles from "./Settings.module.css"

// Admin settings (R17, AGENTS.md §3.1): who can be paid, the maximum per
// payment and the cap per period. The account enforces them; each change
// replaces the affected rules and the admin passkey signs every step.

const FIELD_LABELS: Record<ControlField, string> = {
	maxPerPayment: "Max per payment (XLM)",
	cap30d: "30-day cap (XLM)",
	suppliers: "Suppliers",
}

const txUrl = (hash: string) =>
	`https://stellar.expert/explorer/testnet/tx/${hash}`

const shortAddress = (address: string) =>
	`${address.slice(0, 6)}…${address.slice(-6)}`

const shortHash = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-6)}`

const formatDate = (iso: string) =>
	new Date(iso).toLocaleString(undefined, { timeZoneName: "short" })

const message = (error: unknown) =>
	error instanceof Error ? error.message : String(error)

function Steps({ pending }: { pending: PendingChange }) {
	return (
		<ol className={styles.steps}>
			{pending.swaps.flatMap((swap) => [
				<li key={`${swap.rule}-add`} data-done={swap.newId !== undefined}>
					Add the new <strong>{swap.rule}</strong> rule
					{swap.addHash && (
						<>
							{" "}
							<a href={txUrl(swap.addHash)} target="_blank" rel="noreferrer">
								{shortHash(swap.addHash)}
							</a>
						</>
					)}
				</li>,
				<li
					key={`${swap.rule}-remove`}
					data-done={swap.removeHash !== undefined}
				>
					Retire the old <strong>{swap.rule}</strong> rule
					{swap.removeHash && (
						<>
							{" "}
							<a href={txUrl(swap.removeHash)} target="_blank" rel="noreferrer">
								{shortHash(swap.removeHash)}
							</a>
						</>
					)}
				</li>,
			])}
		</ol>
	)
}

export default function Settings() {
	const [state, setState] = useState<ControlState>()
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
		const next = await readControlState()
		setState(next)
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
				? validateSettings(draft, state.spentXlm)
				: ({ ok: false, reason: "Enter the two limits as numbers" } as const),
		[state, draft],
	)

	const plan = useMemo(
		() =>
			state && draft && check.ok
				? startChange({
						prev: state.config,
						next: draft,
						existingRules: state.rules,
						spentAtChange: state.spentXlm,
					})
				: null,
		[state, draft, check],
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
		return <p role="status">Reading the rules from the chain…</p>
	}
	if (!state) return null

	const locked = busy || pending !== null || state.legacyRules.length > 0
	const remaining = Math.max(state.config.limits.cap30d - state.spentXlm, 0)
	const shownProgress = running ?? pending

	return (
		<div className={styles.Settings}>
			<h1>Settings</h1>
			<p className={styles.lead}>
				Set who can be paid and how much. The account enforces these on chain: a
				payment that breaks them is rejected. Each change replaces the affected
				rules and is signed with the admin passkey. Testnet only.
			</p>

			{!state.hasAccount && (
				<p role="status">
					There is no company account in this browser yet.{" "}
					<Link to="/app">Create it first</Link>. Changes made now are used when
					its rules are created.
				</p>
			)}
			{state.hasAccount && state.rules.ordinary === undefined && (
				<p role="status">
					The ordinary rule is not set up yet. Changes made now are used when it
					is created, from the payment screen.
				</p>
			)}
			{state.chainError && (
				<p role="alert">
					Could not read the rules from the chain, so the saved settings are
					shown: {state.chainError}
				</p>
			)}
			{state.warnings.map((warning) => (
				<p key={warning} role="alert">
					{warning}
				</p>
			))}
			{state.legacyRules.length > 0 && (
				<p>
					<button type="button" onClick={() => void migrate()} disabled={busy}>
						Migrate {state.legacyRules.join(" and ")} rule
						{state.legacyRules.length > 1 ? "s" : ""}
					</button>
				</p>
			)}
			{error && <p role="alert">{error}</p>}
			{notice && <p role="status">{notice}</p>}

			{pending && (
				<section
					className={`card ${styles.section}`}
					aria-label="Pending change"
				>
					<h2>A change is half done</h2>
					<p>
						It started {formatDate(pending.startedAt)}. Finish it so the old and
						new rules do not stay side by side.
					</p>
					<Steps pending={pending} />
					<p className={styles.actions}>
						<button type="button" onClick={() => void resume()} disabled={busy}>
							Finish the change
						</button>
						<button
							type="button"
							onClick={() => void discard()}
							disabled={busy || remainingSteps(pending).length === 0}
						>
							Discard
						</button>
					</p>
				</section>
			)}

			<ul className={styles.summary} aria-label="Current limits">
				<li>
					<strong>{state.config.limits.maxPerPayment} XLM</strong>Max per
					payment
				</li>
				<li>
					<strong>{state.config.limits.cap30d} XLM</strong>
					{state.config.limits.periodDays}-day cap
				</li>
				<li>
					<strong>{state.spentXlm} XLM</strong>Spent this period
				</li>
				<li>
					<strong>{remaining} XLM</strong>Left this period
				</li>
				<li>
					<strong>{state.config.suppliers.length}</strong>Suppliers
				</li>
			</ul>
			<p className={styles.hint}>
				{state.source === "chain"
					? "Read from the chain."
					: "Saved settings, not read from the chain."}{" "}
				{state.periodEnds
					? `The period ends around ${formatDate(state.periodEnds)}.`
					: "The period starts with the next payment."}
			</p>

			<section className={`card ${styles.section}`} aria-label="Limits">
				<h2>Limits</h2>
				<div className={styles.fields}>
					<label>
						Max per payment (XLM)
						<input
							type="number"
							min="0"
							step="any"
							value={maxText}
							disabled={locked}
							onChange={(e) => setMaxText(e.target.value)}
						/>
					</label>
					<label>
						{state.config.limits.periodDays}-day cap (XLM)
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
					A payment above the maximum needs the manager&apos;s second signature.
					The cap cannot be set below what was already spent in the period (
					{state.spentXlm} XLM now), and what was spent carries over when it
					changes.
				</p>
			</section>

			<section className={`card ${styles.section}`} aria-label="Suppliers">
				<h2>Suppliers</h2>
				<p className={styles.hint}>
					Only these addresses can be paid. Keep at least one. A supplier must
					exist on testnet, or the payment would fail for another reason.
				</p>
				<div className={styles.tableWrap}>
					<table>
						<thead>
							<tr>
								<th>Name</th>
								<th>Address</th>
								<th>Type</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{suppliers.map((supplier) => (
								<tr key={supplier.address}>
									<td>{supplier.label || "Unnamed"}</td>
									<td title={supplier.address}>
										<code>{shortAddress(supplier.address)}</code>
									</td>
									<td>{supplier.kind}</td>
									<td>
										<button
											type="button"
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

				<div className={styles.fields}>
					<label>
						Address
						<input
							type="text"
							value={realAddress}
							placeholder="G…"
							disabled={locked}
							onChange={(e) => setRealAddress(e.target.value)}
						/>
					</label>
					<label>
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
						onClick={() => void addReal()}
						disabled={locked || realAddress.trim() === ""}
					>
						Add supplier
					</button>
				</div>
				<div className={styles.fields}>
					<label>
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
						onClick={() => void addDemo()}
						disabled={locked}
					>
						Add a demo supplier
					</button>
					<button
						type="button"
						onClick={() => void makeOutsider()}
						disabled={busy}
					>
						Create an account outside the list
					</button>
				</div>
				{outsider && (
					<p className={styles.hint}>
						Account outside the list (for the rejected-supplier scene):{" "}
						<code>{outsider}</code>
					</p>
				)}
			</section>

			<section className={`card ${styles.section}`} aria-label="Review">
				<h2>Review and apply</h2>
				{!check.ok ? (
					<p role="alert">{check.reason}</p>
				) : fields.length === 0 ? (
					<p className={styles.hint}>No changes yet.</p>
				) : (
					<>
						<ul>
							{fields.map((field) => (
								<li key={field}>
									<strong>{FIELD_LABELS[field]}</strong>:{" "}
									{state && describeValue(field, state.config)}
									{" → "}
									{draft && describeValue(field, draft)}
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
				<p className={styles.actions}>
					<button
						type="button"
						onClick={() => void apply()}
						disabled={locked || !check.ok || fields.length === 0}
					>
						{busy
							? "Waiting for the passkey and the network…"
							: "Apply changes"}
					</button>
					<button type="button" onClick={() => void load()} disabled={busy}>
						Discard edits
					</button>
				</p>
			</section>

			<section className={`card ${styles.section}`} aria-label="Change history">
				<h2>Change history</h2>
				{history.length === 0 ? (
					<p className={styles.empty}>No changes yet.</p>
				) : (
					<div className={styles.tableWrap}>
						<table>
							<thead>
								<tr>
									<th>Date</th>
									<th>Setting</th>
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
										<td>{formatDate(change.at)}</td>
										<td>{FIELD_LABELS[change.field] ?? change.field}</td>
										<td>{change.rule ?? "—"}</td>
										<td>{change.previous}</td>
										<td>{change.next}</td>
										<td>{change.spentAtChange ?? "—"}</td>
										<td>
											{[change.addTxHash, change.removeTxHash].map(
												(hash, index) =>
													hash ? (
														<span key={hash}>
															<a
																href={txUrl(hash)}
																target="_blank"
																rel="noreferrer"
															>
																{index === 0 ? "add" : "retire"}
															</a>{" "}
														</span>
													) : null,
											)}
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
