import { Address, Keypair } from "@stellar/stellar-sdk"
import {
	LEDGERS_PER_DAY,
	createEd25519Signer,
	createSpendingLimitParams,
	createThresholdParams,
	type ContractSigner,
	type SelectedSigner,
} from "smart-account-kit"
import { type Payment, type Role, type RuleName } from "./stellar"

// Network-free payment logic used by stellar.ts. Values follow the control
// matrix in AGENTS.md §3. Bytes are plain Uint8Arrays: the app has no Node
// Buffer types.

const toHex = (bytes: Uint8Array): string =>
	Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")

const compareBytes = (a: Uint8Array, b: Uint8Array): number => {
	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		const diff = (a[i] ?? 0) - (b[i] ?? 0)
		if (diff !== 0) return diff
	}
	return a.length - b.length
}

const STROOPS_PER_XLM = 10_000_000n
const ORDINARY_SPENDING_LIMIT_XLM = 1_000n
const ORDINARY_PERIOD_DAYS = 30

/** The rule that authorizes a payment, chosen by who signs (AGENTS.md §3). */
export function ruleFor(signers: Role[]): RuleName | undefined {
	const set = [...signers].sort().join(",")
	if (set === "employee") return "ordinary"
	if (set === "employee,manager") return "large"
	return undefined
}

/** Install params of the ordinary rule's OpenZeppelin policies. */
export function ordinaryRuleParams() {
	return {
		threshold: createThresholdParams(1),
		spendingLimit: createSpendingLimitParams(
			ORDINARY_SPENDING_LIMIT_XLM * STROOPS_PER_XLM,
			ORDINARY_PERIOD_DAYS * LEDGERS_PER_DAY,
		),
	}
}

/**
 * Policies keyed by address, ordered as Soroban requires for map keys: the SDK
 * keeps a JS Map's insertion order, and an unsorted map fails on chain.
 */
export function sortedPolicies(
	policies: Map<string, unknown>,
): Map<string, unknown> {
	const bytes = (address: string) => Address.fromString(address).toBuffer()
	return new Map(
		[...policies.entries()].sort(([a], [b]) =>
			compareBytes(bytes(a), bytes(b)),
		),
	)
}

/** The employee's Ed25519 key as an on-chain signer of the smart account. */
export function employeeSigner(
	ed25519VerifierAddress: string,
	employeePublicKey: string,
): ContractSigner {
	const raw = Keypair.fromPublicKey(employeePublicKey).rawPublicKey()
	return createEd25519Signer(ed25519VerifierAddress, raw)
}

/** The employee's local Ed25519 key as a multi-signer selection. */
export function employeeSelectedSigner(
	ed25519VerifierAddress: string,
	employeePublicKey: string,
): SelectedSigner {
	const raw = Keypair.fromPublicKey(employeePublicKey).rawPublicKey()
	return {
		type: "ed25519",
		ed25519PublicKey: toHex(raw),
		signer: employeeSigner(ed25519VerifierAddress, employeePublicKey),
		label: "employee",
	}
}

export type PayInput = {
	to: string
	amount: number
	concept: string
	signers: Role[]
}

export type PayResult =
	| { ok: true; hash: string }
	| { ok: false; reason: string }

/** The audit record of a payment attempt, accepted or rejected. */
export function paymentRecord(
	input: PayInput,
	rule: RuleName,
	result: PayResult,
	at: Date = new Date(),
): Payment {
	const base = { ...input, rule, at: at.toISOString() }
	return result.ok
		? { ...base, status: "ok", hash: result.hash }
		: { ...base, status: "rejected", reason: result.reason }
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">

const PAYMENTS_KEY = "arqueo.payments"

/** Local payment log (MVP, AGENTS.md §6.1); P1 rebuilds it from the chain. */
export function paymentLog(storage: KeyValueStorage) {
	const list = (): Payment[] => {
		const raw = storage.getItem(PAYMENTS_KEY)
		return raw ? (JSON.parse(raw) as Payment[]) : []
	}
	return {
		list,
		add(payment: Payment) {
			storage.setItem(PAYMENTS_KEY, JSON.stringify([...list(), payment]))
		},
	}
}
