import type {
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser"

/**
 * Pure helpers that steer WebAuthn towards a phone (R20). The kit does not let
 * `credentials.create` set `authenticatorAttachment` and sends no transports
 * when it signs, so stellar.ts wraps the kit's `webAuthn` option with these.
 * The browser then offers its cross-device QR code (the `hybrid` transport)
 * and the manager confirms with a fingerprint or face on their own phone.
 */

/** Registration: create the passkey on another device, not on this one. */
export function withPhoneRegistration(
	options: PublicKeyCredentialCreationOptionsJSON,
): PublicKeyCredentialCreationOptionsJSON {
	return {
		...options,
		authenticatorSelection: {
			...options.authenticatorSelection,
			authenticatorAttachment: "cross-platform",
		},
		hints: ["hybrid"],
	}
}

/**
 * Signing: if the request asks for one of the phone's credentials, prefer the
 * QR flow. Any other request (the admin's passkey) is returned as it came.
 */
export function withPhoneAuthentication(
	options: PublicKeyCredentialRequestOptionsJSON,
	phoneCredentialIds: readonly string[],
): PublicKeyCredentialRequestOptionsJSON {
	const allowed = options.allowCredentials
	if (
		!allowed?.some((credential) => phoneCredentialIds.includes(credential.id))
	) {
		return options
	}
	return {
		...options,
		hints: ["hybrid"],
		allowCredentials: allowed.map((credential) =>
			phoneCredentialIds.includes(credential.id)
				? { ...credential, transports: ["hybrid"] }
				: credential,
		),
	}
}
