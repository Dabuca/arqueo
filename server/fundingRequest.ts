import { StrKey } from "@stellar/stellar-sdk"

/** Largest amount one request may fund, in USDC. Keeps a public faucet from draining the issuer. */
export const MAX_FUNDING_PER_REQUEST = 10_000

export interface FundingRequest {
	to: string
	amount: number
}

export type FundingCheck =
	| { ok: true; request: FundingRequest }
	| { ok: false; reason: string }

/** Validates the body of a funding request. Shared by the Vercel function and the dev server. */
export function checkFundingRequest(input: unknown): FundingCheck {
	if (typeof input !== "object" || input === null) {
		return { ok: false, reason: "Send a JSON object with to and amount" }
	}
	const { to, amount } = input as Record<string, unknown>
	if (
		typeof to !== "string" ||
		!(StrKey.isValidContract(to) || StrKey.isValidEd25519PublicKey(to))
	) {
		return {
			ok: false,
			reason: "to must be a Stellar account (G...) or contract (C...) address",
		}
	}
	if (
		typeof amount !== "number" ||
		!Number.isFinite(amount) ||
		amount <= 0 ||
		amount > MAX_FUNDING_PER_REQUEST
	) {
		return {
			ok: false,
			reason: `amount must be above 0 and at most ${MAX_FUNDING_PER_REQUEST} USDC`,
		}
	}
	return { ok: true, request: { to, amount } }
}
