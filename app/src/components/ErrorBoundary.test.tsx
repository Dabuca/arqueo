import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ErrorBoundary, ErrorFallback } from "./ErrorBoundary"

describe("ErrorBoundary", () => {
	it("shows the fallback with a reload button once it has caught an error", () => {
		const html = renderToStaticMarkup(<ErrorFallback />)
		expect(html).toContain("Something went wrong")
		expect(html).toContain("Reload the page")
		expect(html).toContain('role="alert"')
	})

	it("turns a render error into the failed state", () => {
		expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true })
	})

	it("renders its children when nothing failed", () => {
		const html = renderToStaticMarkup(
			<ErrorBoundary>
				<p>fine</p>
			</ErrorBoundary>,
		)
		expect(html).toBe("<p>fine</p>")
	})
})
