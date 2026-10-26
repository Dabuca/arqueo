import { test, expect } from "@playwright/test"
import { Keypair } from "@stellar/stellar-sdk"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// R6 scene 3 on testnet: the ordinary rule carries control-policy, so a payment
// to an unknown account is rejected and one to an allowed supplier goes through.
// Needs app/.env.local with PUBLIC_CONTROL_POLICY_ADDRESS and PUBLIC_SUPPLIERS.
// Creates a new company account on testnet on every run.

const envLocal = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../app/.env.local",
)
const supplier = readFileSync(envLocal, "utf8")
	.match(/^PUBLIC_SUPPLIERS=(.+)$/m)?.[1]
	?.split(",")[0]
	?.trim()

test.setTimeout(10 * 60_000)

test("control-policy rejects unknown payees on the ordinary rule", async ({
	page,
	context,
}) => {
	test.skip(!supplier, "PUBLIC_SUPPLIERS is not set in app/.env.local")

	// A virtual authenticator signs the admin passkey prompts without a human.
	const cdp = await context.newCDPSession(page)
	await cdp.send("WebAuthn.enable")
	await cdp.send("WebAuthn.addVirtualAuthenticator", {
		options: {
			protocol: "ctap2",
			transport: "internal",
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true,
		},
	})

	const warnings: string[] = []
	page.on("console", (msg) => {
		if (msg.type() === "warning") warnings.push(msg.text())
	})

	await page.goto("/")
	await page
		.getByRole("button", { name: "Create company account (admin passkey)" })
		.click()
	await expect(page.getByText("Company account:")).toBeVisible({
		timeout: 180_000,
	})

	const fund = page.getByRole("button", {
		name: "Fund with testnet XLM (Friendbot)",
	})
	await expect(
		fund.or(page.getByText(/Company balance \(testnet\):/)),
	).toBeVisible({ timeout: 60_000 })
	if (await fund.isVisible()) await fund.click()
	await expect(page.getByText(/Company balance \(testnet\):/)).toBeVisible({
		timeout: 120_000,
	})

	await page
		.getByRole("button", { name: "Set up ordinary rule (admin passkey)" })
		.click()
	await expect(page.getByText("Ordinary rule:")).toBeVisible({
		timeout: 180_000,
	})
	expect(warnings.filter((w) => w.includes("control-policy skipped"))).toEqual(
		[],
	)

	// Scene 3: an account that is not a supplier.
	await page.getByPlaceholder("G…").fill(Keypair.random().publicKey())
	await page.getByLabel(/Amount/).fill("100")
	await page.getByRole("button", { name: "Pay as employee" }).click()
	await expect(page.getByRole("alert")).toContainText("Rejected", {
		timeout: 120_000,
	})
	await expect(page.getByRole("alert")).toContainText(/Error\(Contract, #1\)|#1/)

	// Scene 1: an allowed supplier.
	await page.getByPlaceholder("G…").fill(supplier!)
	await page.getByLabel(/Amount/).fill("200")
	await page.getByRole("button", { name: "Pay as employee" }).click()
	await expect(page.getByText("Payment sent:")).toBeVisible({
		timeout: 120_000,
	})
})
