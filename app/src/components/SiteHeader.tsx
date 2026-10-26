import { Menu, X } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Link, NavLink } from "react-router-dom"
// Same symbol asset as the Landing page.
import symbol from "../images/arqueo-symbol.jpg"
import styles from "./SiteHeader.module.css"

const NAV = [
	{ to: "/app", label: "Treasury" },
	{ to: "/auditor", label: "Auditor" },
	{ to: "/settings", label: "Settings" },
	{ to: "/cashout", label: "Supplier" },
] as const

// App header: brand on the left, the app's pages in the middle, the wallet on the right.
export function SiteHeader({ wallet }: { wallet?: ReactNode }) {
	const [menuOpen, setMenuOpen] = useState(false)
	const closeMenu = () => setMenuOpen(false)

	const linkClass = (isActive: boolean) =>
		isActive ? `${styles.link} ${styles.linkActive}` : styles.link

	return (
		<header className={styles.header}>
			<div className={styles.headerBar}>
				<Link to="/" className={styles.brand} aria-label="Arqueo home">
					<img src={symbol} alt="" width={36} height={36} className={styles.symbol} />
					<span className={styles.brandName}>Arqueo</span>
				</Link>

				<nav className={styles.links} aria-label="App pages">
					{NAV.map(({ to, label }) => (
						<NavLink key={to} to={to} className={({ isActive }) => linkClass(isActive)}>
							{label}
						</NavLink>
					))}
				</nav>

				<div className={styles.end}>
					{wallet}

					<button
						type="button"
						className={styles.menuButton}
						aria-expanded={menuOpen}
						aria-controls="mobile-menu"
						aria-label="Toggle menu"
						onClick={() => setMenuOpen((open) => !open)}
					>
						{menuOpen ? <X size={24} strokeWidth={1.8} /> : <Menu size={24} strokeWidth={1.8} />}
					</button>
				</div>
			</div>

			{menuOpen && (
				<nav id="mobile-menu" className={styles.mobilePanel} aria-label="App pages">
					{NAV.map(({ to, label }) => (
						<NavLink
							key={to}
							to={to}
							className={({ isActive }) =>
								isActive ? `${styles.mobileLink} ${styles.mobileActive}` : styles.mobileLink
							}
							onClick={closeMenu}
						>
							{label}
						</NavLink>
					))}
				</nav>
			)}
		</header>
	)
}
