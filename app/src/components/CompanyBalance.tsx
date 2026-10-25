import { useEffect, useState } from "react"
import { getBalance } from "../lib/stellar"

type State =
	| { status: "loading" }
	| { status: "ok"; xlm: number }
	| { status: "error"; message: string }

export function CompanyBalance() {
	const [state, setState] = useState<State>({ status: "loading" })

	useEffect(() => {
		let cancelled = false
		getBalance()
			.then((xlm) => {
				if (!cancelled) setState({ status: "ok", xlm })
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setState({
						status: "error",
						message: error instanceof Error ? error.message : String(error),
					})
				}
			})
		return () => {
			cancelled = true
		}
	}, [])

	if (state.status === "loading") return <p>Reading testnet balance…</p>
	if (state.status === "error") {
		return <p role="alert">Could not read the balance: {state.message}</p>
	}
	return (
		<p>
			Company balance (testnet):{" "}
			<strong>
				{state.xlm.toLocaleString("en-US", { maximumFractionDigits: 7 })} XLM
			</strong>
		</p>
	)
}
