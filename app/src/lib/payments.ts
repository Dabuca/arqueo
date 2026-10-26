import {
	Address,
	Keypair,
	StrKey,
	nativeToScVal,
	xdr,
} from "@stellar/stellar-sdk"
import {
	createEd25519Signer,
	createThresholdParams,
	createWebAuthnSigner,
	type ContractSigner,
	type SelectedSigner,
} from "smart-account-kit"
import { type ControlParamValues } from "../controls/params"
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

/** The rule that authorizes a payment, chosen by who signs (AGENTS.md §3). */
export function ruleFor(signers: Role[]): RuleName | undefined {
	const set = [...signers].sort().join(",")
	if (set === "employee") return "ordinary"
	if (set === "employee,manager") return "large"
	return undefined
}

/**
 * Install params of the ordinary rule's threshold policy: 1 signer. The
 * 30-day cap lives in `control-policy` (AGENTS.md §3.1), so that changing it
 * keeps what was already spent.
 */
export function ordinaryRuleParams() {
	return { threshold: createThresholdParams(1) }
}

/** Install params of the large rule's threshold policy: 2 of 2 signers (AGENTS.md §3). */
export function largeRuleParams() {
	return { threshold: createThresholdParams(2) }
}

/**
 * The manager's passkey as an on-chain signer. The public key is the base64
 * of the uncompressed secp256r1 key the kit returned at setup: 0x04, then X and Y.
 */
export function managerSigner(
	webauthnVerifierAddress: string,
	publicKeyBase64: string,
	credentialId: string,
): ContractSigner {
	const raw = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0))
	if (raw.length !== 65 || raw[0] !== 0x04) {
		throw new Error(
			"Manager public key must be an uncompressed key of 65 bytes",
		)
	}
	return createWebAuthnSigner(webauthnVerifierAddress, raw, credentialId)
}

/** The manager's passkey as a multi-signer selection: the kit asks the browser to sign with it. */
export function managerSelectedSigner(
	webauthnVerifierAddress: string,
	publicKeyBase64: string,
	credentialId: string,
): SelectedSigner {
	return {
		type: "passkey",
		credentialId,
		signer: managerSigner(
			webauthnVerifierAddress,
			publicKeyBase64,
			credentialId,
		),
		label: "manager",
	}
}

/**
 * Install params of `control-policy` (AGENTS.md §6.2) as the `ScVal` the kit
 * expects for a custom policy. `ControlParams` is a `#[contracttype]` struct,
 * so on chain it is a map with symbol keys in alphabetical order; the optional
 * maximum and cap are `Void` for "none". Amounts are in stroops.
 */
export function controlPolicyParams(values: ControlParamValues): xdr.ScVal {
	const entry = (key: string, val: xdr.ScVal) =>
		new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val })
	const optionalAmount = (stroops: bigint | null) =>
		stroops === null
			? xdr.ScVal.scvVoid()
			: nativeToScVal(stroops, { type: "i128" })
	return xdr.ScVal.scvMap([
		entry(
			"allowlist",
			xdr.ScVal.scvVec(
				values.allowlist.map((address) =>
					Address.fromString(address).toScVal(),
				),
			),
		),
		entry("cap_per_period", optionalAmount(values.capPerPeriod)),
		entry("max_per_payment", optionalAmount(values.maxPerPayment)),
		entry(
			"period_ledgers",
			nativeToScVal(values.periodLedgers, { type: "u32" }),
		),
	])
}

/** What `get_params` returns once decoded with `scValToNative`. */
export function decodeControlParams(
	native: unknown,
): ControlParamValues | null {
	if (native === null || native === undefined) return null
	const raw = native as {
		allowlist: string[]
		cap_per_period: bigint | null
		max_per_payment: bigint | null
		period_ledgers: number
	}
	return {
		allowlist: raw.allowlist,
		capPerPeriod: raw.cap_per_period,
		maxPerPayment: raw.max_per_payment,
		periodLedgers: raw.period_ledgers,
	}
}

/** What `spend_state` returns once decoded with `scValToNative`. */
export function decodeSpendState(native: unknown): {
	spentStroops: bigint
	periodStart: number
} {
	const raw = native as { spent: bigint; period_start: number }
	return { spentStroops: raw.spent, periodStart: raw.period_start }
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
		try {
			const parsed: unknown = JSON.parse(storage.getItem(PAYMENTS_KEY) ?? "[]")
			return Array.isArray(parsed) ? (parsed as Payment[]) : []
		} catch {
			// A corrupt log must not hide a payment that already settled.
			return []
		}
	}
	return {
		list,
		add(payment: Payment) {
			storage.setItem(PAYMENTS_KEY, JSON.stringify([...list(), payment]))
		},
	}
}

// Messages from AGENTS.md §6.3. Codes 1-5 come from control-policy.
const CONTROL_POLICY_MESSAGES: Record<number, string> = {
	1: "Supplier not authorized",
	2: "Amount exceeds the per-payment limit: manager approval required",
	3: "Operation not allowed by the account rules",
	4: "The 30-day cap cannot be set below the amount already spent",
	5: "Amount exceeds what is left of the 30-day cap: manager approval required",
}
const GENERIC_REJECTION = "Rejected by the account rules"
const CONTRACT_CODE = /Error\(Contract,\s*#(\d+)\)/

/**
 * The reason to show for a rejected payment. The kit does not decode codes
 * 1-5 (they are not in its registry), so the code is read from the error text.
 * Any other failure keeps its original text in `details`.
 */
export const NO_TRUSTLINE =
	"The supplier cannot receive USDC yet: its account needs a USDC trustline"

export function rejectionReason(error: unknown): {
	reason: string
	details?: string
} {
	const text = errorText(error)
	const code = Number(CONTRACT_CODE.exec(text)?.[1])
	const message = CONTROL_POLICY_MESSAGES[code]
	if (message) return { reason: message }
	// The rules passed but the token could not move: not a rule rejection.
	if (/trustline/i.test(text)) return { reason: NO_TRUSTLINE, details: text }
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

/**
 * Supplier addresses from PUBLIC_SUPPLIERS (comma separated). An invalid entry
 * throws: a typo must not silently leave a supplier off the allowlist.
 */
export function parseSuppliers(raw: string | undefined): string[] {
	return (raw ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean)
		.map((address) => {
			if (!StrKey.isValidEd25519PublicKey(address)) {
				throw new Error(`Invalid supplier address: ${address}`)
			}
			return address
		})
}
