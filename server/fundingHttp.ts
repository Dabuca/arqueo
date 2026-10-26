import { fundUsdc, type FundingEnv } from "./fundUsdc"

// Minimal shapes of the Node request and response, so this file needs no Node
// types: Node's IncomingMessage and ServerResponse fit them.
interface HttpRequest {
	method?: string
	/** Set by Vercel when it already parsed the body. */
	body?: unknown
	[Symbol.asyncIterator](): AsyncIterator<string | Uint8Array>
}

interface HttpResponse {
	statusCode: number
	headersSent: boolean
	setHeader(name: string, value: string): unknown
	end(data?: string): unknown
}

/** Largest request body accepted: a funding request is two short fields. */
const MAX_BODY_BYTES = 4_096

function parseJson(raw: string): unknown {
	try {
		return JSON.parse(raw || "{}")
	} catch {
		return undefined // fundUsdc answers 400 for anything that is not a request
	}
}

/** The JSON body of a request, however the platform delivered it. Never throws. */
export async function readJsonBody(req: HttpRequest): Promise<unknown> {
	const delivered = req.body
	if (typeof delivered === "string") return parseJson(delivered)
	if (delivered instanceof Uint8Array) {
		return parseJson(new TextDecoder().decode(delivered))
	}
	if (delivered !== undefined && delivered !== null) return delivered

	const decoder = new TextDecoder()
	let raw = ""
	let size = 0
	for await (const chunk of req) {
		size += chunk.length
		if (size > MAX_BODY_BYTES) return undefined
		raw +=
			typeof chunk === "string"
				? chunk
				: decoder.decode(chunk, { stream: true })
	}
	return parseJson(raw)
}

function sendJson(res: HttpResponse, status: number, body: unknown) {
	res.statusCode = status
	res.setHeader("content-type", "application/json")
	res.setHeader("cache-control", "no-store")
	res.end(JSON.stringify(body))
}

/**
 * POST /api/fund-usdc for Vercel and for the dev server. Whatever goes wrong,
 * it answers with JSON and never lets an exception escape the request.
 */
export async function handleFundingHttp(
	req: HttpRequest,
	res: HttpResponse,
	env: FundingEnv,
): Promise<void> {
	try {
		if (req.method !== "POST") {
			res.setHeader("allow", "POST")
			return sendJson(res, 405, { error: "Use POST" })
		}
		const result = await fundUsdc(await readJsonBody(req), env)
		sendJson(res, result.status, result.body)
	} catch {
		if (!res.headersSent) {
			sendJson(res, 500, {
				error: "Unexpected error while funding. Try again.",
			})
		}
	}
}
