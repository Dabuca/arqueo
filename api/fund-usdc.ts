import type { IncomingMessage, ServerResponse } from "node:http"
import { handleFundingHttp } from "../server/fundingHttp"

// POST /api/fund-usdc with { to, amount }. The issuer secret stays in the
// server environment (USDC_ISSUER_SECRET), never in the browser bundle.
export default function handler(
	req: IncomingMessage & { body?: unknown },
	res: ServerResponse,
) {
	return handleFundingHttp(req, res, process.env)
}
