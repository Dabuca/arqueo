import { type ControlsConfig } from "./types"
import { isSupplier, looksLikeStellarAddress } from "./validation"

/**
 * Network operations the supplier list needs. Injected so this file stays free
 * of the network; they are implemented in src/lib/stellar.ts.
 */
export interface SupplierDeps {
	/** Full address check, including checksum. */
	isValidAddress(address: string): boolean
	/** Does the account exist on testnet? */
	accountExists(address: string): Promise<boolean>
	/** New random testnet account funded by Friendbot. Returns its G... address; the secret key is discarded. */
	createFundedAccount(): Promise<string>
}

export type SupplierResult =
	| { ok: true; config: ControlsConfig }
	| { ok: false; reason: string }

const rejected = (reason: string): SupplierResult => ({ ok: false, reason })

/** Adds an address typed by the admin. Checks run cheapest first. */
export async function addRealSupplier(
	config: ControlsConfig,
	address: string,
	label: string,
	deps: SupplierDeps,
): Promise<SupplierResult> {
	if (!looksLikeStellarAddress(address) || !deps.isValidAddress(address)) {
		return rejected("Invalid Stellar address")
	}
	if (isSupplier(address, config)) {
		return rejected("Supplier already in the list")
	}
	// A payment to an account that does not exist would fail for that reason
	// and not because of the account rules.
	if (!(await deps.accountExists(address))) {
		return rejected("Account not found on testnet: fund it with Friendbot first")
	}
	return {
		ok: true,
		config: {
			...config,
			suppliers: [...config.suppliers, { address, label, kind: "real" }],
		},
	}
}

/** Adds a freshly generated, funded testnet account as a demo supplier. */
export async function addDemoSupplier(
	config: ControlsConfig,
	label: string,
	deps: SupplierDeps,
): Promise<SupplierResult> {
	let address: string
	try {
		address = await deps.createFundedAccount()
	} catch (error) {
		return rejected(error instanceof Error ? error.message : String(error))
	}
	return {
		ok: true,
		config: {
			...config,
			suppliers: [...config.suppliers, { address, label, kind: "demo" }],
		},
	}
}

export function removeSupplier(
	config: ControlsConfig,
	address: string,
): SupplierResult {
	if (!isSupplier(address, config)) {
		return rejected("Supplier not in the list")
	}
	return {
		ok: true,
		config: {
			...config,
			suppliers: config.suppliers.filter(
				(supplier) => supplier.address !== address,
			),
		},
	}
}

/**
 * The unknown account for demo scene 3. It is deliberately not added to any
 * list. It still has to exist on testnet (funded): otherwise the payment would
 * fail because the account is missing, and the rejection would not come from
 * the supplier rule, which is what the scene shows.
 */
export async function createOutsiderAccount(
	deps: SupplierDeps,
): Promise<string> {
	return deps.createFundedAccount()
}
