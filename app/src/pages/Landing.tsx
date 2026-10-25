import {
	ArrowLeftRight,
	ArrowRight,
	BadgeCheck,
	Check,
	CircleCheck,
	ClipboardList,
	Code,
	ExternalLink,
	FileSpreadsheet,
	KeyRound,
	ListChecks,
	Menu,
	Network,
	ReceiptText,
	Scale,
	ShieldCheck,
	ShieldUser,
	ShieldX,
	Store,
	Timer,
	TriangleAlert,
	UserRound,
	Users,
	X,
	type LucideIcon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
// Logo asset derived from the brand file arqueo1.jpeg: the symbol with a cream ground.
import { BrandOrbit } from "../components/BrandOrbit"
import { OrbitRings, OrbitSystem } from "../components/OrbitField"
import { SiteFooter } from "../components/SiteFooter"
import symbol from "../images/arqueo-symbol.jpg"
import styles from "./Landing.module.css"

const REPO_URL = "https://github.com/Dabuca/arqueo"

// Illustrative figures for the dashboard preview, matching the four demo scenes.
const STATS = [
	["Balance", "4,820 XLM"],
	["Spent, last 30 days", "1,000 / 1,000"],
	["Refused attempts", "2"],
	["Allowlisted suppliers", "3"],
] as const

const LEDGER = [
	{ to: "Supplier 1", amount: "200", signers: "Employee", rule: "Ordinary", settled: true, status: "Settled" },
	{ to: "Unknown account", amount: "100", signers: "Employee", rule: "Ordinary", settled: false, status: "Refused: not allowlisted" },
	{ to: "Supplier 2", amount: "2,000", signers: "Employee", rule: "Ordinary", settled: false, status: "Refused: over 500 per payment" },
	{ to: "Supplier 2", amount: "800", signers: "Employee + Manager", rule: "Large", settled: true, status: "Settled" },
]

const STATUS_QUO = [
	"Whoever holds the key can move every balance in one transaction.",
	"Approvals arrive as messages in a group chat.",
	"The auditor receives screenshots weeks later.",
]

const WITH_ARQUEO = [
	"The account refuses payments that break its rules, before they execute.",
	"Larger payments need a second signature the account itself requires.",
	"Every payment and every refused attempt is recorded with its transaction.",
]

const ROLES: { role: string; signs: string; icon: IconName; does: string }[] = [
	{ role: "Admin", signs: "Passkey", icon: "admin", does: "Creates the account, rules, signers and suppliers. Sets the limits." },
	{ role: "Employee", signs: "Ed25519 key", icon: "badge", does: "Makes ordinary payments within the per-payment limit." },
	{ role: "Manager", signs: "Passkey", icon: "verified", does: "Adds the second signature on payments above the limit." },
	{ role: "Auditor", signs: "Nothing, read only", icon: "policy", does: "Sees every payment and every refusal, and exports a CSV." },
]

const STEPS: { title: string; body: string; icon: IconName }[] = [
	{
		title: "Someone asks to pay",
		icon: "stepRequest",
		body: "The employee enters supplier, amount and concept.",
	},
	{
		title: "The account checks its rules",
		icon: "stepRules",
		body: "Simulated against the account: allowlist, limits and signature threshold.",
	},
	{
		title: "A failed rule stops the payment",
		icon: "stepRefused",
		body: "The attempt is logged with its reason. Sent anyway, the network rejects it too.",
	},
	{
		title: "A passing payment settles",
		icon: "stepSettled",
		body: "Signed and submitted to testnet, with a link to stellar.expert.",
	},
	{
		title: "The auditor reads the journal",
		icon: "stepJournal",
		body: "Every payment and refusal, as CSV.",
	},
]

const ICONS = {
	arrow: ArrowRight,
	launch: ExternalLink,
	code: Code,
	warning: TriangleAlert,
	shield: ShieldCheck,
	check: Check,
	cancel: X,
	close: X,
	menu: Menu,
	admin: ShieldUser,
	badge: UserRound,
	verified: BadgeCheck,
	policy: ClipboardList,
	audit: ClipboardList,
	hub: Network,
	key: KeyRound,
	receipt: ReceiptText,
	payments: ArrowLeftRight,
	rules: Scale,
	suppliers: Store,
	ruleDestinations: ListChecks,
	ruleVolume: Timer,
	ruleDualControl: Users,
	ruleRefusals: ReceiptText,
	stepRequest: UserRound,
	stepRules: Scale,
	stepRefused: ShieldX,
	stepSettled: CircleCheck,
	stepJournal: FileSpreadsheet,
} satisfies Record<string, LucideIcon>

type IconName = keyof typeof ICONS

function Icon({ name, className }: { name: IconName; className?: string }) {
	const Glyph = ICONS[name]
	return (
		<Glyph
			className={className ?? styles.icon}
			size={24}
			strokeWidth={1.8}
			aria-hidden="true"
			focusable="false"
		/>
	)
}

// The four demo scenes, as the visitor will see them on testnet.
const SCENES: { icon: IconName; title: string; body: string; tag: string; tone: "ok" | "no" | "dark" }[] = [
	{ icon: "stepSettled", title: "Pay a listed supplier", body: "Below the limit, the employee signs alone.", tag: "Settled", tone: "ok" },
	{ icon: "ruleDualControl", title: "Pay above the limit", body: "One signature is refused. The manager's makes it pass.", tag: "Needs manager", tone: "dark" },
	{ icon: "stepRefused", title: "Pay an unknown account", body: "Stopped by the account rules.", tag: "Refused", tone: "no" },
	{ icon: "stepJournal", title: "Read the journal", body: "Every attempt, ready as CSV.", tag: "CSV", tone: "dark" },
]

const NAV = [
	["solution", "Solution"],
	["safeguards", "Safeguards"],
	["roles", "Roles"],
	["architecture", "Docs"],
] as const

function Header() {
	const [menuOpen, setMenuOpen] = useState(false)
	const [active, setActive] = useState<string>("solution")
	// A click owns the underline until its smooth scroll ends, so the sections it passes do not steal it.
	const lockUntil = useRef(0)
	const closeMenu = () => setMenuOpen(false)

	useEffect(() => {
		const sections = NAV.map(([id]) => document.getElementById(id)).filter(
			(el): el is HTMLElement => el !== null,
		)
		const observer = new IntersectionObserver(
			(entries) => {
				if (performance.now() < lockUntil.current) return
				for (const entry of entries) {
					if (entry.isIntersecting) setActive(entry.target.id)
				}
			},
			{ rootMargin: "-40% 0px -55% 0px" },
		)
		for (const section of sections) observer.observe(section)
		return () => observer.disconnect()
	}, [])

	const choose = (id: string) => {
		setActive(id)
		lockUntil.current = performance.now() + 1000
		closeMenu()
	}

	return (
		<header className={styles.header}>
			<div className={styles.headerBar}>
				<Link to="/" className={styles.brand} aria-label="Arqueo home">
					<img src={symbol} alt="" width={36} height={36} className={styles.symbol} />
					<span className={styles.brandName}>Arqueo</span>
				</Link>

				<nav className={styles.links} aria-label="Sections">
					{NAV.map(([id, label]) => (
						<a
							key={id}
							href={`#${id}`}
							className={active === id ? `${styles.link} ${styles.linkActive}` : styles.link}
							aria-current={active === id ? "location" : undefined}
							onClick={() => choose(id)}
						>
							{label}
						</a>
					))}
				</nav>

				<div className={styles.end}>
					<div className={styles.headerActions}>
						<Link to="/app" className={styles.headerCta}>
							Launch Demo
							<Icon name="arrow" className={styles.inlineIcon} />
						</Link>
					</div>

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
					{NAV.map(([id, label]) => (
						<a key={id} href={`#${id}`} className={styles.mobileLink} onClick={() => choose(id)}>
							{label}
						</a>
					))}
					<Link to="/app" className={styles.headerCta} onClick={closeMenu}>
						Launch Demo
					</Link>
				</div>
			)}
		</header>
	)
}

export default function Landing() {
	return (
		<div className={styles.landing}>
			<a className={styles.skip} href="#main">
				Skip to content
			</a>
			<Header />

			<main id="main">
				<section className={styles.hero}>
					<BrandOrbit className={styles.heroOrbit} />
					<div className={styles.heroInner}>
						<div className={styles.pitch}>
							<h1>Payment governance, programmed into your account.</h1>
							<p className={styles.lead}>
								Your approval matrix becomes rules on a Stellar smart account. A
								payment that breaks them is refused before it executes, and every
								attempt is recorded.
							</p>
							<div className={styles.actions}>
								<Link to="/app" className={styles.primary}>
									Launch Demo (Testnet)
									<Icon name="launch" className={styles.inlineIcon} />
								</Link>
								<a href="#architecture" className={styles.outline}>
									<Icon name="code" className={styles.inlineIcon} />
									View how it is built
								</a>
							</div>
						</div>

						<figure className={styles.product} aria-label="Illustrative view of the Arqueo payments dashboard">
							<div className={styles.chrome} aria-hidden="true">
								<span />
								<span />
								<span />
								<span className={styles.url}>arqueo · stellar testnet</span>
							</div>
							<div className={styles.appBody}>
								<aside className={styles.sidebar} aria-hidden="true">
									<div className={styles.sideBrand}>
										<img src={symbol} alt="" width={22} height={22} className={styles.sideSymbol} />
										Arqueo
									</div>
									<span className={styles.sideItemActive}><Icon name="payments" className={styles.sideIcon} />Payments</span>
									<span className={styles.sideItem}><Icon name="rules" className={styles.sideIcon} />Rules</span>
									<span className={styles.sideItem}><Icon name="suppliers" className={styles.sideIcon} />Suppliers</span>
									<span className={styles.sideItem}><Icon name="audit" className={styles.sideIcon} />Audit log</span>
								</aside>
								<div className={styles.appMain}>
									<div className={styles.appTop}>
										<span className={styles.appTitle}>Payments</span>
										<span className={styles.pillDark}>New payment</span>
									</div>
									<dl className={styles.stats}>
										{STATS.map(([label, value]) => (
											<div key={label} className={styles.stat}>
												<dt>{label}</dt>
												<dd>{value}</dd>
											</div>
										))}
									</dl>
									<div className={styles.tableWrap}>
										<table className={styles.ledger}>
											<caption className={styles.srOnly}>Recent payments</caption>
											<thead>
												<tr>
													<th scope="col">Recipient</th>
													<th scope="col">Amount</th>
													<th scope="col">Signed by</th>
													<th scope="col">Rule</th>
													<th scope="col">Status</th>
												</tr>
											</thead>
											<tbody>
												{LEDGER.map((row) => (
													<tr key={`${row.to}-${row.amount}`}>
														<td>{row.to}</td>
														<td className={styles.num}>{row.amount} XLM</td>
														<td>{row.signers}</td>
														<td>{row.rule}</td>
														<td>
															<span className={row.settled ? styles.pillOk : styles.pillError}>
																{row.status}
															</span>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							</div>
						</figure>
					</div>
				</section>

				<section id="solution" className={styles.diagnostic} aria-labelledby="solution-title">
					<OrbitSystem variant="single" className={styles.orbitBg} x="82%" y="26%" />
					<div className={styles.sectionHead}>
						<h2 id="solution-title">One key should not move all the money.</h2>
					</div>
					<div className={styles.twoCols}>
						<article className={styles.card}>
							<span className={styles.pillError}>Today</span>
							<h3>Single key, chat approvals</h3>
							<ul className={styles.bullets}>
								{STATUS_QUO.map((line) => (
									<li key={line}>
										<Icon name="cancel" className={styles.iconError} />
										<span>{line}</span>
									</li>
								))}
							</ul>
						</article>
						<article className={`${styles.card} ${styles.cardStrong}`}>
							<span className={styles.pillOk}>With Arqueo</span>
							<h3>Rules the account enforces</h3>
							<ul className={styles.bullets}>
								{WITH_ARQUEO.map((line) => (
									<li key={line}>
										<Icon name="check" className={styles.iconOk} />
										<span>{line}</span>
									</li>
								))}
							</ul>
						</article>
					</div>
				</section>

				<section id="safeguards" className={styles.safeguards} aria-labelledby="safeguards-title">
					<div className={styles.sectionHead}>
						<h2 id="safeguards-title">What the account checks</h2>
						<p>Demo defaults. The admin can change every limit and supplier.</p>
					</div>

					<div className={styles.bento}>
						<article className={`${styles.card} ${styles.span7}`}>
							<h3 className={styles.ruleHead}>
								<Icon name="ruleDestinations" className={styles.ruleIcon} />
								Allowlisted suppliers only
							</h3>
							<p>Payments go only to suppliers the admin has added. Anything else is refused.</p>
							<div className={styles.console}>
								<div className={styles.consoleHead}>
									<span>Destination</span>
									<span>Check</span>
								</div>
								<div className={styles.consoleRow}>
									<span className={styles.dotOk}>Supplier 1</span>
									<span className={styles.okText}>ALLOWLISTED</span>
								</div>
								<div className={styles.consoleRow}>
									<span className={styles.dotNo}>Unknown account</span>
									<span className={styles.noText}>NOT IN LIST</span>
								</div>
							</div>
						</article>

						<article className={`${styles.card} ${styles.span5}`}>
							<h3 className={styles.ruleHead}>
								<Icon name="ruleVolume" className={styles.ruleIcon} />
								Per-payment and 30-day limits
							</h3>
							<p>The ordinary rule refuses anything above these.</p>
							<div className={styles.thresholds}>
								<div>
									<span>Per payment</span>
									<span className={styles.pillDark}>500 XLM</span>
								</div>
								<div>
									<span>Per 30 days</span>
									<span className={styles.pillDark}>1,000 XLM</span>
								</div>
							</div>
						</article>

						<article className={`${styles.card} ${styles.span5}`}>
							<h3 className={styles.ruleHead}>
								<Icon name="ruleDualControl" className={styles.ruleIcon} />
								Second signature above the limit
							</h3>
							<p>Larger payments use the large rule, which needs the manager as well.</p>
							<div className={styles.thresholds}>
								<div>
									<span>Up to 500 XLM</span>
									<span className={styles.pillOk}>1 signature · Ordinary</span>
								</div>
								<div>
									<span>Above 500 XLM</span>
									<span className={styles.pillDark}>2 of 2 · Large</span>
								</div>
							</div>
						</article>

						<article className={`${styles.card} ${styles.span7}`}>
							<h3 className={styles.ruleHead}>
								<Icon name="ruleRefusals" className={styles.ruleIcon} />
								Refused attempts are on the record
							</h3>
							<p>Each refusal is logged with its reason, so the auditor sees what was stopped.</p>
							<div className={styles.console}>
								<div className={styles.consoleLine}>// Simulated against account rules</div>
								<div className={styles.consoleLine}>RULE: ordinary</div>
								<div className={styles.consoleLine}>
									STATUS: <span className={styles.noText}>REFUSED BEFORE SUBMISSION</span>
								</div>
								<div className={styles.consoleLine}>
									REASON: &quot;Amount exceeds the per-payment limit: manager approval required&quot;
								</div>
							</div>
						</article>
					</div>
				</section>

				<section id="roles" className={styles.roles} aria-labelledby="roles-title">
					<OrbitSystem variant="roles" className={styles.orbitBg} x="80%" y="22%" />
					<div className={styles.sectionHead}>
						<h2 id="roles-title">Who does what</h2>
					</div>
					<div className={styles.roleGrid} aria-label="Roles">
						{ROLES.map(({ role, signs, icon, does }) => (
							<article key={role} className={styles.roleCard}>
								<div className={styles.roleIcon}>
									<Icon name={icon} />
								</div>
								<h3>{role}</h3>
								<p className={styles.signs}>Signs with {signs}</p>
								<p>{does}</p>
							</article>
						))}
					</div>
				</section>

				<section id="architecture" className={styles.architecture} aria-labelledby="arch-title">
					<div className={styles.sectionHead}>
						<h2 id="arch-title">What it is built on</h2>
					</div>
					<div className={styles.threeCols}>
						<article className={styles.card}>
							<Icon name="hub" className={styles.cardIcon} />
							<h3>Stellar Soroban</h3>
							<p>Rust contracts compiled to Wasm and run on Stellar testnet.</p>
						</article>
						<article className={styles.card}>
							<Icon name="shield" className={styles.cardIcon} />
							<h3>OpenZeppelin smart accounts</h3>
							<p>
								Context rules, signer thresholds and policies. Our{" "}
								<code>control-policy</code> contract adds the allowlist and the
								per-payment limit.
							</p>
						</article>
						<article className={styles.card}>
							<Icon name="key" className={styles.cardIcon} />
							<h3>Passkeys and Ed25519</h3>
							<p>
								Admin and manager sign with passkeys. The employee&rsquo;s Ed25519
								key lives in the browser, a shortcut for the demo only.
							</p>
						</article>
					</div>

					<ol className={styles.flow} aria-label="What happens when someone pays">
						{STEPS.map((step) => (
							<li key={step.title}>
								<Icon name={step.icon} className={styles.flowIcon} />
								<h3>{step.title}</h3>
								<p>{step.body}</p>
							</li>
						))}
					</ol>

						{/*<aside className={styles.testnet} aria-labelledby="testnet-title">
						<Icon name="warning" className={styles.iconWarn} />
						<div>
							<h3 id="testnet-title">Testnet only</h3>
							<p>
								This demo uses test XLM with no real value. In production every
								person signs with a passkey on their own device.
							</p>
						</div>
					</aside>*/}
				</section>

				<section className={styles.close} aria-labelledby="close-title">
					<OrbitRings />
					<div className={styles.closePanel}>
						<div className={styles.closeCopy}>
							<h2 id="close-title">Try the rules yourself, on testnet.</h2>
							<p>Four scenes, test XLM, no real funds.</p>
							<div className={styles.closeActions}>
								<Link to="/app" className={styles.closeAction}>
									Launch Demo (Testnet)
									<Icon name="arrow" className={styles.inlineIcon} />
								</Link>
								<a href={REPO_URL} target="_blank" rel="noreferrer" className={styles.closeGhost}>
									Read the source
									<Icon name="code" className={styles.inlineIcon} />
								</a>
							</div>
						</div>

						<ol className={styles.scenes} aria-label="The four demo scenes">
							{SCENES.map((scene) => (
								<li key={scene.title}>
									<span className={styles.sceneIcon}>
										<Icon name={scene.icon} />
									</span>
									<div className={styles.sceneText}>
										<h3>{scene.title}</h3>
										<p>{scene.body}</p>
									</div>
									<span
										className={
											scene.tone === "ok"
												? styles.pillOk
												: scene.tone === "no"
													? styles.pillError
													: styles.pillDark
										}
									>
										{scene.tag}
									</span>
								</li>
							))}
						</ol>
					</div>
				</section>
			</main>

			<SiteFooter docsHref="#architecture" />
		</div>
	)
}
