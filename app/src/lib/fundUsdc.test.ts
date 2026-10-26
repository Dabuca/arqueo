import { Keypair } from "@stellar/stellar-sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fundUsdc, type FundingDeps } from "../../../server/fundUsdc"
import { readJsonBody } from "../../../server/fundingHttp"

const SECRET = Keypair.random().secret()
const ENV = { USDC_ISSUER_SECRET: SECRET }
const ACCOUNT = "GBCOU6CXLLAHFGJOYVZU6GPPFDNQTOZRNCCNOSZYJIC4NLRIB23ZK7ZA"

let clock = 1_000_000
const deps = (transfer: FundingDeps["transfer"]): FundingDeps => ({
	transfer,
	now: () => clock,
})
const ok = () => deps(vi.fn().mockResolvedValue("HASH"))

// Each test uses its own recipient so the in-memory allowance never leaks across tests.
const recipient = () => Keypair.random().publicKey()

beforeEach(() => {
	clock += 2 * 60 * 60 * 1000
})

describe("fundUsdc", () => {
	it("funds a valid request and returns the hash", async () => {
		const transfer = vi.fn().mockResolvedValue("HASH")
		const to = recipient()
		const res = await fundUsdc({ to, amount: 9000 }, ENV, deps(transfer))
		expect(res).toEqual({ status: 200, body: { hash: "HASH" } })
		expect(transfer).toHaveBeenCalledWith(to, 9000, SECRET, expect.anything())
	})

	it("answers 400 to anything that is not a request, without touching the network", async () => {
		const transfer = vi.fn()
		for (const input of [undefined, null, "nope", {}, { to: "x", amount: 1 }]) {
			const res = await fundUsdc(input, ENV, deps(transfer))
			expect(res.status).toBe(400)
		}
		expect(transfer).not.toHaveBeenCalled()
	})

	it("answers 503 when the issuer secret is missing, blank or not a key", async () => {
		for (const USDC_ISSUER_SECRET of [undefined, "", "   ", "not-a-secret"]) {
			const res = await fundUsdc(
				{ to: recipient(), amount: 1 },
				{ USDC_ISSUER_SECRET },
				ok(),
			)
			expect(res.status).toBe(503)
			expect(JSON.stringify(res.body)).not.toContain("not-a-secret")
		}
	})

	it("accepts a secret pasted with a trailing newline", async () => {
		const res = await fundUsdc(
			{ to: recipient(), amount: 1 },
			{ USDC_ISSUER_SECRET: `${SECRET}\n` },
			ok(),
		)
		expect(res.status).toBe(200)
	})

	it("allows 3 requests per recipient per hour, then 429, then lets the hour pass", async () => {
		const to = recipient()
		const d = ok()
		for (let i = 0; i < 3; i++) {
			expect((await fundUsdc({ to, amount: 1 }, ENV, d)).status).toBe(200)
		}
		expect((await fundUsdc({ to, amount: 1 }, ENV, d)).status).toBe(429)
		clock += 61 * 60 * 1000
		expect((await fundUsdc({ to, amount: 1 }, ENV, d)).status).toBe(200)
	})

	it("does not count a failed transfer against the allowance", async () => {
		const to = recipient()
		const failing = deps(vi.fn().mockRejectedValue(new Error("boom")))
		for (let i = 0; i < 5; i++) {
			expect((await fundUsdc({ to, amount: 1 }, ENV, failing)).status).toBe(502)
		}
		expect((await fundUsdc({ to, amount: 1 }, ENV, ok())).status).toBe(200)
	})

	it("explains a missing trustline and never leaks the secret in errors", async () => {
		const trustline = deps(
			vi
				.fn()
				.mockRejectedValue(
					new Error(
						"HostError: Error(Contract, #13) trustline entry is missing",
					),
				),
		)
		const res = await fundUsdc({ to: recipient(), amount: 1 }, ENV, trustline)
		expect(res.status).toBe(502)
		expect(res.body.error).toMatch(/trustline/i)

		const leaky = deps(
			vi.fn().mockRejectedValue(new Error(`failed with ${"x".repeat(500)}`)),
		)
		const long = await fundUsdc({ to: recipient(), amount: 1 }, ENV, leaky)
		expect(String(long.body.error).length).toBeLessThan(260)
		expect(JSON.stringify(long.body)).not.toContain(SECRET)
	})

	it("runs transfers one at a time", async () => {
		let running = 0
		let peak = 0
		const slow = deps(
			vi.fn().mockImplementation(async () => {
				running += 1
				peak = Math.max(peak, running)
				await new Promise((r) => setTimeout(r, 15))
				running -= 1
				return "HASH"
			}),
		)
		await Promise.all(
			[1, 2, 3].map(() => fundUsdc({ to: recipient(), amount: 1 }, ENV, slow)),
		)
		expect(peak).toBe(1)
	})
})

describe("readJsonBody", () => {
	const request = (body: unknown, chunks: string[] = []) => ({
		body,
		async *[Symbol.asyncIterator]() {
			for (const chunk of chunks) yield chunk
		},
	})

	it("reads a body the platform already parsed, as text or as bytes", async () => {
		expect(await readJsonBody(request({ to: ACCOUNT }))).toEqual({
			to: ACCOUNT,
		})
		expect(await readJsonBody(request('{"a":1}'))).toEqual({ a: 1 })
		expect(
			await readJsonBody(request(new TextEncoder().encode('{"a":2}'))),
		).toEqual({ a: 2 })
	})

	it("reads the stream when nothing was parsed", async () => {
		expect(await readJsonBody(request(undefined, ['{"a":', "3}"]))).toEqual({
			a: 3,
		})
	})

	it("returns undefined, and never throws, for malformed or oversized JSON", async () => {
		expect(await readJsonBody(request("nope"))).toBeUndefined()
		expect(
			await readJsonBody(request(undefined, ["{bad json"])),
		).toBeUndefined()
		expect(
			await readJsonBody(request(undefined, ["x".repeat(5_000)])),
		).toBeUndefined()
	})
})
