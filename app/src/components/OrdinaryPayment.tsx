import { useState } from "react"
import { type PayResult } from "../lib/payments"
import {
	installControlPolicy,
	loadCompany,
	pay,
	setupOrdinaryRule,
} from "../lib/stellar"

// R4: set up the ordinary rule and make a payment signed only by the employee.
// The full payment screen (R8) replaces the payment form.

const errorMessage = (error: unknown) =>
	error instanceof Error ? error.message : String(error)

const txLink = (hash: string) =>
	`https://stellar.expert/explorer/testnet/tx/${hash}`

export function OrdinaryPayment() {
	const [ruleId, setRuleId] = useState(() => loadCompany()?.rules?.ordinary)
	const [setupHash, setSetupHash] = useState<string>()
	const [policyHash, setPolicyHash] = useState(
		() => loadCompany()?.controlPolicy?.hash,
	)
	const [to, setTo] = useState("")
	const [amount, setAmount] = useState("200")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [result, setResult] = useState<PayResult>()

	const run = async (action: () => Promise<void>) => {
		setBusy(true)
		setError(undefined)
		try {
			await action()
		} catch (err) {
			setError(errorMessage(err))
		} finally {
			setBusy(false)
		}
	}

	const setup = () =>
		run(async () => {
			const rule = await setupOrdinaryRule()
			setRuleId(rule.ruleId)
			setSetupHash(rule.hash)
		})

	const addPolicy = () =>
		run(async () => {
			setPolicyHash((await installControlPolicy()).hash)
		})

	const send = () =>
		run(async () => {
			setResult(undefined)
			setResult(
				await pay({
					to: to.trim(),
					amount: Number(amount),
					concept: "Ordinary payment",
					signers: ["employee"],
				}),
			)
		})

	return (
		<>
			{ruleId === undefined ? (
				<p>
					<button type="button" onClick={() => void setup()} disabled={busy}>
						{busy ? "Adding rule…" : "Set up ordinary rule (admin passkey)"}
					</button>
				</p>
			) : (
				<>
					<p>
						Ordinary rule: <code>#{ruleId}</code>
						{setupHash && (
							<>
								{" "}
								(
								<a href={txLink(setupHash)} target="_blank" rel="noreferrer">
									transaction
								</a>
								)
							</>
						)}
					</p>
					{policyHash ? (
						<p>
							Supplier allowlist (control-policy) is on:{" "}
							<a href={txLink(policyHash)} target="_blank" rel="noreferrer">
								transaction
							</a>
						</p>
					) : (
						<p>
							<button
								type="button"
								onClick={() => void addPolicy()}
								disabled={busy}
							>
								{busy
									? "Adding control-policy…"
									: "Add control-policy to ordinary rule (admin passkey)"}
							</button>
						</p>
					)}
					<p>
						<label>
							To{" "}
							<input
								value={to}
								onChange={(e) => setTo(e.target.value)}
								placeholder="G…"
							/>
						</label>{" "}
						<label>
							Amount (XLM){" "}
							<input
								type="number"
								min="0"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
							/>
						</label>{" "}
						<button
							type="button"
							onClick={() => void send()}
							disabled={busy || !to.trim()}
						>
							{busy ? "Paying…" : "Pay as employee"}
						</button>
					</p>
				</>
			)}
			{error && <p role="alert">Error: {error}</p>}
			{result?.ok && (
				<p>
					Payment sent:{" "}
					<a href={txLink(result.hash)} target="_blank" rel="noreferrer">
						<code>{result.hash}</code>
					</a>
				</p>
			)}
			{result && !result.ok && (
				<p role="alert">
					Rejected: {result.reason}
					{result.details && (
						<details>
							<summary>Details</summary>
							<code>{result.details}</code>
						</details>
					)}
				</p>
			)}
		</>
	)
}
