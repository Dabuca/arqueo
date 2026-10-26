import { startAuthentication, startRegistration } from "@simplewebauthn/browser"
import {
	Account,
	Address,
	Asset,
	BASE_FEE,
	Contract,
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
import { stroopsToXlm } from "../controls/units"
import { controlsStore } from "./controlsStore"
import {
	employeeSelectedSigner,
	employeeSigner,
	largeRuleParams,
	managerSelectedSigner,
	managerSigner,
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

export interface Payment {
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
const FRIENDBOT_URL = "https://friendbot.stellar.org"
const FUNDING_TIMEOUT_MS = 45_000

/**
 * The company treasury and its signers' keys. Demo shortcut (AGENTS.md §3):
 * everything lives in this browser's localStorage. In production each person
 * would sign with a passkey on their own device. Testnet only.
 */
export interface CompanyAccount {
	address: string
	adminCredentialId: string
	employee: { publicKey: string; secret: string }
	manager: {
		credentialId: string
		publicKey: string // base64
		// Where the passkey lives (R20). Missing = this browser's device.
		device?: "phone" | "this-device"
	}
	rules?: Partial<Record<RuleName, number>> // on-chain context rule ids
	controlPolicy?: { ruleId: number; hash: string } // installed on that rule
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
export async function getBalance(): Promise<number> {
	const account = loadCompany()?.address ?? required("PUBLIC_COMPANY_ACCOUNT")
	const token = new Contract(required("PUBLIC_NATIVE_TOKEN_CONTRACT"))
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

	// Saved before funding: the account exists even if funding fails.
	try {
		await fundCompanyAccount()
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		throw new Error(
			`Account ${company.address} created but not funded: ${message}`,
		)
	}
	return { address: company.address }
}

/**
 * Sends test USDC from the issuer to the company account and returns the
 * transaction hash. The issuer key lives on the server (api/fund-usdc.ts), so
 * the browser only asks for it: the account and the public suppliers never see
 * the secret.
 */
export async function fundCompanyAccount(usdc = 9_000): Promise<string> {
	const company = loadCompany()
	if (!company) throw new Error("Create the company account first")

	let response: Response
	try {
		response = await fetch("/api/fund-usdc", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ to: company.address, amount: usdc }),
			signal: AbortSignal.timeout(FUNDING_TIMEOUT_MS),
		})
	} catch (error) {
		const timedOut =
			error instanceof DOMException && error.name === "TimeoutError"
		throw new Error(
			timedOut
				? "Funding is taking too long. Check the balance in a minute before trying again."
				: "Could not reach the funding service. Check your connection and try again.",
		)
	}
	// The platform can answer with HTML (a 502 or 504 page): never assume JSON.
	const body = (await response.json().catch(() => ({}))) as {
		hash?: string
		error?: string
	}
	if (!response.ok || !body.hash) {
		throw new Error(body.error ?? `Funding failed (${response.status})`)
	}
	return body.hash
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
				required("PUBLIC_CONTROL_POLICY_ADDRESS"),
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
		createCallContractContext(required("PUBLIC_NATIVE_TOKEN_CONTRACT")),
		rule,
		signers,
		rulePolicies(kit, rule, config),
	)
	// The simulated result is the rule the transaction creates.
	const ruleId = tx.result.id
	const result = await kit.signAndSubmit(tx, {
		credentialId: company.adminCredentialId,
		resolveContextRuleIds: () => [ADMIN_RULE_ID],
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
		resolveContextRuleIds: () => [ADMIN_RULE_ID],
	})
	if (!result.success) {
		throw new Error(
			`Retiring rule ${ruleId} failed: ${describeFailure(result.error)}`,
		)
	}
	return result.hash
}

/**
 * Adds the `ordinary` rule (AGENTS.md §3) from the saved settings. Without
 * `control-policy` configured it fails: a rule with only a threshold would
 * accept any payment, so it is never created open.
 */
export async function setupOrdinaryRule(): Promise<{
	ruleId: number
	hash?: string
}> {
	const company = requireCompany()
	const existing = company.rules?.ordinary
	if (existing !== undefined) return { ruleId: existing }

	const kit = await connectedKit(company)
	const config = loadControlsConfig()
	const { ruleId, hash } = await addRule(kit, company, "ordinary", config)
	saveCompany({
		...company,
		rules: { ...company.rules, ordinary: ruleId },
		controlPolicy: { ruleId, hash },
	})
	controlsStore(localStorage).saveConfig(config)
	return { ruleId, hash }
}

/** Adds the `large` rule (AGENTS.md §3): employee and manager, threshold 2, suppliers only. */
export async function setupLargeRule(): Promise<{
	ruleId: number
	hash?: string
}> {
	const company = requireCompany()
	const existing = company.rules?.large
	if (existing !== undefined) return { ruleId: existing }

	const kit = await connectedKit(company)
	const config = loadControlsConfig()
	const { ruleId, hash } = await addRule(kit, company, "large", config)
	saveCompany({ ...company, rules: { ...company.rules, large: ruleId } })
	controlsStore(localStorage).saveConfig(config)
	return { ruleId, hash }
}

/**
 * Moves an `ordinary` rule that has no `control-policy` of the current
 * contract to a new rule that does (R6). Rules are never edited in place.
 */
export async function installControlPolicy(): Promise<{ hash: string }> {
	const company = requireCompany()
	const ruleId = company.rules?.ordinary
	if (ruleId === undefined) throw new Error("Set up the ordinary rule first")
	if (company.controlPolicy?.ruleId === ruleId) {
		return { hash: company.controlPolicy.hash }
	}
	const done = await runPending(
		startMigration({
			config: loadControlsConfig(),
			existingRules: company.rules ?? {},
			rules: ["ordinary"],
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
					step.rule,
					pending.next,
				)
				pending = withAdded(pending, step.rule, ruleId, hash)
				store.savePending(pending)
				// Payments follow the new rule at once; the old one is retired next.
				saveCompany({
					...company,
					rules: { ...company.rules, [step.rule]: ruleId },
					...(step.rule === "ordinary"
						? { controlPolicy: { ruleId, hash } }
						: {}),
				})
			} else {
				const oldId = pending.swaps.find((s) => s.rule === step.rule)!.oldId
				const hash = await removeRule(kit, company, oldId)
				pending = withRemoved(pending, step.rule, hash)
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

export async function readControlState(): Promise<ControlState> {
	const saved = loadControlsConfig()
	const company = loadCompany()
	const rules = company?.rules ?? {}
	const base: ControlState = {
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
		const policy = required("PUBLIC_CONTROL_POLICY_ADDRESS")
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
		const [spend, ledger] = await Promise.all([
			readContract(
				policy,
				"spend_state",
				account,
				nativeToScVal(ordinary.periodLedgers, { type: "u32" }),
			),
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
	const state = await readControlState()
	if (state.chainError) {
		throw new Error(`Cannot read the rules from the chain: ${state.chainError}`)
	}
	if (state.legacyRules.length > 0) {
		throw new Error("Migrate the rules to the current control-policy first")
	}
	const check = validateSettings(next, state.spentXlm)
	if (!check.ok) throw new Error(check.reason)

	const pending = startChange({
		prev: state.config,
		next,
		existingRules: state.rules,
		spentAtChange: state.spentXlm,
		periodStart: state.periodStart,
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
): Promise<PendingChange> {
	if (controlsStore(localStorage).loadPending()) {
		throw new Error("Finish or discard the pending change first")
	}
	const company = requireCompany()
	return runPending(
		startMigration({
			config: loadControlsConfig(),
			existingRules: company.rules ?? {},
			rules,
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
		const asset = await paymentAsset()
		if (asset) await addTrustline(account, source, asset)
		return account.publicKey()
	},
}

/**
 * The classic asset behind the payment token's Stellar Asset Contract, read
 * from its `name` ("USDC:G..."). Undefined for native XLM, which needs no
 * trustline.
 */
async function paymentAsset(): Promise<Asset | undefined> {
	const token = new Contract(required("PUBLIC_NATIVE_TOKEN_CONTRACT"))
	const server = new rpc.Server(required("PUBLIC_RPC_URL"))
	// Simulation does not check the source account, so a throwaway one is enough.
	const source = new Account(Keypair.random().publicKey(), "0")
	const tx = new TransactionBuilder(source, {
		fee: BASE_FEE,
		networkPassphrase: required("PUBLIC_NETWORK_PASSPHRASE"),
	})
		.addOperation(token.call("name"))
		.setTimeout(30)
		.build()
	const sim = await server.simulateTransaction(tx)
	if (rpc.Api.isSimulationError(sim)) {
		throw new Error(`Token name read failed: ${sim.error}`)
	}
	const name = String(scValToNative(sim.result!.retval))
	if (name === "native") return undefined
	const [code, issuer] = name.split(":")
	if (!code || !issuer) throw new Error(`Unexpected token name: ${name}`)
	return new Asset(code, issuer)
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
	rules: { ordinary: number; large: number }
	transactions: { ordinary: string; large: string }
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
	const ordinary = await setupOrdinaryRule()
	reportProgress("Installing the large employee-and-manager rule")
	const large = await setupLargeRule()
	if (!ordinary.hash || !large.hash) {
		throw new Error(
			"Demo rules were already present; use a fresh browser profile",
		)
	}
	reportProgress("Demo treasury and rules are ready")
	return {
		companyAddress,
		supplierAddress,
		outsiderAddress,
		rules: { ordinary: ordinary.ruleId, large: large.ruleId },
		transactions: { ordinary: ordinary.hash, large: large.hash },
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
	const ruleId = company.rules?.[rule]
	if (ruleId === undefined) throw new Error(`Set up the ${rule} rule first`)

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
		required("PUBLIC_NATIVE_TOKEN_CONTRACT"),
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
