import { useQuery } from "@tanstack/react-query"
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react"

export type Currency = "XLM" | "USD"

const STORAGE_KEY = "arqueo.currency"
const PRICE_URL =
	"https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd"

interface CurrencyContextValue {
	currency: Currency
	setCurrency: (currency: Currency) => void
	/** USD per 1 XLM, or undefined while loading or if the price is unavailable. */
	rate: number | undefined
	priceStatus: "loading" | "ok" | "error"
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

const readStoredCurrency = (): Currency => {
	try {
		return localStorage.getItem(STORAGE_KEY) === "USD" ? "USD" : "XLM"
	} catch {
		return "XLM"
	}
}

async function fetchXlmUsd(): Promise<number> {
	const response = await fetch(PRICE_URL)
	if (!response.ok) throw new Error(`Price request failed: ${response.status}`)
	const body = (await response.json()) as { stellar?: { usd?: number } }
	const usd = body.stellar?.usd
	if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) {
		throw new Error("Price response has no XLM/USD value")
	}
	return usd
}

// Display only: payments, limits and the account rules always work in XLM.
export function CurrencyProvider({ children }: { children: ReactNode }) {
	const [currency, setCurrencyState] = useState<Currency>(readStoredCurrency)

	const setCurrency = useCallback((next: Currency) => {
		setCurrencyState(next)
		try {
			localStorage.setItem(STORAGE_KEY, next)
		} catch {
			// Private window or blocked storage: the choice just won't persist.
		}
	}, [])

	const price = useQuery({
		queryKey: ["xlm-usd-price"],
		queryFn: fetchXlmUsd,
		staleTime: 60_000,
		refetchInterval: 60_000,
	})

	const value = useMemo<CurrencyContextValue>(
		() => ({
			currency,
			setCurrency,
			rate: price.data,
			priceStatus: price.isError
				? price.data === undefined
					? "error"
					: "ok"
				: price.data === undefined
					? "loading"
					: "ok",
		}),
		[currency, setCurrency, price.data, price.isError],
	)

	return (
		<CurrencyContext.Provider value={value}>
			{children}
		</CurrencyContext.Provider>
	)
}

export function useCurrency(): CurrencyContextValue {
	const context = useContext(CurrencyContext)
	if (!context) throw new Error("useCurrency must be used inside CurrencyProvider")
	return context
}
