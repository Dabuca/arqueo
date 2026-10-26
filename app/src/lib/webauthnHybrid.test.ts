import type {
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser"
import { describe, expect, it } from "vitest"
import {
	withPhoneAuthentication,
	withPhoneRegistration,
} from "./webauthnHybrid"

const creation = (): PublicKeyCredentialCreationOptionsJSON => ({
	challenge: "c",
	rp: { name: "Arqueo" },
	user: { id: "u", name: "manager", displayName: "manager" },
	pubKeyCredParams: [{ alg: -7, type: "public-key" }],
	authenticatorSelection: {
		residentKey: "preferred",
		userVerification: "preferred",
	},
})

const request = (ids: string[]): PublicKeyCredentialRequestOptionsJSON => ({
	challenge: "c",
	userVerification: "preferred",
	allowCredentials: ids.map((id) => ({ id, type: "public-key" })),
})

describe("withPhoneRegistration", () => {
	it("asks for a cross-device authenticator through the hybrid transport", () => {
		const out = withPhoneRegistration(creation())
		expect(out.authenticatorSelection?.authenticatorAttachment).toBe(
			"cross-platform",
		)
		expect(out.hints).toEqual(["hybrid"])
	})

	it("keeps the rest of the options and does not mutate the input", () => {
		const input = creation()
		const out = withPhoneRegistration(input)
		expect(out.authenticatorSelection?.residentKey).toBe("preferred")
		expect(out.rp).toEqual(input.rp)
		expect(input.hints).toBeUndefined()
		expect(
			input.authenticatorSelection?.authenticatorAttachment,
		).toBeUndefined()
	})
})

describe("withPhoneAuthentication", () => {
	it("points the phone credential at the hybrid transport", () => {
		const out = withPhoneAuthentication(request(["mgr"]), ["mgr"])
		expect(out.hints).toEqual(["hybrid"])
		expect(out.allowCredentials).toEqual([
			{ id: "mgr", type: "public-key", transports: ["hybrid"] },
		])
	})

	it("leaves a request for another credential untouched", () => {
		const input = request(["admin"])
		const out = withPhoneAuthentication(input, ["mgr"])
		expect(out).toBe(input)
	})

	it("leaves a request without allowCredentials untouched", () => {
		const input: PublicKeyCredentialRequestOptionsJSON = { challenge: "c" }
		expect(withPhoneAuthentication(input, ["mgr"])).toBe(input)
	})

	it("only marks the phone credential when several are allowed", () => {
		const input = request(["admin", "mgr"])
		const out = withPhoneAuthentication(input, ["mgr"])
		expect(out.allowCredentials?.[0]).toEqual({
			id: "admin",
			type: "public-key",
		})
		expect(out.allowCredentials?.[1]?.transports).toEqual(["hybrid"])
		expect(input.allowCredentials?.[1]?.transports).toBeUndefined()
	})
})
