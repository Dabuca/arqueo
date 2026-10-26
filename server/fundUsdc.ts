import {
	Address,
	BASE_FEE,
	Contract,
	Keypair,
	TransactionBuilder,
	nativeToScVal,
	rpc,
} from "@stellar/stellar-sdk"
import { checkFundingRequest } from "./fundingRequest"

// Testnet only. Non-secret defaults are the USDC token contract and the
// testnet RPC. USDC_TOKEN_CONTRACT is server-only: the app's
// PUBLIC_NATIVE_TOKEN_CONTRACT is read by the browser and is a different
// setting. The issuer secret is never a PUBLIC_ value.
const DEFAULTS = {
	PUBLIC_RPC_URL: "https://soroban-testnet.stellar.org",
	PUBLIC_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
	USDC_TOKEN_CONTRACT:
		"CBLCSCSGTQJQBM66F3PK3BOFSZXGA6YKRC2KGWDYCNHABHJH5ZJIQKQW",
}

/** Per recipient, best effort: each serverless instance keeps its own memory. */
const WINDOW_MS = 60 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 3
const MAX_TRACKED_RECIPIENTS = 500
const recent = new Map<string, number[]>()

const SEND_ATTEMPTS = 3
const POLL_ATTEMPTS = 20
const MAX_ERROR_LENGTH = 200

/** Server environment: any string variables, as `process.env` provides them. */
export type FundingEnv = Record<string, string | undefined>

export interface FundingResponse {
	status: number
	body: Record<string, unknown>
}

interface Network {
	rpcUrl: string
	passphrase: string
	tokenContract: string
}

/** What `fundUsdc` needs from the outside, so tests can run without a network. */
export interface FundingDeps {
	transfer: (
		to: string,
		amount: number,
		issuerSecret: string,
		network: Network,
	) => Promise<string>
	now: () => number
}

function withinRateLimit(to: string, now: number): boolean {
	for (const [recipient, times] of recent) {
		if (times.every((t) => now - t >= WINDOW_MS)) recent.delete(recipient)
	}
	while (recent.size >= MAX_TRACKED_RECIPIENTS) {
		const oldest = recent.keys().next().value
		if (oldest === undefined) break
		recent.delete(oldest)
	}
	const times = (recent.get(to) ?? []).filter((t) => now - t < WINDOW_MS)
	const allowed = times.length < MAX_REQUESTS_PER_WINDOW
	if (allowed) times.push(now)
	recent.set(to, times)
	return allowed
}

/** A transfer that failed does not count against the recipient's allowance. */
function refundRequest(to: string, at: number) {
	const times = recent.get(to)
	const index = times?.indexOf(at) ?? -1
	if (times && index >= 0) times.splice(index, 1)
}

/** One transfer at a time per instance: they all spend the issuer's sequence number. */
let queue: Promise<unknown> = Promise.resolve()
function serialized<T>(job: () => Promise<T>): Promise<T> {
	const run = queue.then(job, job)
	queue = run.catch(() => undefined)
	return run
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Sends `amount` USDC from the issuer to `to` through the token contract. */
async function transferFromIssuer(
	to: string,
	amount: number,
	issuerSecret: string,
	network: Network,
): Promise<string> {
	const issuer = Keypair.fromSecret(issuerSecret)
	const server = new rpc.Server(network.rpcUrl)
	const token = new Contract(network.tokenContract)
	const stroops = BigInt(Math.round(amount * 10_000_000))

	let lastStatus = "unknown"
	for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt++) {
		// A fresh sequence number each time: another request may have used ours.
		const source = await server.getAccount(issuer.publicKey())
		const tx = new TransactionBuilder(source, {
			fee: BASE_FEE,
			networkPassphrase: network.passphrase,
		})
			.addOperation(
				token.call(
					"transfer",
					Address.fromString(issuer.publicKey()).toScVal(),
					Address.fromString(to).toScVal(),
					nativeToScVal(stroops, { type: "i128" }),
				),
			)
			.setTimeout(30)
			.build()

		const prepared = await server.prepareTransaction(tx)
		prepared.sign(issuer)
		const sent = await server.sendTransaction(prepared)

		if (sent.status === "PENDING" || sent.status === "DUPLICATE") {
			const result = await server.pollTransaction(sent.hash, {
				attempts: POLL_ATTEMPTS,
			})
			if (result.status === rpc.Api.GetTransactionStatus.SUCCESS)
				return sent.hash
			if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
				throw new Error(`The network rejected the transfer (${sent.hash})`)
			}
			// Not resubmitted: it may still land, and sending it twice would pay twice.
			throw new Error(
				`The transfer ${sent.hash} is not confirmed yet. Check the balance before trying again.`,
			)
		}
		lastStatus = sent.status
		await sleep(250 * attempt + Math.random() * 250)
	}
	throw new Error(`The network did not accept the transfer (${lastStatus})`)
}

const defaultDeps: FundingDeps = {
	transfer: transferFromIssuer,
	now: () => Date.now(),
}

/** A short, safe message for the browser: never the raw SDK output. */
function friendlyError(error: unknown): string {
	const raw = error instanceof Error ? error.message : String(error)
	if (/#13\b|trustline/i.test(raw)) {
		return "The recipient account needs a USDC trustline before it can receive USDC"
	}
	return `Funding failed: ${raw.replace(/\s+/g, " ").slice(0, MAX_ERROR_LENGTH)}`
}

/** The whole funding endpoint, without HTTP details: used by api/ and the dev server. */
export async function fundUsdc(
	input: unknown,
	env: FundingEnv,
	deps: FundingDeps = defaultDeps,
): Promise<FundingResponse> {
	const check = checkFundingRequest(input)
	if (!check.ok) return { status: 400, body: { error: check.reason } }

	// Pasted secrets often carry a trailing newline or spaces.
	const issuerSecret = env.USDC_ISSUER_SECRET?.trim()
	if (!issuerSecret) {
		return {
			status: 503,
			body: { error: "USDC funding is not configured on this server" },
		}
	}
	try {
		Keypair.fromSecret(issuerSecret)
	} catch {
		return {
			status: 503,
			body: { error: "USDC funding is misconfigured on this server" },
		}
	}

	const requestedAt = deps.now()
	if (!withinRateLimit(check.request.to, requestedAt)) {
		return {
			status: 429,
			body: {
				error:
					"This account already received test USDC recently. Try again later.",
			},
		}
	}

	const network: Network = {
		rpcUrl: env.PUBLIC_RPC_URL || DEFAULTS.PUBLIC_RPC_URL,
		passphrase:
			env.PUBLIC_NETWORK_PASSPHRASE || DEFAULTS.PUBLIC_NETWORK_PASSPHRASE,
		tokenContract: env.USDC_TOKEN_CONTRACT || DEFAULTS.USDC_TOKEN_CONTRACT,
	}
	try {
		const hash = await serialized(() =>
			deps.transfer(
				check.request.to,
				check.request.amount,
				issuerSecret,
				network,
			),
		)
		return { status: 200, body: { hash } }
	} catch (error) {
		refundRequest(check.request.to, requestedAt)
		return { status: 502, body: { error: friendlyError(error) } }
	}
}
