import { expect, test, type Page } from "@playwright/test"

// R20: what the app asks the browser for when the manager's passkey is created.
// navigator.credentials.create is replaced and rejects, so nothing reaches
// testnet: the account is only created after this call succeeds.

type Captured = {
	hints?: string[]
	authenticatorSelection?: { authenticatorAttachment?: string }
}

async function captureCreate(page: Page, tickPhone: boolean) {
	await page.addInitScript(() => {
		const w = window as unknown as { __create: unknown[] }
		w.__create = []
		navigator.credentials.create = (options) => {
			w.__create.push(
				JSON.parse(
					JSON.stringify(options?.publicKey ?? {}, (_, v) =>
						v instanceof ArrayBuffer || ArrayBuffer.isView(v) ? "<bytes>" : v,
					),
				),
			)
			return Promise.reject(new DOMException("test", "NotAllowedError"))
		}
	})
	await page.goto("/app")
	await page.evaluate(() => localStorage.removeItem("arqueo.company"))
	await page.reload()

	const box = page.getByLabel(/register the manager's passkey on a phone/i)
	await expect(box).toBeVisible()
	if (tickPhone) await box.check()
	await page.getByRole("button", { name: /create company account/i }).click()

	await expect
		.poll(() =>
			page.evaluate(
				() => (window as unknown as { __create: unknown[] }).__create.length,
			),
		)
		.toBeGreaterThan(0)
	const calls = await page.evaluate(
		() => (window as unknown as { __create: Captured[] }).__create,
	)
	return calls[0]
}

test("ticked: the manager passkey asks for the phone QR flow", async ({
	page,
}) => {
	const options = await captureCreate(page, true)
	expect(options.hints).toEqual(["hybrid"])
	expect(options.authenticatorSelection?.authenticatorAttachment).toBe(
		"cross-platform",
	)
})

test("not ticked: the manager passkey is created as before", async ({
	page,
}) => {
	const options = await captureCreate(page, false)
	expect(options.hints).toBeUndefined()
	expect(
		options.authenticatorSelection?.authenticatorAttachment,
	).toBeUndefined()
})
