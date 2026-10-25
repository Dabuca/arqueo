import { useState } from "react"
import { Link } from "react-router-dom"
// Logo assets derived from the brand files arqueo1.jpeg and arqueo2.jpeg:
// the symbol with a cream ground, the wordmark cut out to alpha.
import symbol from "../images/arqueo-symbol.jpg"
import wordmark from "../images/arqueo-wordmark.png"
import styles from "./Landing.module.css"

// TODO(R10): set the public demo video URL (YouTube or Loom embed) when it is recorded.
const VIDEO_EMBED_URL = ""
const REPO_URL = "https://github.com/Dabuca/arqueo"

// One illustrative payment, run through the ordinary rule in the account.
const PAYMENT = {
	amount: "2,000.00",
	to: "Supplier 2",
	signers: "employee",
	rule: "Ordinary",
	checks: [
		{ label: "Supplier is on the allowlist", passed: true },
		{ label: "2,000 is over the 500 per-payment maximum", passed: false },
		{ label: "1 of 1 signatures", passed: true },
	],
	reason: "Over the per-payment limit: manager approval required",
}

const TODAY = [
	["Who can move funds", "Whoever holds the key", "Only signers a rule allows"],
	[
		"Approvals",
		"A message in a group chat",
		"A second signature the account requires",
	],
	[
		"Evidence",
		"Screenshots for the auditor",
		"Every attempt logged, with its transaction",
	],
]

const ROLES = [
	["Admin", "Passkey", "Creates the account, rules, signers and suppliers"],
	["Employee", "Ed25519 key", "Makes ordinary payments"],
	["Manager", "Passkey", "Adds the second signature on large payments"],
	["Auditor", "Nothing, read only", "Sees every payment and exports a CSV"],
]

const RULES = [
	["Admin", "Admin", "None: every signer must sign"],
	[
		"Ordinary",
		"Employee",
		"Allowlisted suppliers, 500 XLM per payment, 1,000 XLM every 30 days",
	],
	["Large", "Employee and manager", "Allowlisted suppliers, 2 of 2 signatures"],
]

const STEPS = [
	{
		title: "Someone asks to pay",
		body: "The employee enters supplier, amount and concept. Who signs decides the rule: the employee alone uses Ordinary, employee and manager use Large.",
	},
	{
		title: "The account checks its rules",
		body: "The transaction is simulated against the smart account: supplier allowlist, per-payment limit, 30-day spending limit and signature threshold.",
	},
	{
		title: "A failed rule stops the payment",
		body: "The attempt is logged with the reason. If someone sent it anyway, the Stellar network would reject it, because the rules live in the account.",
	},
	{
		title: "A passing payment settles on Stellar",
		body: "It is signed and submitted to testnet, and the transaction hash links to stellar.expert.",
	},
	{
		title: "The auditor reads the journal",
		body: "Every payment and every rejected attempt, with signers and rule, ready to download as CSV.",
	},
]

function Arrow({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 16 16"
			width="16"
			height="16"
			aria-hidden="true"
		>
			<path d="M3 8h10M9 4l4 4-4 4" />
		</svg>
	)
}

function Mark({ passed }: { passed: boolean }) {
	return (
		<svg
			className={styles.mark}
			viewBox="0 0 16 16"
			width="16"
			height="16"
			aria-hidden="true"
		>
			{passed ? (
				<path d="M3 8.5 6.5 12 13 4.5" />
			) : (
				<path d="M4 4l8 8M12 4l-8 8" />
			)}
		</svg>
	)
}

function MenuIcon({ open }: { open: boolean }) {
	return (
		<svg
			className={styles.icon}
			viewBox="0 0 24 24"
			width="24"
			height="24"
			aria-hidden="true"
		>
			{open ? (
				<path d="M18 6 6 18M6 6l12 12" />
			) : (
				<path d="M4 6h16M4 12h16M4 18h16" />
			)}
		</svg>
	)
}

function Header() {
	const [menuOpen, setMenuOpen] = useState(false)
	const closeMenu = () => setMenuOpen(false)

	return (
		<header className={styles.header}>
			<div className={styles.headerBar}>
				<Link to="/" className={styles.brand} aria-label="Arqueo home">
					<img
						src={symbol}
						alt=""
						width={52}
						height={52}
						className={styles.symbol}
					/>
					<span
						role="img"
						aria-label="Arqueo"
						className={styles.wordmark}
						style={{
							WebkitMaskImage: `url(${wordmark})`,
							maskImage: `url(${wordmark})`,
						}}
					/>
				</Link>

				<nav className={styles.links} aria-label="Sections">
					<a href="#controls" className={styles.link}>
						Controls
					</a>
					<a href="#how" className={styles.link}>
						How it works
					</a>
					<a href="#video" className={styles.link}>
						Demo video
					</a>
				</nav>

				<div className={styles.headerActions}>
					<Link to="/app" className={styles.solid}>
						Open the testnet demo
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
					<MenuIcon open={menuOpen} />
				</button>
			</div>

			{menuOpen && (
				<div id="mobile-menu" className={styles.mobilePanel}>
					<a href="#controls" className={styles.mobileLink} onClick={closeMenu}>
						Controls
					</a>
					<a href="#how" className={styles.mobileLink} onClick={closeMenu}>
						How it works
					</a>
					<a href="#video" className={styles.mobileLink} onClick={closeMenu}>
						Demo video
					</a>
					<div className={styles.mobileActions}>
						<Link to="/app" className={styles.solid} onClick={closeMenu}>
							Open the testnet demo
						</Link>
					</div>
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
					<div className={styles.pitch}>
						<a className={styles.badge} href="#how">
							<span className={styles.badgeTag}>TESTNET</span>
							<span>Built on Stellar, testnet only</span>
							<span className={styles.badgeRule} />
							<Arrow className={styles.badgeArrow} />
						</a>
						<h1>Payment rules the account enforces.</h1>
						<p className={styles.lead}>
							Arqueo turns your approval matrix into rules on a Stellar smart
							account. A payment that breaks them cannot be made, and every
							attempt leaves a record your auditor can check.
						</p>
						<div className={styles.actions}>
							<a href="#video" className={styles.outline}>
								Watch the demo video
							</a>
							<Link to="/app" className={styles.primary}>
								Open the testnet demo
								<Arrow className={styles.buttonArrow} />
							</Link>
						</div>
					</div>

					<div className={styles.stage}>
						<div className={styles.glow} aria-hidden="true" />
						<figure
							className={styles.payment}
							aria-label="Illustrative payment check"
						>
							<figcaption className={styles.paymentHead}>
								<span>Pay {PAYMENT.amount} XLM</span>
								<span>Illustrative</span>
							</figcaption>
							<p className={styles.paymentMeta}>
								To {PAYMENT.to} · Signed by {PAYMENT.signers} · Rule{" "}
								{PAYMENT.rule}
							</p>
							<ul className={styles.checks}>
								{PAYMENT.checks.map((check) => (
									<li
										key={check.label}
										className={check.passed ? undefined : styles.failed}
									>
										<Mark passed={check.passed} />
										<span>{check.label}</span>
									</li>
								))}
							</ul>
							<p className={styles.verdict}>
								<strong>Refused</strong>
								<span>{PAYMENT.reason}</span>
							</p>
						</figure>
					</div>
				</section>

				<section className={styles.problem} aria-labelledby="problem-title">
					<h2 id="problem-title">One key should not move all the money.</h2>
					<p>
						In most small treasuries one person holds the key, approvals happen
						in a chat and the auditor receives screenshots. Arqueo moves the
						approval matrix into the account, where it is enforced.
					</p>
					<table className={styles.compare}>
						<caption className={styles.srOnly}>
							Treasury controls today and with Arqueo
						</caption>
						<thead>
							<tr>
								<th scope="col" />
								<th scope="col">Today</th>
								<th scope="col">With Arqueo</th>
							</tr>
						</thead>
						<tbody>
							{TODAY.map(([area, today, withArqueo]) => (
								<tr key={area}>
									<th scope="row">{area}</th>
									<td>{today}</td>
									<td>{withArqueo}</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>

				<section
					id="controls"
					className={styles.controls}
					aria-labelledby="controls-title"
				>
					<h2 id="controls-title">
						The authorization matrix, as account rules
					</h2>
					<div className={styles.tiles} aria-label="Roles">
						{ROLES.map(([role, signs, does]) => (
							<article key={role} className={styles.tile}>
								<h3>{role}</h3>
								<p className={styles.signs}>Signs with {signs}</p>
								<p>{does}</p>
							</article>
						))}
					</div>
					<div className={styles.tiles} aria-label="Rules">
						{RULES.map(([rule, signers, policies]) => (
							<article key={rule} className={styles.tile}>
								<h3>{rule} rule</h3>
								<p className={styles.signs}>Signers: {signers}</p>
								<p>{policies}</p>
							</article>
						))}
					</div>
				</section>

				<section id="how" className={styles.how} aria-labelledby="how-title">
					<h2 id="how-title">What happens when someone pays</h2>
					<ol className={styles.steps}>
						{STEPS.map((step) => (
							<li key={step.title}>
								<h3>{step.title}</h3>
								<p>{step.body}</p>
							</li>
						))}
					</ol>
					<p className={styles.stack}>
						Built with OpenZeppelin Stellar smart accounts and policies, a
						custom <code>control-policy</code> contract, Stellar&rsquo;s
						smart-account-kit and passkeys.
					</p>
				</section>

				<section
					id="video"
					className={styles.video}
					aria-labelledby="video-title"
				>
					<h2 id="video-title">See the four scenes</h2>
					{VIDEO_EMBED_URL ? (
						<iframe
							className={styles.player}
							src={VIDEO_EMBED_URL}
							title="Arqueo demo video"
							allow="fullscreen; picture-in-picture"
						/>
					) : (
						<div className={styles.pending}>
							<p>
								The demo video is on its way. Until then, run the four scenes
								yourself on testnet.
							</p>
							<Link to="/app" className={styles.primary}>
								Open the testnet demo
								<Arrow className={styles.buttonArrow} />
							</Link>
						</div>
					)}
				</section>

				<section className={styles.honest} aria-labelledby="honest-title">
					<h2 id="honest-title">Testnet only</h2>
					<p>
						This demo uses test XLM with no real value. To keep it quick, the
						employee&rsquo;s key lives in the browser. In production every
						person signs with a passkey on their own device.
					</p>
				</section>

				<section className={styles.close}>
					<div className={styles.closePanel}>
						<img
							src={symbol}
							alt=""
							width={150}
							height={150}
							className={styles.closeSymbol}
						/>
						<span
							role="img"
							aria-label="Arqueo"
							className={styles.closeWordmark}
							style={{
								WebkitMaskImage: `url(${wordmark})`,
								maskImage: `url(${wordmark})`,
							}}
						/>
						<Link to="/app" className={styles.closeAction}>
							Open the testnet demo
							<Arrow className={styles.buttonArrow} />
						</Link>
					</div>
				</section>
			</main>

			<footer className={styles.footer}>
				<p>Built for HackMeridian 2026 on Stellar testnet.</p>
				<a href={REPO_URL} target="_blank" rel="noreferrer">
					Source code on GitHub
				</a>
			</footer>
		</div>
	)
}
