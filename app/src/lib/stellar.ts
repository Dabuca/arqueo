import { startAuthentication, startRegistration } from "@simplewebauthn/browser"
import {
	Account,
	Address,
	Asset,
	BASE_FEE,
	Contract,
	Horizon,
	Keypair,
	Operation,
	StrKey,
	TransactionBuilder,
	nativeToScVal,
	rpc,
	scValToNative,
	type xdr,
} from "@stellar/stellar-sdk"
import {
	SmartAccountKit,
	createCallContractContext,
	createDefaultContext,
	createThresholdParams,
	type ContractSigner,
} from "smart-account-kit"
import { createChangeLog } from "../controls/changeLog"
import { DEFAULT_LIMITS } from "../controls/defaults"
import { toControlParams } from "../controls/params"
import {
	SECONDS_PER_LEDGER,
	canDiscard,
	changeRecords,
	configFromParams,
	ledgerToDate,
	nextStep,
	startChange,
	startMigration,
	validateSettings,
	withAdded,
	withRemoved,
	type PendingChange,
} from "../controls/settings"
import { type SupplierDeps } from "../controls/suppliers"
import { type ControlsConfig } from "../controls/types"
import { stroopsToXlm, xlmToStroops } from "../controls/units"
import { controlsStore } from "./controlsStore"
import {
	employeeSelectedSigner,
	employeeSigner,
	largeRuleParams,
	managerSelectedSigner,
	managerSigner,
	NO_TRUSTLINE,
	controlPolicyParams,
	decodeControlParams,
	decodeSpendState,
	ordinaryRuleParams,
	parseSuppliers,
	paymentLog,
	paymentRecord,
	rejectionReason,
	ruleFor,
	sortedPolicies,
	type PayInput,
	type PayResult,
} from "./payments"
import {
	withPhoneAuthentication,
	withPhoneRegistration,
} from "./webauthnHybrid"

// The only door to Stellar: every call to the network goes through this file.
// Interfaces follow AGENTS.md §6.1. Mocks in mocks.ts export the same names.

export type Role = "admin" | "employee" | "manager" | "auditor"
export type RuleName = "ordinary" | "large"
export type PaymentAsset = "XLM" | "USDC"

export interface Payment {
	asset: PaymentAsset
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

const COMPANY_KEY = "arqueo.company"
const DEPLOYER_KEY = "arqueo.deployer"
const RECOVERY_PACKAGE_KEY = "arqueo.recovery-package"
const FRIENDBOT_URL = "https://friendbot.stellar.org"

/**
 * The company treasury and its signers' keys. Demo shortcut (AGENTS.md §3):
 * everything lives in this browser's localStorage. In production each person
 * would sign with a passkey on their own device. Testnet only.
 */
export interface CompanyAccount {
	address: string
	adminCredentialId: string
	adminRuleId?: number
	employee: { publicKey: string; secret: string }
	manager: {
		credentialId: string
		publicKey: string // base64
		// Where the passkey lives (R20). Missing = this browser's device.
		device?: "phone" | "this-device"
	}
	recovery?: {
		ruleId: number
		guardians: Array<{ credentialId: string; publicKey: string }>
	}
	pendingAdminRecovery?: {
		ruleId: number
		credentialId: string
		publicKey: string
	}
	recoveredFromPackage?: boolean
	rules?: Partial<Record<RuleName, number>> // on-chain context rule ids
	assetRules?: Partial<Record<PaymentAsset, Partial<Record<RuleName, number>>>>
	controlPolicy?: { ruleId: number; hash: string } // installed on that rule
}

const FUNDING_KEY = "arqueo.usdc-funder"
const CIRCLE_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

export function getUsdcFundingAddress(): string | undefined {
	try {
		const raw = localStorage.getItem(FUNDING_KEY)
		if (!raw) return undefined
		const value = JSON.parse(raw) as { address?: unknown }
		return typeof value.address === "string" &&
			StrKey.isValidEd25519PublicKey(value.address)
			? value.address
			: undefined
	} catch {
		return undefined
	}
}

export function tokenContract(asset: PaymentAsset): string {
	if (asset === "XLM") return required("PUBLIC_XLM_TOKEN_CONTRACT")
	return required("PUBLIC_USDC_TOKEN_CONTRACT")
}

function controlPolicyAddress(asset: PaymentAsset): string {
	return asset === "XLM"
		? required("PUBLIC_CONTROL_POLICY_ADDRESS")
		: required("PUBLIC_USDC_CONTROL_POLICY_ADDRESS")
}

function assetRuleIds(
	company: CompanyAccount,
	asset: PaymentAsset,
): Partial<Record<RuleName, number>> {
	return company.assetRules?.[asset] ?? (asset === "USDC" ? company.rules ?? {} : {})
}

function withAssetRule(
	company: CompanyAccount,
	asset: PaymentAsset,
	rule: RuleName,
	ruleId: number,
): CompanyAccount {
	const assetRules = {
		...company.assetRules,
		[asset]: { ...assetRuleIds(company, asset), [rule]: ruleId },
	}
	return {
		...company,
		assetRules,
		...(asset === "USDC" ? { rules: assetRules.USDC } : {}),
	}
}

export interface RecoveryPackage {
	version: 1
	network: "testnet"
	companyAddress: string
	adminRuleId: number
	recovery: NonNullable<CompanyAccount["recovery"]>
	rules: Partial<Record<RuleName, number>>
	assetRules?: CompanyAccount["assetRules"]
}

export function loadRecoveryPackage(): RecoveryPackage | undefined {
	const raw = localStorage.getItem(RECOVERY_PACKAGE_KEY)
	if (!raw) return undefined
	try {
		return JSON.parse(raw) as RecoveryPackage
	} catch {
		localStorage.removeItem(RECOVERY_PACKAGE_KEY)
		return undefined
	}
}

/** Export the public information guardians need to recover from another device. */
export function createRecoveryPackage(): RecoveryPackage {
	const company = requireCompany()
	if (!company.recovery) throw new Error("Set up the recovery rule first")
	return {
		version: 1,
		network: "testnet",
		companyAddress: company.address,
		adminRuleId: company.adminRuleId ?? ADMIN_RULE_ID,
		recovery: company.recovery,
		rules: company.rules ?? {},
		assetRules: company.assetRules,
	}
}

/** Import a public recovery package on a new browser profile. */
export function importRecoveryPackage(json: string): RecoveryPackage {
	let value: unknown
	try {
		value = JSON.parse(json)
	} catch {
		throw new Error("Recovery package is not valid JSON")
	}
	if (!value || typeof value !== "object") {
		throw new Error("Recovery package has an invalid format")
	}
	const data = value as Partial<RecoveryPackage>
	const publicKeysAreValid = (guardians: unknown): boolean => {
		if (!Array.isArray(guardians) || guardians.length !== 3) return false
		try {
			const isGuardian = (
				guardian: unknown,
			): guardian is { credentialId: string; publicKey: string } => {
				if (!guardian || typeof guardian !== "object") return false
				const candidate = guardian as Record<string, unknown>
				if (
					typeof candidate.credentialId !== "string" ||
					!/^[A-Za-z0-9_-]+$/.test(candidate.credentialId) ||
					typeof candidate.publicKey !== "string"
				)
					return false
				const key = Uint8Array.from(atob(candidate.publicKey), (char) =>
					char.charCodeAt(0),
				)
				return key.length === 65 && key[0] === 0x04
			}
			return (
				guardians.every(isGuardian) &&
				new Set(guardians.map((guardian) => guardian.credentialId)).size === 3
			)
		} catch {
			return false
		}
	}
	if (
		data.version !== 1 ||
		data.network !== "testnet" ||
		!data.companyAddress ||
		!StrKey.isValidContract(data.companyAddress) ||
		!Number.isInteger(data.adminRuleId) ||
		!data.recovery ||
		!Number.isInteger(data.recovery.ruleId) ||
		!publicKeysAreValid(data.recovery.guardians)
	) {
		throw new Error(
			"Recovery package is incomplete or is not for Stellar testnet",
		)
	}
	localStorage.setItem(RECOVERY_PACKAGE_KEY, JSON.stringify(data))
	window.dispatchEvent(new Event("arqueo:company-updated"))
	return data as RecoveryPackage
}

export function loadCompany(): CompanyAccount | undefined {
	try {
		const raw = localStorage.getItem(COMPANY_KEY)
		return raw ? (JSON.parse(raw) as CompanyAccount) : undefined
	} catch {
		// Blocked storage or a corrupt record: treat it as no account yet, so
		// the page still renders and offers to create one.
		return undefined
	}
}

export function loadDemoOutsider(): string | undefined {
	return localStorage.getItem("arqueo.demo.outsider") ?? undefined
}

function saveCompany(company: CompanyAccount): void {
	localStorage.setItem(COMPANY_KEY, JSON.stringify(company))
}

// createWallet installs the admin passkey on the account's first rule.
const ADMIN_RULE_ID = 0

// The kit's default deployer is shared and sign-only: without a relayer it
// cannot pay for a deployment. A per-browser testnet key pays instead.
function deployerSecret(): string {
	let secret = localStorage.getItem(DEPLOYER_KEY)
	if (!secret) {
		secret = Keypair.random().secret()
		localStorage.setItem(DEPLOYER_KEY, secret)
	}
	return secret
}

// Funds a G... account with Friendbot (if needed) and waits until the RPC sees
// it: Friendbot answers before the account reaches every RPC node.
async function fundWithFriendbot(publicKey: string): Promise<Account> {
	const server = new rpc.Server(required("PUBLIC_RPC_URL"))
	try {
		return await server.getAccount(publicKey) // already funded
	} catch {
		// Not on chain yet: ask Friendbot below.
	}
	const res = await fetch(
		`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`,
	)
	if (!res.ok) {
		throw new Error(`Friendbot could not fund ${publicKey} (${res.status})`)
	}
	for (let attempt = 0; attempt < 10; attempt++) {
		try {
			return await server.getAccount(publicKey)
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 1000))
		}
	}
	throw new Error(`Friendbot funded ${publicKey} but the RPC cannot see it`)
}

const toBase64 = (bytes: Uint8Array): string =>
	btoa(String.fromCharCode(...bytes))

// True only while the manager passkey is created on a phone (R20): the admin
// passkey, made by the same kit, stays on this device.
let registeringOnPhone = false

// The kit's WebAuthn, steered to the phone's QR flow (hybrid transport) for the
// manager's passkey only. See webauthnHybrid.ts.
const kitWebAuthn = {
	startRegistration: (
		options: Parameters<typeof startRegistration>[0],
	): ReturnType<typeof startRegistration> =>
		startRegistration(
			registeringOnPhone
				? {
						...options,
						optionsJSON: withPhoneRegistration(options.optionsJSON),
					}
				: options,
		),
	startAuthentication: (
		options: Parameters<typeof startAuthentication>[0],
	): ReturnType<typeof startAuthentication> => {
		const manager = loadCompany()?.manager
		const phone = manager?.device === "phone" ? [manager.credentialId] : []
		return startAuthentication({
			...options,
			optionsJSON: withPhoneAuthentication(options.optionsJSON, phone),
		})
	},
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
		deployerSecret: deployerSecret(),
		webAuthn: kitWebAuthn,
	})
	return kitInstance
}

/**
 * Test USDC balance of the company account, in USDC: the one created in this
 * browser, or PUBLIC_COMPANY_ACCOUNT if there is none. It reads the Stellar
 * Asset Contract `balance` through simulation, so it needs no signature and
 * no funded source account.
 */
export async function getBalance(asset: PaymentAsset = "USDC"): Promise<number> {
	const account = loadCompany()?.address ?? required("PUBLIC_COMPANY_ACCOUNT")
	const token = new Contract(tokenContract(asset))
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

/**
 * Creates the company smart account once per browser: the admin passkey is
 * the only signer of its default rule (the `admin` rule in AGENTS.md §3), and
 * Friendbot funds it. It also creates the employee Ed25519 key and the manager
 * passkey. They are not added on chain yet: on the default rule they would
 * have to sign every admin operation. R4 and R7 add them to `ordinary` and
 * `large`.
 *
 * With `managerOnPhone` (R20) the browser shows a QR code and the manager's
 * passkey is created on their phone; later, the second signature of a `large`
 * payment is a QR scan too.
 */
export async function createCompanyAccount(
	options: { managerOnPhone?: boolean } = {},
): Promise<{ address: string }> {
	const existing = loadCompany()
	if (existing) return { address: existing.address }

	const kit = getKit()
	const employee = Keypair.random()
	// Manager first: if this prompt is cancelled, nothing is deployed.
	registeringOnPhone = options.managerOnPhone === true
	let manager: Awaited<ReturnType<typeof kit.credentials.create>>
	try {
		manager = await kit.credentials.create({
			nickname: "manager",
			appName: "Arqueo",
		})
	} finally {
		registeringOnPhone = false
	}

	await fundWithFriendbot(Keypair.fromSecret(deployerSecret()).publicKey())
	const wallet = await kit.createWallet("Arqueo", "admin", {
		nickname: "admin",
		autoSubmit: true,
	})
	if (wallet.submitResult && !wallet.submitResult.success) {
		throw new Error(
			`Account deployment failed: ${wallet.submitResult.error.message}`,
		)
	}

	const company: CompanyAccount = {
		address: wallet.contractId,
		adminCredentialId: wallet.credentialId,
		employee: { publicKey: employee.publicKey(), secret: employee.secret() },
		manager: {
			credentialId: manager.credentialId,
			publicKey: toBase64(manager.publicKey),
			device: options.managerOnPhone ? "phone" : "this-device",
		},
	}
	saveCompany(company)

	return { address: company.address }
}

function circleUsdcAsset(): Asset {
	return new Asset("USDC", CIRCLE_USDC_ISSUER)
}

/** Prepare a testnet G... address with a Circle USDC trustline for the faucet. */
export async function prepareUsdcFundingAddress(): Promise<string> {
	const company = loadCompany()
	if (!company) throw new Error("Create the company account first")
	const existing = localStorage.getItem(FUNDING_KEY)
	if (existing) {
		try {
			const saved = JSON.parse(existing) as { address?: string }
			if (
				saved.address &&
				StrKey.isValidEd25519PublicKey(saved.address) &&
				(await new Horizon.Server(required("PUBLIC_HORIZON_URL"))
					.loadAccount(saved.address)
					.then((account) =>
						account.balances.some(
							(balance) =>
								"asset_code" in balance &&
								balance.asset_code === "USDC" &&
								balance.asset_issuer === CIRCLE_USDC_ISSUER,
						),
					)
					.catch(() => false))
			) {
				return saved.address
			}
		} catch {
			// Replace corrupt funding data with a fresh address.
		}
		localStorage.removeItem(FUNDING_KEY)
	}
	const keypair = Keypair.random()
	const source = await fundWithFriendbot(keypair.publicKey())
	await addTrustline(keypair, source, circleUsdcAsset())
	localStorage.setItem(
		FUNDING_KEY,
		JSON.stringify({ address: keypair.publicKey(), secret: keypair.secret() }),
	)
	return keypair.publicKey()
}

/** Transfer faucet-funded USDC from the local G... account to the treasury. */
export async function fundCompanyAccount(): Promise<string> {
	const company = loadCompany()
	if (!company) throw new Error("Create the company account first")
	const raw = localStorage.getItem(FUNDING_KEY)
	if (!raw) throw new Error("Prepare a USDC funding address first")
	const funder = JSON.parse(raw) as { address: string; secret: string }
	if (!StrKey.isValidEd25519PublicKey(funder.address)) {
		throw new Error("The saved USDC funding address is invalid")
	}
	const keypair = Keypair.fromSecret(funder.secret)
	if (keypair.publicKey() !== funder.address) {
		throw new Error("The saved USDC funding key does not match its address")
	}
	const horizon = new Horizon.Server(required("PUBLIC_HORIZON_URL"))
	const horizonSource = await horizon.loadAccount(funder.address)
	const usdc = horizonSource.balances.find(
		(balance) =>
			"asset_code" in balance &&
			balance.asset_code === "USDC" &&
			balance.asset_issuer === CIRCLE_USDC_ISSUER,
	)
	if (!usdc || Number(usdc.balance) <= 0) {
		throw new Error(
			`Get test USDC from Circle's faucet for ${funder.address}, then retry.`,
		)
	}
	const stroops = xlmToStroops(usdc.balance)
	const source = new Account(funder.address, horizonSource.sequence)
	const server = new rpc.Server(required("PUBLIC_RPC_URL"))
	const tx = new TransactionBuilder(source, {
		fee: BASE_FEE,
		networkPassphrase: required("PUBLIC_NETWORK_PASSPHRASE"),
	})
		.addOperation(
			new Contract(tokenContract("USDC")).call(
				"transfer",
				Address.fromString(funder.address).toScVal(),
				Address.fromString(company.address).toScVal(),
				nativeToScVal(stroops, { type: "i128" }),
			),
		)
		.setTimeout(30)
		.build()
	const prepared = await server.prepareTransaction(tx)
	prepared.sign(keypair)
	const sent = await server.sendTransaction(prepared)
	if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
		throw new Error(`USDC funding transfer rejected (${sent.status})`)
	}
	const result = await server.pollTransaction(sent.hash)
	if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
		throw new Error(`USDC funding transfer ended as ${result.status}`)
	}
	localStorage.removeItem(FUNDING_KEY)
	return sent.hash
}

/** Fund a company smart account with test XLM through the native SAC. */
export async function fundCompanyXlmAccount(xlm = 9_000): Promise<string> {
	const company = loadCompany()
	if (!company) throw new Error("Create the company account first")
	const temp = Keypair.random()
	const source = await fundWithFriendbot(temp.publicKey())
	const server = new rpc.Server(required("PUBLIC_RPC_URL"))
	const tx = new TransactionBuilder(source, {
		fee: BASE_FEE,
		networkPassphrase: required("PUBLIC_NETWORK_PASSPHRASE"),
	})
		.addOperation(
			new Contract(tokenContract("XLM")).call(
				"transfer",
				Address.fromString(temp.publicKey()).toScVal(),
				Address.fromString(company.address).toScVal(),
				nativeToScVal(BigInt(xlm) * BigInt(STROOPS_PER_XLM), { type: "i128" }),
			),
		)
		.setTimeout(30)
		.build()
	const prepared = await server.prepareTransaction(tx)
	prepared.sign(temp)
	const sent = await server.sendTransaction(prepared)
	if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
		throw new Error(`XLM funding transfer rejected (${sent.status})`)
	}
	const result = await server.pollTransaction(sent.hash)
	if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
		throw new Error(`XLM funding transfer ended as ${result.status}`)
	}
	return sent.hash
}

function requireCompany(): CompanyAccount {
	const company = loadCompany()
	if (!company) throw new Error("Create the company account first")
	return company
}

async function connectedKit(company: CompanyAccount): Promise<SmartAccountKit> {
	const kit = getKit()
	await kit.connectWallet({
		contractId: company.address,
		credentialId: company.adminCredentialId,
	})
	return kit
}

// ── Rules, limits and suppliers (R6, R7, R17: AGENTS.md §3 and §3.1) ──────────

/** The settings before the admin changes anything: demo limits and PUBLIC_SUPPLIERS. */
export function initialControls(): ControlsConfig {
	return {
		limits: DEFAULT_LIMITS,
		suppliers: parseSuppliers(import.meta.env.PUBLIC_SUPPLIERS).map(
			(address, index) => ({
				address,
				label: `Supplier ${index + 1}`,
				kind: "real" as const,
			}),
		),
	}
}

/** The settings last applied from this browser, with the supplier labels. */
export function loadControlsConfig(): ControlsConfig {
	return controlsStore(localStorage).loadConfig(initialControls())
}

const describeFailure = (error: unknown): string => {
	const { reason, details } = rejectionReason(error)
	return details ? `${reason} (${details})` : reason
}

/** The threshold and `control-policy` of a rule, ordered as Soroban requires. */
function rulePolicies(
	kit: SmartAccountKit,
	asset: PaymentAsset,
	rule: RuleName,
	config: ControlsConfig,
): Map<string, unknown> {
	if (config.suppliers.length === 0) {
		throw new Error("Add at least one supplier in Settings first")
	}
	const threshold =
		rule === "ordinary"
			? ordinaryRuleParams().threshold
			: largeRuleParams().threshold
	return sortedPolicies(
		new Map<string, unknown>([
			[
				required("PUBLIC_THRESHOLD_POLICY_ADDRESS"),
				kit.convertPolicyParams("threshold", threshold),
			],
			[
				controlPolicyAddress(asset),
				controlPolicyParams(toControlParams(config, rule)),
			],
		]),
	)
}

/**
 * Adds a rule to the account. The admin passkey signs it under the admin rule.
 * `ordinary`: the employee's key, threshold 1. `large`: employee and manager,
 * threshold 2. Both carry `control-policy` built from `config`: suppliers, and
 * for `ordinary` also the per-payment maximum and the cap of the period.
 */
async function addRule(
	kit: SmartAccountKit,
	company: CompanyAccount,
	asset: PaymentAsset,
	rule: RuleName,
	config: ControlsConfig,
): Promise<{ ruleId: number; hash: string }> {
	const signers: ContractSigner[] = [
		employeeSigner(
			required("PUBLIC_ED25519_VERIFIER_ADDRESS"),
			company.employee.publicKey,
		),
	]
	if (rule === "large") {
		signers.push(
			managerSigner(
				required("PUBLIC_WEBAUTHN_VERIFIER_ADDRESS"),
				company.manager.publicKey,
				company.manager.credentialId,
			),
		)
	}
	const tx = await kit.rules.add(
		createCallContractContext(tokenContract(asset)),
		rule,
		signers,
		rulePolicies(kit, asset, rule, config),
	)
	// The simulated result is the rule the transaction creates.
	const ruleId = tx.result.id
	const result = await kit.signAndSubmit(tx, {
		credentialId: company.adminCredentialId,
		resolveContextRuleIds: () => [company.adminRuleId ?? ADMIN_RULE_ID],
	})
	if (!result.success) {
		throw new Error(
			`Adding the ${rule} rule failed: ${describeFailure(result.error)}`,
		)
	}
	return { ruleId, hash: result.hash }
}

/** Retires a rule. The account uninstalls its policies; what was spent stays. */
async function removeRule(
	kit: SmartAccountKit,
	company: CompanyAccount,
	ruleId: number,
): Promise<string> {
	const tx = await kit.rules.remove(ruleId)
	const result = await kit.signAndSubmit(tx, {
		credentialId: company.adminCredentialId,
		resolveContextRuleIds: () => [company.adminRuleId ?? ADMIN_RULE_ID],
	})
	if (!result.success) {
		throw new Error(
			`Retiring rule ${ruleId} failed: ${describeFailure(result.error)}`,
		)
	}
	return result.hash
}

const RECOVERY_POLICY_NAME = "recovery"

/** Create a 2-of-3 recovery rule. Each guardian enrolls a separate passkey. */
export async function setupRecoveryRule(): Promise<{
	ruleId: number
	hash: string
}> {
	const company = requireCompany()
	if (company.recovery) return { ruleId: company.recovery.ruleId, hash: "" }
	const kit = await connectedKit(company)
	const guardians = []
	for (let index = 1; index <= 3; index++) {
		const credential = await kit.credentials.create({
			nickname: `Recovery guardian ${index}`,
			appName: "Arqueo recovery",
		})
		await kit.credentials.save({
			credentialId: credential.credentialId,
			publicKey: credential.publicKey,
			contractId: company.address,
			isPrimary: false,
		})
		guardians.push({
			credentialId: credential.credentialId,
			publicKey: toBase64(credential.publicKey),
		})
	}
	const signers = guardians.map((guardian) =>
		managerSigner(
			required("PUBLIC_WEBAUTHN_VERIFIER_ADDRESS"),
			guardian.publicKey,
			guardian.credentialId,
		),
	)
	const tx = await kit.rules.add(
		createDefaultContext(),
		RECOVERY_POLICY_NAME,
		signers,
		new Map([
			[
				required("PUBLIC_THRESHOLD_POLICY_ADDRESS"),
				kit.convertPolicyParams("threshold", createThresholdParams(2)),
			],
		]),
	)
	const result = await kit.signAndSubmit(tx, {
		credentialId: company.adminCredentialId,
		resolveContextRuleIds: () => [company.adminRuleId ?? ADMIN_RULE_ID],
	})
	if (!result.success) {
		throw new Error(`Recovery setup failed: ${describeFailure(result.error)}`)
	}
	saveCompany({ ...company, recovery: { ruleId: tx.result.id, guardians } })
	window.dispatchEvent(new Event("arqueo:company-updated"))
	return { ruleId: tx.result.id, hash: result.hash }
}

/** Replace the admin rule after two of its three recovery guardians approve. */
export async function recoverAdminAccess(
	guardianIndexes: number[] = [0, 1],
): Promise<{ ruleId: number; hash: string }> {
	const localCompany = loadCompany()
	const recoveryPackage = loadRecoveryPackage()
	const company =
		localCompany ??
		(recoveryPackage
			? {
					address: recoveryPackage.companyAddress,
					adminCredentialId: "",
					adminRuleId: recoveryPackage.adminRuleId,
					employee: { publicKey: "", secret: "" },
					manager: { credentialId: "", publicKey: "" },
					recovery: recoveryPackage.recovery,
					rules: recoveryPackage.rules,
					assetRules: recoveryPackage.assetRules,
					recoveredFromPackage: true,
				}
			: undefined)
	if (!company)
		throw new Error(
			"Create a recovery package on the original device and import it here",
		)
	const recovery = company.recovery
	if (!recovery) throw new Error("Set up the 2-of-3 recovery rule first")
	if (
		guardianIndexes.length !== 2 ||
		new Set(guardianIndexes).size !== 2 ||
		guardianIndexes.some(
			(index) =>
				!Number.isInteger(index) ||
				index < 0 ||
				index >= recovery.guardians.length,
		)
	) {
		throw new Error("Choose exactly two of the three recovery guardians")
	}
	const selectedGuardians = guardianIndexes.map(
		(index) => recovery.guardians[index],
	)
	if (selectedGuardians.some((guardian) => guardian === undefined)) {
		throw new Error("Recovery guardian data is incomplete")
	}
	const kit = getKit()
	await kit.connectWallet({
		contractId: company.address,
		credentialId: selectedGuardians[0]!.credentialId,
	})
	const selected = selectedGuardians.map((guardian) =>
		managerSelectedSigner(
			required("PUBLIC_WEBAUTHN_VERIFIER_ADDRESS"),
			guardian!.publicKey,
			guardian!.credentialId,
		),
	)
	const authorize = {
		resolveContextRuleIds: () => [recovery.ruleId],
	}
	let pending = company.pendingAdminRecovery
	if (!pending) {
		const replacement = await kit.credentials.create({
			nickname: "Replacement admin",
			appName: "Arqueo",
		})
		await kit.credentials.save({
			credentialId: replacement.credentialId,
			publicKey: replacement.publicKey,
			contractId: company.address,
			isPrimary: false,
		})
		const newAdminSigner = managerSigner(
			required("PUBLIC_WEBAUTHN_VERIFIER_ADDRESS"),
			toBase64(replacement.publicKey),
			replacement.credentialId,
		)
		const newRule = await kit.rules.add(
			createDefaultContext(),
			"admin",
			[newAdminSigner],
			new Map(),
		)
		const added = await kit.multiSigners.operation(newRule, selected, authorize)
		if (!added.success) {
			throw new Error(
				`Replacement admin could not be added: ${describeFailure(added.error)}`,
			)
		}
		pending = {
			ruleId: newRule.result.id,
			credentialId: replacement.credentialId,
			publicKey: toBase64(replacement.publicKey),
		}
		saveCompany({ ...company, pendingAdminRecovery: pending })
	}
	const oldAdminRuleId = company.adminRuleId ?? ADMIN_RULE_ID
	const removed = await kit.multiSigners.operation(
		await kit.rules.remove(oldAdminRuleId),
		selected,
		authorize,
	)
	if (!removed.success) {
		throw new Error(
			`New admin rule ${pending.ruleId} is installed, but the old rule could not be retired: ${describeFailure(removed.error)}`,
		)
	}
	saveCompany({
		...company,
		adminCredentialId: pending.credentialId,
		adminRuleId: pending.ruleId,
		pendingAdminRecovery: undefined,
	})
	if (recoveryPackage) {
		localStorage.setItem(
			RECOVERY_PACKAGE_KEY,
			JSON.stringify({ ...recoveryPackage, adminRuleId: pending.ruleId }),
		)
	}
	window.dispatchEvent(new Event("arqueo:company-updated"))
	return { ruleId: pending.ruleId, hash: removed.hash }
}

/**
 * Adds the `ordinary` rule (AGENTS.md §3) from the saved settings. Without
 * `control-policy` configured it fails: a rule with only a threshold would
 * accept any payment, so it is never created open.
 */
export async function setupOrdinaryRule(asset: PaymentAsset = "USDC"): Promise<{
	ruleId: number
	hash?: string
}> {
	const company = requireCompany()
	const existing = assetRuleIds(company, asset).ordinary
	if (existing !== undefined) return { ruleId: existing }

	const kit = await connectedKit(company)
	const config = loadControlsConfig()
	const { ruleId, hash } = await addRule(
		kit,
		company,
		asset,
		"ordinary",
		config,
	)
	saveCompany({
		...company,
		...withAssetRule(company, asset, "ordinary", ruleId),
		...(asset === "USDC" ? { controlPolicy: { ruleId, hash } } : {}),
	})
	controlsStore(localStorage).saveConfig(config)
	return { ruleId, hash }
}

/** Adds the `large` rule (AGENTS.md §3): employee and manager, threshold 2, suppliers only. */
export async function setupLargeRule(asset: PaymentAsset = "USDC"): Promise<{
	ruleId: number
	hash?: string
}> {
	const company = requireCompany()
	const existing = assetRuleIds(company, asset).large
	if (existing !== undefined) return { ruleId: existing }

	const kit = await connectedKit(company)
	const config = loadControlsConfig()
	const { ruleId, hash } = await addRule(kit, company, asset, "large", config)
	saveCompany(withAssetRule(company, asset, "large", ruleId))
	controlsStore(localStorage).saveConfig(config)
	return { ruleId, hash }
}

/**
 * Moves an `ordinary` rule that has no `control-policy` of the current
 * contract to a new rule that does (R6). Rules are never edited in place.
 */
export async function installControlPolicy(
	asset: PaymentAsset = "USDC",
): Promise<{ hash: string }> {
	const company = requireCompany()
	const rules = assetRuleIds(company, asset)
	const ruleId = rules.ordinary
	if (ruleId === undefined) throw new Error("Set up the ordinary rule first")
	if (asset === "USDC" && company.controlPolicy?.ruleId === ruleId) {
		return { hash: company.controlPolicy.hash }
	}
	const done = await runPending(
		startMigration({
			config: loadControlsConfig(),
			existingRules: { [asset]: rules },
			rules: ["ordinary"],
			asset,
		}),
	)
	const hash = done.swaps[0]?.addHash
	if (!hash) throw new Error("control-policy install returned no hash")
	return { hash }
}

// A change runs one transaction at a time and saves its progress after each,
// so a cancelled passkey prompt or a lost connection can be resumed.
let changeRunning = false

async function runPending(
	initial: PendingChange,
	onProgress?: (pending: PendingChange) => void,
): Promise<PendingChange> {
	if (changeRunning) throw new Error("A settings change is already running")
	changeRunning = true
	const store = controlsStore(localStorage)
	let pending = initial
	try {
		store.savePending(pending)
		onProgress?.(pending)
		const kit = await connectedKit(requireCompany())
		for (let step = nextStep(pending); step; step = nextStep(pending)) {
			const company = requireCompany()
			if (step.action === "add") {
				const { ruleId, hash } = await addRule(
					kit,
					company,
					step.asset,
					step.rule,
					pending.next,
				)
				pending = withAdded(pending, step.rule, ruleId, hash, step.asset)
				store.savePending(pending)
				// Payments follow the new rule at once; the old one is retired next.
				saveCompany({
					...company,
					...withAssetRule(company, step.asset, step.rule, ruleId),
					...(step.rule === "ordinary"
						? step.asset === "USDC"
							? { controlPolicy: { ruleId, hash } }
							: {}
						: {}),
				})
			} else {
				const oldId = pending.swaps.find(
					(s) => s.rule === step.rule && s.asset === step.asset,
				)!.oldId
				const hash = await removeRule(kit, company, oldId)
				pending = withRemoved(pending, step.rule, hash, step.asset)
				store.savePending(pending)
			}
			window.dispatchEvent(new Event("arqueo:company-updated"))
			onProgress?.(pending)
		}
		// Every rule is replaced: record the change for the auditor.
		store.saveConfig(pending.next)
		const log = createChangeLog()
		for (const record of changeRecords(pending)) log.record(record)
		store.clearPending()
		window.dispatchEvent(new Event("arqueo:company-updated"))
		return pending
	} finally {
		changeRunning = false
	}
}

/** What the chain enforces now, read from the `control-policy` of each rule. */
export interface ControlState {
	asset: PaymentAsset
	hasAccount: boolean
	/** Limits and suppliers: from the chain when it could be read. */
	config: ControlsConfig
	source: "chain" | "saved"
	/** Why the chain could not be read, when `source` is "saved". */
	chainError?: string
	rules: Partial<Record<RuleName, number>>
	/** Rules not installed in the current `control-policy`: they need a migration. */
	legacyRules: RuleName[]
	spentXlm: number
	/** Estimated, from the ledger the period started in. Only when something was spent. */
	periodStart?: string
	periodEnds?: string
	warnings: string[]
}

const errorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error)

/** Reads a view function of a contract through simulation: no signature needed. */
async function readContract(
	address: string,
	method: string,
	...args: xdr.ScVal[]
): Promise<unknown> {
	const server = new rpc.Server(required("PUBLIC_RPC_URL"))
	// Simulation does not check the source account, so a throwaway one is enough.
	const source = new Account(Keypair.random().publicKey(), "0")
	const tx = new TransactionBuilder(source, {
		fee: BASE_FEE,
		networkPassphrase: required("PUBLIC_NETWORK_PASSPHRASE"),
	})
		.addOperation(new Contract(address).call(method, ...args))
		.setTimeout(30)
		.build()
	const sim = await server.simulateTransaction(tx)
	if (rpc.Api.isSimulationError(sim)) {
		throw new Error(`${method} read failed: ${sim.error}`)
	}
	return scValToNative(sim.result!.retval)
}

const sameAddresses = (a: string[], b: string[]) =>
	a.length === b.length && a.every((address) => b.includes(address))

export async function readControlState(
	asset: PaymentAsset = "USDC",
): Promise<ControlState> {
	const saved = loadControlsConfig()
	const company = loadCompany()
	const rules = company ? assetRuleIds(company, asset) : {}
	const base: ControlState = {
		asset,
		hasAccount: company !== undefined,
		config: saved,
		source: "saved",
		rules,
		legacyRules: [],
		spentXlm: 0,
		warnings: [],
	}
	if (!company || rules.ordinary === undefined) return base

	try {
		const policy = controlPolicyAddress(asset)
		const token = tokenContract(asset)
		const account = Address.fromString(company.address).toScVal()
		const paramsOf = async (ruleId: number) =>
			decodeControlParams(
				await readContract(
					policy,
					"get_params",
					account,
					nativeToScVal(ruleId, { type: "u32" }),
				),
			)

		const ordinary = await paramsOf(rules.ordinary)
		const large =
			rules.large === undefined ? undefined : await paramsOf(rules.large)

		const legacyRules: RuleName[] = []
		if (!ordinary) legacyRules.push("ordinary")
		if (rules.large !== undefined && !large) legacyRules.push("large")
		if (!ordinary) {
			return {
				...base,
				legacyRules,
				warnings: [
					"The ordinary rule was set up without the current control-policy. Migrate it to see and change the real limits.",
				],
			}
		}

		const server = new rpc.Server(required("PUBLIC_RPC_URL"))
		const spendArgs: xdr.ScVal[] =
			asset === "XLM"
				? [account, Address.fromString(token).toScVal(), nativeToScVal(ordinary.periodLedgers, { type: "u32" })]
				: [account, nativeToScVal(ordinary.periodLedgers, { type: "u32" })]
		const [spend, ledger] = await Promise.all([
			readContract(policy, "spend_state", ...spendArgs),
			server.getLatestLedger(),
		])
		const { spentStroops, periodStart } = decodeSpendState(spend)
		const spentXlm = Number(stroopsToXlm(spentStroops))
		const start = ledgerToDate(periodStart, ledger.sequence)
		const warnings: string[] = []
		if (legacyRules.includes("large")) {
			warnings.push(
				"The large rule has no supplier list from the current control-policy.",
			)
		} else if (large && !sameAddresses(large.allowlist, ordinary.allowlist)) {
			warnings.push(
				"The large rule has a different supplier list than the ordinary rule.",
			)
		}
		return {
			...base,
			config: configFromParams(ordinary, saved.suppliers),
			source: "chain",
			legacyRules,
			spentXlm,
			...(spentXlm > 0
				? {
						periodStart: start.toISOString(),
						periodEnds: new Date(
							start.getTime() +
								ordinary.periodLedgers * SECONDS_PER_LEDGER * 1000,
						).toISOString(),
					}
				: {}),
			warnings,
		}
	} catch (error) {
		return { ...base, chainError: errorMessage(error) }
	}
}

/**
 * Applies new limits and suppliers (R17). For each affected rule the new one is
 * added and then the old one retired, so no moment leaves a rule open and what
 * was spent in the cap period carries over. The admin passkey signs each step.
 * Returns null when nothing changed.
 */
export async function applyControlChange(
	next: ControlsConfig,
	onProgress?: (pending: PendingChange) => void,
): Promise<PendingChange | null> {
	const store = controlsStore(localStorage)
	if (store.loadPending()) {
		throw new Error("Finish or discard the pending change first")
	}
	const [usdcState, xlmState] = await Promise.all([
		readControlState("USDC"),
		readControlState("XLM"),
	])
	for (const state of [usdcState, xlmState]) {
		if (state.chainError) {
			throw new Error(
				`Cannot read ${state.asset} rules from the chain: ${state.chainError}`,
			)
		}
		if (state.legacyRules.length > 0) {
			throw new Error(`Migrate the ${state.asset} rules to control-policy first`)
		}
	}
	const spentAtChangeByAsset = {
		USDC: usdcState.spentXlm,
		XLM: xlmState.spentXlm,
	}
	const check = validateSettings(
		next,
		Math.max(usdcState.spentXlm, xlmState.spentXlm),
	)
	if (!check.ok) throw new Error(check.reason)

	const pending = startChange({
		prev: usdcState.config,
		next,
		existingRules: {
			USDC: usdcState.rules,
			XLM: xlmState.rules,
		},
		assets: ["USDC", "XLM"],
		spentAtChangeByAsset,
		periodStartByAsset: {
			USDC: usdcState.periodStart,
			XLM: xlmState.periodStart,
		},
	})
	if (!pending) return null
	// No rule on chain yet: the new settings are used when the rules are created.
	if (pending.swaps.length === 0) {
		store.saveConfig(next)
		return pending
	}
	return runPending(pending, onProgress)
}

/** Replaces rules that were set up without the current `control-policy`. */
export async function migrateRules(
	rules: RuleName[],
	onProgress?: (pending: PendingChange) => void,
	asset: PaymentAsset = "USDC",
): Promise<PendingChange> {
	if (controlsStore(localStorage).loadPending()) {
		throw new Error("Finish or discard the pending change first")
	}
	const company = requireCompany()
	return runPending(
		startMigration({
			config: loadControlsConfig(),
			existingRules: { [asset]: assetRuleIds(company, asset) },
			rules,
			asset,
		}),
		onProgress,
	)
}

/** A change that stopped half way (a cancelled prompt, a lost connection). */
export function loadPendingChange(): PendingChange | null {
	return controlsStore(localStorage).loadPending()
}

export async function resumePendingChange(
	onProgress?: (pending: PendingChange) => void,
): Promise<PendingChange> {
	const pending = loadPendingChange()
	if (!pending) throw new Error("There is no pending change")
	return runPending(pending, onProgress)
}

/** Drops a change that sent nothing yet. Once a rule was added it must be finished. */
export function discardPendingChange(): void {
	const pending = loadPendingChange()
	if (!pending) return
	if (!canDiscard(pending)) {
		throw new Error("A replacement rule was already added: finish the change")
	}
	controlsStore(localStorage).clearPending()
}

/** Network checks the supplier list needs (AGENTS.md §6.4). */
export const supplierDeps: SupplierDeps = {
	isValidAddress: (address) => StrKey.isValidEd25519PublicKey(address),
	accountExists: async (address) => {
		try {
			await new rpc.Server(required("PUBLIC_RPC_URL")).getAccount(address)
			return true
		} catch {
			return false
		}
	},
	// The secret key is dropped once the account can receive the payment token.
	createFundedAccount: async () => {
		const account = Keypair.random()
		const source = await fundWithFriendbot(account.publicKey())
		await addTrustline(account, source, circleUsdcAsset())
		return account.publicKey()
	},
}

/** Lets a G... account hold `asset`: a supplier cannot be paid in USDC without it. */
async function addTrustline(
	account: Keypair,
	source: Account,
	asset: Asset,
): Promise<void> {
	const server = new rpc.Server(required("PUBLIC_RPC_URL"))
	const tx = new TransactionBuilder(source, {
		fee: BASE_FEE,
		networkPassphrase: required("PUBLIC_NETWORK_PASSPHRASE"),
	})
		.addOperation(Operation.changeTrust({ asset }))
		.setTimeout(30)
		.build()
	tx.sign(account)
	const sent = await server.sendTransaction(tx)
	if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
		throw new Error(
			`Trustline for ${account.publicKey()} rejected (${sent.status})`,
		)
	}
	const result = await server.pollTransaction(sent.hash, { attempts: 20 })
	if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
		throw new Error(`Trustline ${sent.hash} ended as ${result.status}`)
	}
}

/** Creates a fresh, fully configured testnet treasury for one demo run. */
export async function setupDemoEnvironment(
	reportProgress: (step: string) => void = () => {},
): Promise<{
	companyAddress: string
	supplierAddress: string
	outsiderAddress: string
	rules: { ordinary: number; large: number; xlmOrdinary: number; xlmLarge: number }
	transactions: { ordinary: string; large: string; xlmOrdinary: string; xlmLarge: string }
}> {
	if (
		required("PUBLIC_NETWORK_PASSPHRASE") !==
		"Test SDF Network ; September 2015"
	) {
		throw new Error("R14 demo setup only runs on Stellar testnet")
	}
	if (loadCompany()) {
		throw new Error(
			"This browser already has a company account; start a fresh demo run",
		)
	}

	reportProgress("Creating a new company account and demo passkeys")
	const { address: companyAddress } = await createCompanyAccount()
	reportProgress("Creating funded supplier and outsider accounts")
	const supplierAddress = await supplierDeps.createFundedAccount()
	const outsiderAddress = await supplierDeps.createFundedAccount()
	const config: ControlsConfig = {
		limits: { ...DEFAULT_LIMITS },
		suppliers: [
			{ address: supplierAddress, label: "Demo supplier", kind: "demo" },
		],
	}
	controlsStore(localStorage).saveConfig(config)
	localStorage.setItem("arqueo.demo.outsider", outsiderAddress)

	reportProgress("Installing the ordinary employee rule")
	const usdcOrdinary = await setupOrdinaryRule("USDC")
	const xlmOrdinary = await setupOrdinaryRule("XLM")
	reportProgress("Installing the large employee-and-manager rule")
	const usdcLarge = await setupLargeRule("USDC")
	const xlmLarge = await setupLargeRule("XLM")
	if (!usdcOrdinary.hash || !usdcLarge.hash || !xlmOrdinary.hash || !xlmLarge.hash) {
		throw new Error(
			"Demo rules were already present; use a fresh browser profile",
		)
	}
	reportProgress("Demo treasury and rules are ready")
	return {
		companyAddress,
		supplierAddress,
		outsiderAddress,
		rules: {
			ordinary: usdcOrdinary.ruleId,
			large: usdcLarge.ruleId,
			xlmOrdinary: xlmOrdinary.ruleId,
			xlmLarge: xlmLarge.ruleId,
		},
		transactions: {
			ordinary: usdcOrdinary.hash,
			large: usdcLarge.hash,
			xlmOrdinary: xlmOrdinary.hash,
			xlmLarge: xlmLarge.hash,
		},
	}
}

async function recipientPreflight(
	address: string,
	asset: PaymentAsset,
): Promise<string | undefined> {
	try {
		const account = await new Horizon.Server(
			required("PUBLIC_HORIZON_URL"),
		).loadAccount(address)
		if (
			asset === "USDC" &&
			!account.balances.some(
				(balance) =>
					"asset_code" in balance &&
					balance.asset_code === "USDC" &&
					balance.asset_issuer === CIRCLE_USDC_ISSUER,
			)
		) {
			return NO_TRUSTLINE
		}
		return undefined
	} catch {
		return "The recipient account does not exist on Stellar testnet"
	}
}

/**
 * Pays from the company account. The rule follows from who signs. A payment
 * the account rules reject resolves to `{ ok: false }` and is logged too.
 */
export async function pay(p: PayInput): Promise<PayResult> {
	const rule = ruleFor(p.signers)
	if (!rule) throw new Error(`No rule for signers: ${p.signers.join(", ")}`)

	const company = requireCompany()
	const ruleId = assetRuleIds(company, p.asset)[rule]
	if (ruleId === undefined) throw new Error(`Set up the ${rule} rule first`)
	const preflightReason = await recipientPreflight(p.to, p.asset)
	if (preflightReason) {
		const outcome: PayResult = { ok: false, reason: preflightReason }
		paymentLog(localStorage).add(paymentRecord(p, rule, outcome))
		window.dispatchEvent(new Event("arqueo:payment-recorded"))
		return outcome
	}

	const kit = await connectedKit(company)
	kit.externalSigners.addEd25519FromSecret(company.employee.secret)
	const signers = [
		employeeSelectedSigner(
			required("PUBLIC_ED25519_VERIFIER_ADDRESS"),
			company.employee.publicKey,
		),
	]
	// The large rule also needs the manager's passkey: the browser asks for it.
	if (rule === "large") {
		signers.push(
			managerSelectedSigner(
				required("PUBLIC_WEBAUTHN_VERIFIER_ADDRESS"),
				company.manager.publicKey,
				company.manager.credentialId,
			),
		)
	}
	const result = await kit.multiSigners.transfer(
		tokenContract(p.asset),
		p.to,
		p.amount,
		signers,
		{ resolveContextRuleIds: () => [ruleId] },
	)
	const outcome: PayResult = result.success
		? { ok: true, hash: result.hash }
		: { ok: false, ...rejectionReason(result.error) }
	paymentLog(localStorage).add(paymentRecord(p, rule, outcome))
	window.dispatchEvent(new Event("arqueo:payment-recorded"))
	return outcome
}

/** MVP: the local payment log; P1 rebuilds it from the chain. */
export async function listPayments(): Promise<Payment[]> {
	return paymentLog(localStorage).list()
}

// Development only: the rules and payments from the browser console, until the
// payment screen (R8) lets the team exercise them.
if (import.meta.env.DEV) {
	Object.assign(window, {
		arqueo: {
			loadCompany,
			loadDemoOutsider,
			setupDemoEnvironment,
			setupRecoveryRule,
			recoverAdminAccess,
			setupOrdinaryRule,
			setupLargeRule,
			readControlState,
			applyControlChange,
			loadControlsConfig,
			pay,
			listPayments,
		},
	})
}
