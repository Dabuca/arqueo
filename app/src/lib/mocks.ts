import { type Payment, type Role } from "./stellar"

// Fake version of stellar.ts with the same exports, so the UI can be built
// before the real network layer is ready. Keep the signatures in sync.

export type { Payment, Role, RuleName } from "./stellar"

const COMPANY_ACCOUNT =
	"CMOCKCOMPANYACCOUNTFORDEVELOPMENTONLY0000000000000000000"

const payments: Payment[] = []

export async function createCompanyAccount(): Promise<{ address: string }> {
	return { address: COMPANY_ACCOUNT }
}

export async function getBalance(): Promise<number> {
	return 10_000
}

export async function setupOrdinaryRule(): Promise<{
	ruleId: number
	hash?: string
}> {
	return { ruleId: 1, hash: "mock-ordinary-rule" }
}

export async function setupLargeRule(): Promise<{
	ruleId: number
	hash?: string
}> {
	return { ruleId: 2, hash: "mock-large-rule" }
}

export async function installControlPolicy(): Promise<{ hash: string }> {
	return { hash: "mock-control-policy" }
}

export async function pay(p: {
	to: string
	amount: number
	concept: string
	signers: Role[]
}): Promise<{ ok: true; hash: string } | { ok: false; reason: string }> {
	const at = new Date().toISOString()
	const rule = p.signers.length > 1 ? "large" : "ordinary"
	if (p.amount >= 2000 && p.signers.length < 2) {
		const reason =
			"Amount exceeds the per-payment limit: manager approval required"
		payments.push({ ...p, rule, status: "rejected", reason, at })
		return { ok: false, reason }
	}
	const hash = `mock-${payments.length + 1}`
	payments.push({ ...p, rule, status: "ok", hash, at })
	return { ok: true, hash }
}

export async function listPayments(): Promise<Payment[]> {
	return [...payments]
}
