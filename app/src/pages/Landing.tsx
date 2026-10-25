import { Link } from "react-router-dom"
import { AuditTape } from "../components/AuditTape"
// Logo assets derived from the brand files arqueo1.jpeg and arqueo2.jpeg:
// the symbol recoloured to the page ground, the wordmark cut out to alpha.
import symbol from "../images/arqueo-symbol.jpg"
import wordmark from "../images/arqueo-wordmark.png"
import styles from "./Landing.module.css"

// TODO(R10): set the public demo video URL (YouTube or Loom embed) when it is recorded.
const VIDEO_EMBED_URL = ""
const REPO_URL = "https://github.com/Dabuca/arqueo"

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

export default function Landing() {
	return (
		<div className={styles.landing}>
			<a className={styles.skip} href="#main">
				Skip to content
			</a>
			<header className={styles.header}>
				<Link to="/" className={styles.brand} aria-label="Arqueo home">
					<img src={symbol} alt="" width={52} height={52} />
					<img
						src={wordmark}
						alt="Arqueo"
						width={110}
						height={18}
						className={styles.wordmark}
					/>
				</Link>
				<nav className={styles.nav} aria-label="Sections">
					<a href="#controls">Controls</a>
					<a href="#how">How it works</a>
					<a href="#video">Demo video</a>
				</nav>
				<Link to="/app" className={styles.headerAction}>
					Open the testnet demo
				</Link>
			</header>

			<main id="main">
				<section className={styles.hero}>
					<div className={styles.pitch}>
						<h1>Your payment policy, enforced by the account itself.</h1>
						<p className={styles.lead}>
							Arqueo turns your approval matrix into rules on a Stellar smart
							account. A payment that breaks them cannot be made, and every
							attempt leaves a record your auditor can check.
						</p>
						<div className={styles.actions}>
							<Link to="/app" className={styles.primary}>
								Open the testnet demo
							</Link>
							<a href="#video" className={styles.secondary}>
								Watch the demo video
							</a>
						</div>
						<p className={styles.fine}>
							For small companies, startups and associations that hold
							stablecoins. Built on Stellar testnet with OpenZeppelin smart
							accounts. The tape is illustrative: open a line to see the checks
							the account ran.
						</p>
					</div>
					<div className={styles.tape}>
						<AuditTape />
					</div>
				</section>

				<section className={styles.problem} aria-labelledby="problem-title">
					<h2 id="problem-title">One key should not move all the money.</h2>
					<p>
						In most small treasuries one person holds the key, approvals happen
						in a chat and the auditor receives screenshots. Arqueo moves the
						approval matrix into the account, where it is enforced.
					</p>
					<table className={styles.ledger}>
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
							<tr>
								<th scope="row">Who can move funds</th>
								<td>Whoever holds the key</td>
								<td>Only signers allowed by a rule</td>
							</tr>
							<tr>
								<th scope="row">Approvals</th>
								<td>A message in a group chat</td>
								<td>A second signature the account requires</td>
							</tr>
							<tr>
								<th scope="row">Evidence</th>
								<td>Screenshots for the auditor</td>
								<td>Every attempt logged, with its transaction</td>
							</tr>
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
					<div className={styles.tables}>
						<table className={styles.ledger}>
							<caption>Roles</caption>
							<thead>
								<tr>
									<th scope="col">Role</th>
									<th scope="col">Signs with</th>
									<th scope="col">Does</th>
								</tr>
							</thead>
							<tbody>
								{ROLES.map(([role, signs, does]) => (
									<tr key={role}>
										<th scope="row">{role}</th>
										<td>{signs}</td>
										<td>{does}</td>
									</tr>
								))}
							</tbody>
						</table>
						<table className={styles.ledger}>
							<caption>Rules</caption>
							<thead>
								<tr>
									<th scope="col">Rule</th>
									<th scope="col">Signers</th>
									<th scope="col">Policies</th>
								</tr>
							</thead>
							<tbody>
								{RULES.map(([rule, signers, policies]) => (
									<tr key={rule}>
										<th scope="row">{rule}</th>
										<td>{signers}</td>
										<td>{policies}</td>
									</tr>
								))}
							</tbody>
						</table>
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
					<img src={symbol} alt="" width={320} height={320} />
					<img
						src={wordmark}
						alt="Arqueo"
						width={360}
						height={60}
						className={styles.closeWordmark}
					/>
					<Link to="/app" className={styles.primary}>
						Open the testnet demo
					</Link>
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
