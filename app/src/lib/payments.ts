import { Address, Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk"
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
export const ORDINARY_MAX_PER_PAYMENT_XLM = 500n

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
 * Install params of `control-policy` (AGENTS.md §6.2) as the `ScVal` the kit
 * expects for a custom policy. `ControlParams` is a `#[contracttype]` struct,
 * so on chain it is a map with symbol keys in alphabetical order; the optional
 * maximum is `Void` for "no maximum".
 */
export function controlPolicyParams(
	allowlist: string[],
	maxPerPaymentXlm?: bigint,
): xdr.ScVal {
	const entry = (key: string, val: xdr.ScVal) =>
		new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val })
	return xdr.ScVal.scvMap([
		entry(
			"allowlist",
			xdr.ScVal.scvVec(
				allowlist.map((address) => Address.fromString(address).toScVal()),
			),
		),
		entry(
			"max_per_payment",
			maxPerPaymentXlm === undefined
				? xdr.ScVal.scvVoid()
				: nativeToScVal(maxPerPaymentXlm * STROOPS_PER_XLM, { type: "i128" }),
		),
	])
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
	| { ok: false; reason: string; details?: string }

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

// Messages from AGENTS.md §6.3. Codes 1-3 come from control-policy.
const CONTROL_POLICY_MESSAGES: Record<number, string> = {
	1: "Supplier not authorized",
	2: "Amount exceeds the per-payment limit: manager approval required",
	3: "Operation not allowed by the account rules",
}
const GENERIC_REJECTION = "Rejected by the account rules"
const CONTRACT_CODE = /Error\(Contract,\s*#(\d+)\)/

/**
 * The reason to show for a rejected payment. The kit does not decode codes
 * 1-3 (they are not in its registry), so the code is read from the error text.
 * Any other failure keeps its original text in `details`.
 */
export function rejectionReason(error: unknown): {
	reason: string
	details?: string
} {
	const text = errorText(error)
	const code = Number(CONTRACT_CODE.exec(text)?.[1])
	const message = CONTROL_POLICY_MESSAGES[code]
	if (message) return { reason: message }
	return { reason: GENERIC_REJECTION, details: text }
}

// The kit may put the diagnostic in the message, the context or the cause.
function errorText(error: unknown): string {
	if (error instanceof Error) {
		const cause = error.cause ? ` ${errorText(error.cause)}` : ""
		return `${error.name}: ${error.message}${cause}`.trim()
	}
	if (typeof error === "string") return error
	try {
		return JSON.stringify(error) ?? String(error)
	} catch {
		return String(error)
	}
}
