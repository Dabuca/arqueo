import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
	children: ReactNode
}

interface State {
	failed: boolean
}

export function ErrorFallback() {
	return (
		<div
			role="alert"
			style={{ maxWidth: 480, margin: "20vh auto", padding: 24 }}
		>
			<h1>Something went wrong</h1>
			<p>
				The page hit an unexpected error. Your account and payments are not
				affected: they live on the Stellar testnet.
			</p>
			<button type="button" onClick={() => window.location.reload()}>
				Reload the page
			</button>
		</div>
	)
}

/** Keeps one broken screen from leaving the whole app blank. */
export class ErrorBoundary extends Component<Props, State> {
	state: State = { failed: false }

	static getDerivedStateFromError(): State {
		return { failed: true }
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("Render error:", error, info.componentStack)
	}

	render() {
		return this.state.failed ? <ErrorFallback /> : this.props.children
	}
}
