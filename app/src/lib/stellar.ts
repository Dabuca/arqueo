import {
	Account,
	Address,
	BASE_FEE,
	Contract,
	Keypair,
	TransactionBuilder,
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
	})
	return kitInstance
}

/**
 * Native XLM balance of PUBLIC_COMPANY_ACCOUNT, in XLM. It reads the Stellar
 * Asset Contract `balance` through simulation, so it needs no signature and
 * no funded source account.
 */
export async function getBalance(): Promise<number> {
	const account = required("PUBLIC_COMPANY_ACCOUNT")
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

// TODO(R3): create the company smart account with the admin passkey.
export function createCompanyAccount(): Promise<{ address: string }> {
	throw new Error("createCompanyAccount is not implemented yet (R3)")
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
