import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TESTNET_NOTICE, TestnetBanner } from "./TestnetBanner"

describe("TestnetBanner", () => {
	it("says the app is testnet only and that no real funds belong in it", () => {
		const html = renderToStaticMarkup(<TestnetBanner />)
		expect(html).toContain("Testnet only")
		expect(html).toContain(TESTNET_NOTICE)
	})
})
