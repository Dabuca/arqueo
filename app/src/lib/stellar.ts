import {
	Account,
	Address,
	BASE_FEE,
	Contract,
	Keypair,
	TransactionBuilder,
	nativeToScVal,
	rpc,
	scValToNative,
} from "@stellar/stellar-sdk"
import { SmartAccountKit } from "smart-account-kit"

// The only door to Stellar: every call to the network goes through this file.
// Interfaces follow AGENTS.md §6.1. Mocks in mocks.ts export the same names.

export type Role = "admin" | "employee" | "manager" | "auditor"
export type RuleName = "ordinary" | "large"

export interface Payment {
	to: string
	amount: number
	concept: string
	signers: Role[]
	rule: RuleName
	status: "ok" | "rejected"
	hash?: string
	reason?: string
	at: string
}

export const STROOPS_PER_XLM = 10_000_000

const required = (name: string): string => {
	const value = import.meta.env[name]
	if (!value) {
		throw new Error(`Missing ${name}: copy app/.env.example to app/.env.local`)
	}
	return value
}

const COMPANY_KEY = "arqueo.company"
const DEPLOYER_KEY = "arqueo.deployer"
const FRIENDBOT_URL = "https://friendbot.stellar.org"

/**
 * The company treasury and its signers' keys. Demo shortcut (AGENTS.md §3):
 * everything lives in this browser's localStorage. In production each person
 * would sign with a passkey on their own device. Testnet only.
 */
export interface CompanyAccount {
	address: string
	adminCredentialId: string
	employee: { publicKey: string; secret: string }
	manager: { credentialId: string; publicKey: string } // public key in base64
}

export function loadCompany(): CompanyAccount | undefined {
	const raw = localStorage.getItem(COMPANY_KEY)
	return raw ? (JSON.parse(raw) as CompanyAccount) : undefined
}

// The kit's default deployer is shared and sign-only: without a relayer it
// cannot pay for a deployment. A per-browser testnet key pays instead.
function deployerSecret(): string {
	let secret = localStorage.getItem(DEPLOYER_KEY)
	if (!secret) {
		secret = Keypair.random().secret()
		localStorage.setItem(DEPLOYER_KEY, secret)
	}
	return secret
}

// Funds a G... account with Friendbot (if needed) and waits until the RPC sees
// it: Friendbot answers before the account reaches every RPC node.
async function fundWithFriendbot(publicKey: string): Promise<Account> {
	const server = new rpc.Server(required("PUBLIC_RPC_URL"))
	try {
		return await server.getAccount(publicKey) // already funded
	} catch {
		// Not on chain yet: ask Friendbot below.
	}
	const res = await fetch(
		`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`,
	)
	if (!res.ok) {
		throw new Error(`Friendbot could not fund ${publicKey} (${res.status})`)
	}
	for (let attempt = 0; attempt < 10; attempt++) {
		try {
			return await server.getAccount(publicKey)
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 1000))
		}
	}
	throw new Error(`Friendbot funded ${publicKey} but the RPC cannot see it`)
}

const toBase64 = (bytes: Uint8Array): string =>
	btoa(String.fromCharCode(...bytes))

// Read on first use, not at import: a missing .env.local should fail the call
// that needs it, not the whole app.
let kitInstance: SmartAccountKit | undefined

export function getKit(): SmartAccountKit {
	kitInstance ??= new SmartAccountKit({
		rpcUrl: required("PUBLIC_RPC_URL"),
		networkPassphrase: required("PUBLIC_NETWORK_PASSPHRASE"),
		accountWasmHash: required("PUBLIC_ACCOUNT_WASM_HASH"),
		webauthnVerifierAddress: required("PUBLIC_WEBAUTHN_VERIFIER_ADDRESS"),
		ed25519VerifierAddress: required("PUBLIC_ED25519_VERIFIER_ADDRESS"),
		deployerSecret: deployerSecret(),
	})
	return kitInstance
}

/**
 * Native XLM balance of the company account, in XLM: the one created in this
 * browser, or PUBLIC_COMPANY_ACCOUNT if there is none. It reads the Stellar
 * Asset Contract `balance` through simulation, so it needs no signature and
 * no funded source account.
 */
export async function getBalance(): Promise<number> {
	const account = loadCompany()?.address ?? required("PUBLIC_COMPANY_ACCOUNT")
	const token = new Contract(required("PUBLIC_NATIVE_TOKEN_CONTRACT"))
	const server = new rpc.Server(required("PUBLIC_RPC_URL"))
	// Simulation does not check the source account, so a throwaway one is enough.
	const source = new Account(Keypair.random().publicKey(), "0")
	const tx = new TransactionBuilder(source, {
		fee: BASE_FEE,
		networkPassphrase: required("PUBLIC_NETWORK_PASSPHRASE"),
	})
		.addOperation(token.call("balance", Address.fromString(account).toScVal()))
		.setTimeout(30)
		.build()

	const sim = await server.simulateTransaction(tx)
	if (rpc.Api.isSimulationError(sim)) {
		throw new Error(`Balance read failed: ${sim.error}`)
	}
	const stroops = scValToNative(sim.result!.retval) as bigint
	return Number(stroops) / STROOPS_PER_XLM
}

/**
 * Creates the company smart account once per browser: the admin passkey is
 * the only signer of its default rule (the `admin` rule in AGENTS.md §3), and
 * Friendbot funds it. It also creates the employee Ed25519 key and the manager
 * passkey. They are not added on chain yet: on the default rule they would
 * have to sign every admin operation. R4 and R7 add them to `ordinary` and
 * `large`.
 */
export async function createCompanyAccount(): Promise<{ address: string }> {
	const existing = loadCompany()
	if (existing) return { address: existing.address }

	const kit = getKit()
	const employee = Keypair.random()
	// Manager first: if this prompt is cancelled, nothing is deployed.
	const manager = await kit.credentials.create({
		nickname: "manager",
		appName: "Arqueo",
	})

	await fundWithFriendbot(Keypair.fromSecret(deployerSecret()).publicKey())
	const wallet = await kit.createWallet("Arqueo", "admin", {
		nickname: "admin",
		autoSubmit: true,
	})
	if (wallet.submitResult && !wallet.submitResult.success) {
		throw new Error(
			`Account deployment failed: ${wallet.submitResult.error.message}`,
		)
	}

	const company: CompanyAccount = {
		address: wallet.contractId,
		adminCredentialId: wallet.credentialId,
		employee: { publicKey: employee.publicKey(), secret: employee.secret() },
		manager: {
			credentialId: manager.credentialId,
			publicKey: toBase64(manager.publicKey),
		},
	}
	localStorage.setItem(COMPANY_KEY, JSON.stringify(company))

	// Saved before funding: the account exists even if funding fails.
	try {
		await fundCompanyAccount()
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		throw new Error(
			`Account ${company.address} created but not funded: ${message}`,
		)
	}
	return { address: company.address }
}

/**
 * Sends testnet XLM to the company account and returns the transaction hash.
 * Friendbot cannot fund contract addresses, so a throwaway account receives
 * Friendbot's 10,000 XLM and forwards most of it through the native token
 * contract. The kit's own fundWallet does the same, but it reads the account
 * entry with the pre-17 SDK API (`balance()`) and fails on
 * @stellar/stellar-sdk 17.
 */
export async function fundCompanyAccount(xlm = 9_000): Promise<string> {
	const company = loadCompany()
	if (!company) throw new Error("Create the company account first")

	const temp = Keypair.random()
	const source = await fundWithFriendbot(temp.publicKey())
	const server = new rpc.Server(required("PUBLIC_RPC_URL"))
	const token = new Contract(required("PUBLIC_NATIVE_TOKEN_CONTRACT"))
	const tx = new TransactionBuilder(source, {
		fee: BASE_FEE,
		networkPassphrase: required("PUBLIC_NETWORK_PASSPHRASE"),
	})
		.addOperation(
			token.call(
				"transfer",
				Address.fromString(temp.publicKey()).toScVal(),
				Address.fromString(company.address).toScVal(),
				nativeToScVal(BigInt(xlm) * BigInt(STROOPS_PER_XLM), { type: "i128" }),
			),
		)
		.setTimeout(30)
		.build()

	const prepared = await server.prepareTransaction(tx)
	prepared.sign(temp)
	const sent = await server.sendTransaction(prepared)
	if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
		throw new Error(`Funding transaction rejected (${sent.status})`)
	}
	const result = await server.pollTransaction(sent.hash)
	if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
		throw new Error(
			`Funding transaction ${sent.hash} ended as ${result.status}`,
		)
	}
	return sent.hash
}

// TODO(R4): pay through the smart account with multiSigners.
export function pay(p: {
	to: string
	amount: number
	concept: string
	signers: Role[]
}): Promise<{ ok: true; hash: string } | { ok: false; reason: string }> {
	throw new Error(`pay is not implemented yet (R4): ${p.concept}`)
}

// TODO(R4): read the local payment log; P1 rebuilds it from the chain.
export function listPayments(): Promise<Payment[]> {
	throw new Error("listPayments is not implemented yet (R4)")
}
