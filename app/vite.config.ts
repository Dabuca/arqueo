import { type IncomingMessage, type ServerResponse } from "node:http"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import wasm from "vite-plugin-wasm"
import { handleFundingHttp } from "../server/fundingHttp"

// Local stand-in for api/fund-usdc.ts: the same handler, secrets read from .env.local.
function fundingApi(env: Record<string, string | undefined>): Plugin {
	return {
		name: "arqueo-funding-api",
		configureServer(server) {
			server.middlewares.use(
				"/api/fund-usdc",
				(req: IncomingMessage, res: ServerResponse) => {
					void handleFundingHttp(req, res, env)
				},
			)
		},
	}
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "")
	return {
		plugins: [
			react(),
			fundingApi(env),
			nodePolyfills({
				include: ["buffer"],
				globals: {
					Buffer: true,
					global: true,
				},
			}),
			wasm(),
		],
		build: {
			target: "esnext",
		},
		optimizeDeps: {
			exclude: ["@stellar/stellar-xdr-json"],
		},
		define: {
			global: "window",
		},
		envPrefix: "PUBLIC_",
		server: {
			proxy: {
				"/friendbot": {
					target: "http://localhost:8000/friendbot",
					changeOrigin: true,
				},
			},
		},
	}
})
