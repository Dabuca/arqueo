import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
// Same symbol asset as the Landing page.
import symbol from "../images/arqueo-symbol.jpg"
import styles from "./SiteHeader.module.css"

const ICONS = {
	arrow: "M5 12h14M13 6l6 6-6 6",
	menu: "M4 6h16M4 12h16M4 18h16",
	close: "M18 6 6 18M6 6l12 12",
} as const

type IconName = keyof typeof ICONS

function Icon({ name, className }: { name: IconName; className?: string }) {
	return (
		<svg
			className={className ?? styles.icon}
			viewBox="0 0 24 24"
			width="24"
			height="24"
			aria-hidden="true"
		>
			<path d={ICONS[name]} />
		</svg>
	)
}

// Shared header. `wallet` is rendered beside the demo button on every screen size.
export function SiteHeader({ wallet }: { wallet?: ReactNode }) {
	const [menuOpen, setMenuOpen] = useState(false)
	const closeMenu = () => setMenuOpen(false)

	return (
		<header className={styles.header}>
			<div className={styles.headerBar}>
				<Link to="/" className={styles.brand} aria-label="Arqueo home">
					<img src={symbol} alt="" width={36} height={36} className={styles.symbol} />
					<span className={styles.brandName}>Arqueo</span>
				</Link>

				<nav className={styles.links} aria-label="Sections">
					<a href="/#solution" className={`${styles.link} ${styles.linkActive}`}>
						Solution
					</a>
					<a href="/#safeguards" className={styles.link}>
						Safeguards
					</a>
					<a href="/#roles" className={styles.link}>
						Roles
					</a>
					<a href="/#architecture" className={styles.link}>
						Docs
					</a>
				</nav>

				<div className={styles.end}>
					<div className={styles.headerActions}>
						<Link to="/app" className={styles.headerCta}>
							Launch Demo
							<Icon name="arrow" className={styles.inlineIcon} />
						</Link>
					</div>

					{wallet}

					<button
						type="button"
						className={styles.menuButton}
						aria-expanded={menuOpen}
						aria-controls="mobile-menu"
						aria-label="Toggle menu"
						onClick={() => setMenuOpen((open) => !open)}
					>
						<Icon name={menuOpen ? "close" : "menu"} />
					</button>
				</div>
			</div>

			{menuOpen && (
				<div id="mobile-menu" className={styles.mobilePanel}>
					<a href="/#solution" className={styles.mobileLink} onClick={closeMenu}>
						Solution
					</a>
					<a href="/#safeguards" className={styles.mobileLink} onClick={closeMenu}>
						Safeguards
					</a>
					<a href="/#roles" className={styles.mobileLink} onClick={closeMenu}>
						Roles
					</a>
					<a href="/#architecture" className={styles.mobileLink} onClick={closeMenu}>
						Docs
					</a>
					<Link to="/app" className={styles.headerCta} onClick={closeMenu}>
						Launch Demo
					</Link>
				</div>
			)}
		</header>
	)
}
