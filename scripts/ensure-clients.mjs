import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// `stellar scaffold build` generates app-lib/clients/index.ts, and the file is
// not in git. Vercel has no Rust or Stellar CLI, so its build writes the part
// the app reads (the testnet `options`) when the file is missing. A generated
// file is never overwritten.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const target = resolve(root, "app-lib/clients/index.ts")

if (existsSync(target)) {
	console.log("app-lib/clients/index.ts exists: left as it is")
} else {
	mkdirSync(dirname(target), { recursive: true })
	writeFileSync(
		target,
		`// Written by scripts/ensure-clients.mjs because the scaffold did not generate it.
export const options = {
	networkPassphrase: "Test SDF Network ; September 2015",
	rpcUrl: "https://soroban-testnet.stellar.org",
	allowHttp: false,
}
`,
	)
	console.log("app-lib/clients/index.ts written (testnet options)")
}
