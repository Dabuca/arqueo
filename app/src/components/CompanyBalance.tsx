import { useEffect, useState } from "react"
import {
	createCompanyAccount,
	fundCompanyAccount,
	getBalance,
	loadCompany,
} from "../lib/stellar"

type State =
	| { status: "loading" }
	| { status: "ok"; xlm: number }
	| { status: "error"; message: string }

const errorMessage = (error: unknown) =>
	error instanceof Error ? error.message : String(error)

export function CompanyBalance() {
	const [state, setState] = useState<State>({ status: "loading" })
	const [address, setAddress] = useState(() => loadCompany()?.address)
	const [creating, setCreating] = useState(false)
	const [createError, setCreateError] = useState<string>()
	const [funding, setFunding] = useState(false)
	const [fundCount, setFundCount] = useState(0)

	useEffect(() => {
		let cancelled = false
		setState({ status: "loading" })
		getBalance()
			.then((xlm) => {
				if (!cancelled) setState({ status: "ok", xlm })
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setState({ status: "error", message: errorMessage(error) })
				}
			})
		return () => {
			cancelled = true
		}
	}, [address, fundCount])

	const create = async () => {
		setCreating(true)
		setCreateError(undefined)
		try {
			setAddress((await createCompanyAccount()).address)
		} catch (error) {
			setCreateError(errorMessage(error))
			// Funding can fail after the account was created and saved.
			setAddress(loadCompany()?.address)
		} finally {
			setCreating(false)
		}
	}

	const fund = async () => {
		setFunding(true)
		setCreateError(undefined)
		try {
			await fundCompanyAccount()
		} catch (error) {
			setCreateError(errorMessage(error))
		} finally {
			setFunding(false)
			setFundCount((n) => n + 1)
		}
	}

	return (
		<>
			{address ? (
				<p>
					Company account:{" "}
					<a
						href={`https://stellar.expert/explorer/testnet/contract/${address}`}
						target="_blank"
						rel="noreferrer"
					>
						<code>{address}</code>
					</a>
				</p>
			) : (
				<p>
					<button
						type="button"
						onClick={() => void create()}
						disabled={creating}
					>
						{creating
							? "Creating account…"
							: "Create company account (admin passkey)"}
					</button>
				</p>
			)}
			{createError && <p role="alert">Error: {createError}</p>}
			{state.status === "loading" && <p>Reading testnet balance…</p>}
			{state.status === "error" && (
				<p role="alert">Could not read the balance: {state.message}</p>
			)}
			{state.status === "ok" && (
				<p>
					Company balance (testnet):{" "}
					<strong>
						{state.xlm.toLocaleString("en-US", { maximumFractionDigits: 7 })}{" "}
						XLM
					</strong>
				</p>
			)}
			{address && state.status === "ok" && state.xlm === 0 && (
				<p>
					<button type="button" onClick={() => void fund()} disabled={funding}>
						{funding ? "Funding…" : "Fund with testnet XLM (Friendbot)"}
					</button>
				</p>
			)}
		</>
	)
}
