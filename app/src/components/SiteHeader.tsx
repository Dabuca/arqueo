import { ArrowDownToLine, ClipboardList, Settings2, Wallet } from "lucide-react"
import { type ReactNode } from "react"
import { Link, NavLink } from "react-router-dom"
import symbol from "../styles/arqueo-orbit.webp"
import styles from "./SiteHeader.module.css"
import { TestnetBanner } from "./TestnetBanner"

const NAV = [
	{ to: "/app", label: "Treasury", Icon: Wallet },
	{ to: "/auditor", label: "Audit", Icon: ClipboardList },
	{ to: "/settings", label: "Settings", Icon: Settings2 },
	{ to: "/cashout", label: "Cash out", Icon: ArrowDownToLine },
] as const

export function SiteHeader({ wallet }: { wallet?: ReactNode }) {
	return (
		<>
			<div className={styles.sidebar}>
				<Link to="/" className={styles.brand} aria-label="Arqueo home">
					<img src={symbol} alt="" width={36} height={36} className={styles.symbol} />
					<span className={styles.brandName}>Arqueo</span>
				</Link>

				<nav className={styles.links} aria-label="Workspace">
					{NAV.map(({ to, label, Icon }) => (
						<NavLink key={to} to={to} className={styles.link}>
							<Icon size={18} strokeWidth={1.7} aria-hidden="true" />
							{label}
						</NavLink>
					))}
				</nav>
			</div>
			<header className={styles.topbar}>
				<TestnetBanner />
				<div className={styles.wallet}>{wallet}</div>
			</header>
		</>
	)
}
