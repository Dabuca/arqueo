import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const appDir = resolve(root, "app")
const exampleEnvPath = resolve(appDir, ".env.example")
const envPath = resolve(appDir, ".env.local")
const fallbackEnvPath = resolve(appDir, ".env")
const host = process.env.ARQUEO_DEMO_HOST || "localhost"
const port = Number(process.env.ARQUEO_DEMO_PORT || 5191)
const appUrl = `http://${host}:${port}`
const testnetPassphrase = "Test SDF Network ; September 2015"
const requiredPublicSettings = [
	"PUBLIC_RPC_URL",
	"PUBLIC_NETWORK_PASSPHRASE",
	"PUBLIC_ACCOUNT_WASM_HASH",
	"PUBLIC_WEBAUTHN_VERIFIER_ADDRESS",
	"PUBLIC_ED25519_VERIFIER_ADDRESS",
	"PUBLIC_XLM_TOKEN_CONTRACT",
	"PUBLIC_USDC_TOKEN_CONTRACT",
	"PUBLIC_THRESHOLD_POLICY_ADDRESS",
	"PUBLIC_CONTROL_POLICY_ADDRESS",
	"PUBLIC_USDC_CONTROL_POLICY_ADDRESS",
]

function readEnvFile(path) {
	try {
		return Object.fromEntries(
			readFileSync(path, "utf8")
				.split(/\r?\n/)
				.map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
				.filter(Boolean)
				.map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, "")]),
		)
	} catch {
		return {}
	}
}

function validateTestnetConfig() {
	const fileEnv = {
		...readEnvFile(exampleEnvPath),
		...readEnvFile(fallbackEnvPath),
		...readEnvFile(envPath),
	}
	const value = (key) => process.env[key] || fileEnv[key]
	const missing = requiredPublicSettings.filter((key) => !value(key))
	if (missing.length) {
		if (
			!existsSync(exampleEnvPath) &&
			!existsSync(envPath) &&
			!existsSync(fallbackEnvPath)
		) {
			throw new Error(
				"Missing app/.env.local. Copy app/.env.example to app/.env.local, then set the deployed testnet control-policy address. The script generates supplier accounts.",
			)
		}
		throw new Error(`Missing public testnet settings: ${missing.join(", ")}`)
	}
	if (value("PUBLIC_NETWORK_PASSPHRASE") !== testnetPassphrase) {
		throw new Error("R14 demo setup only runs on Stellar testnet")
	}
	let rpcUrl
	try {
		rpcUrl = new URL(value("PUBLIC_RPC_URL"))
	} catch {
		throw new Error("R14 demo setup requires a valid Stellar testnet RPC URL")
	}
	if (rpcUrl.protocol !== "https:" || !rpcUrl.hostname.includes("testnet")) {
		throw new Error("R14 demo setup requires a Stellar testnet RPC URL")
	}
	return Object.fromEntries(
		requiredPublicSettings.map((key) => [key, value(key)]),
	)
}

const requireFromE2E = createRequire(resolve(root, "e2e", "package.json"))
const { chromium } = requireFromE2E("playwright")

function browserExecutable() {
	const candidates = [
		process.env.ARQUEO_DEMO_BROWSER_PATH,
		chromium.executablePath(),
		"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
		"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
	]
	return candidates.find((candidate) => candidate && existsSync(candidate))
}

async function isAppReady() {
	try {
		const response = await fetch(appUrl)
		return response.ok
	} catch {
		return false
	}
}

async function waitForApp(server) {
	await new Promise((resolve) => setTimeout(resolve, 300))
	for (let attempt = 0; attempt < 120; attempt++) {
		if (server.exitCode !== null) {
			throw new Error(
				`Vite stopped before becoming ready (exit ${server.exitCode})`,
			)
		}
		if (await isAppReady()) return
		await new Promise((resolve) => setTimeout(resolve, 500))
	}
	throw new Error(`Timed out waiting for the app at ${appUrl}`)
}

async function startAppIfNeeded(testnetConfig) {
	if (await isAppReady()) {
		throw new Error(
			`Port ${port} is already serving another app. Close it or set ARQUEO_DEMO_PORT to a free port.`,
		)
	}
	const vite = resolve(root, "node_modules", "vite", "bin", "vite.js")
	const server = spawn(
		process.execPath,
		[vite, "--host", host, "--port", String(port), "--strictPort"],
		{
			cwd: appDir,
			env: { ...process.env, ...testnetConfig, STELLAR_NETWORK: "testnet" },
			stdio: "inherit",
		},
	)
	await waitForApp(server)
	return server
}

async function main() {
	if (host !== "localhost") {
		throw new Error("Passkey setup requires the demo host to be localhost")
	}
	const testnetConfig = validateTestnetConfig()
	let server
	let context
	let page
	let profileDir
	try {
		server = await startAppIfNeeded(testnetConfig)
		profileDir = resolve(root, ".local", "demo-runs", randomUUID())
		mkdirSync(profileDir, { recursive: true })
		const executablePath = browserExecutable()
		context = await chromium.launchPersistentContext(profileDir, {
			headless: false,
			timeout: 10 * 60_000,
			...(executablePath ? { executablePath } : {}),
		})
		page = context.pages()[0] ?? (await context.newPage())
		page.setDefaultTimeout(10 * 60_000)
		context.on("close", () =>
			console.error("Browser context closed unexpectedly."),
		)
		context
			.browser()
			?.on("disconnected", () =>
				console.error("Browser process disconnected unexpectedly."),
			)
		page.on("close", () => console.error("Demo page closed unexpectedly."))
		page.on("crash", () => console.error("Demo page crashed."))
		page.on("pageerror", (error) =>
			console.error(`Browser page error: ${error.message}`),
		)
		await page.exposeFunction("reportDemoProgress", (step) =>
			console.log(`\n${step}…`),
		)
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

		await page.goto(appUrl)
		await page.waitForFunction(
			() => typeof window.arqueo?.setupDemoEnvironment === "function",
			undefined,
			{ timeout: 60_000 },
		)
		const setup = await page.evaluate(() =>
			window.arqueo.setupDemoEnvironment((step) =>
				window.reportDemoProgress(step),
			),
		)
		await page.goto(`${appUrl}/app`)
		await page.getByRole("heading", { name: "Prepare a payment" }).waitFor()
		await page.getByRole("heading", { name: "Company account" }).waitFor()
		console.log("Fresh Arqueo demo environment ready on Stellar testnet:")
		console.log(JSON.stringify(setup, null, 2))
		console.log("\nDemo scenes prepared:")
		console.log(`1. Authorized supplier: ${setup.supplierAddress}`)
		console.log(`2. Unauthorized outsider: ${setup.outsiderAddress}`)
		console.log(
			"   Use the outsider address for scene 3; the account rules should reject it.",
		)
		console.log(
			`\nThe payment screen is open at ${appUrl}/app. Keep this browser open for the demo.`,
		)
		console.log(`This run's local browser profile is ${profileDir}.`)
		console.log(
			"The profile contains demo signing credentials; keep it private.",
		)
		console.log("Close the browser window when the demo run is finished.")
		await new Promise((resolve) => context.once("close", resolve))
	} catch (error) {
		console.error(
			`Setup error: ${error instanceof Error ? error.message : String(error)}`,
		)
		if (context) {
			const companyAddress = await page
				?.evaluate(() => window.arqueo?.loadCompany()?.address)
				.catch(() => undefined)
			if (profileDir) {
				console.error(`Local browser profile retained at ${profileDir}`)
			}
			if (companyAddress) {
				console.error(`Partially created testnet account: ${companyAddress}`)
			}
			console.error(
				"This run may have created testnet accounts or installed some rules. Keep the profile to inspect/recover it; start a new run with a fresh profile after resolving the failure.",
			)
			console.error("The browser will close after this diagnostic.")
		}
		throw error
	} finally {
		if (context) await context.close().catch(() => {})
		if (server && server.exitCode === null) server.kill()
	}
}

main().catch((error) => {
	console.error(
		`R14 demo setup failed: ${error instanceof Error ? error.message : String(error)}`,
	)
	process.exitCode = 1
})
