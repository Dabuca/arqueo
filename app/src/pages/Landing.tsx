import {
	ArrowRight,
	ArrowUpRight,
	Check,
	Clock3,
	FileCheck2,
	KeyRound,
	ShieldCheck,
	Store,
	UserRound,
	Users,
	X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import orbitMark from "../styles/arqueo-orbit.webp"
import styles from "./Landing.module.css"
import { LandingHero } from "./LandingHero"

const REPO_URL = "https://github.com/Dabuca/arqueo"
const PAYMENT = {
	supplier: "Meridian Studio",
	invoice: "MS–1042",
	amount: 800,
	limit: 500,
}
const PERIOD_CAP = 1000
const ORDINARY_PAYMENTS = [
	{ supplier: "Atlas Hosting", concept: "Infrastructure", amount: 80, day: 5 },
	{ supplier: "Forma Supply", concept: "Materials", amount: 140, day: 13 },
	{
		supplier: "Meridian Studio",
		concept: "Design services",
		amount: 100,
		day: 21,
	},
]

const CHART_BOTTOM = 144
const CHART_TOP = 16
const CHART_END = 598
const SPENDING_POINTS = ORDINARY_PAYMENTS.map((payment, index) => {
	const cumulative = ORDINARY_PAYMENTS.slice(0, index + 1).reduce(
		(total, item) => total + item.amount,
		0,
	)
	return {
		...payment,
		cumulative,
		x: 2 + ((payment.day - 1) / 29) * (CHART_END - 2),
		y: CHART_BOTTOM - (cumulative / PERIOD_CAP) * (CHART_BOTTOM - CHART_TOP),
	}
})
const SPENDING_LINE = `M2 ${CHART_BOTTOM}${SPENDING_POINTS.map(({ x, y }) => `H${x}V${y}`).join("")}H${CHART_END}`

const ROLES = [
	{
		title: "Admin",
		icon: KeyRound,
		description: "Sets spending limits, authorized suppliers, and signers.",
	},
	{
		title: "Employee",
		icon: UserRound,
		description: "Signs ordinary payments to approved suppliers.",
	},
	{
		title: "Manager",
		icon: ShieldCheck,
		description:
			"Co-signs payments that exceed the employee’s spending limits.",
	},
	{
		title: "Auditor",
		icon: FileCheck2,
		description:
			"Reviews settled payments and refused attempts, and exports CSV.",
	},
]

function formatUsdc(amount: number) {
	return `${amount.toLocaleString("en-US")} USDC`
}

function AccountControls() {
	return (
		<section
			id="safeguards"
			className={`${styles.wrap} ${styles.section}`}
			aria-labelledby="controls-title"
		>
			<header className={styles.sectionHead}>
				<div>
					<p className={styles.eyebrow}>Account controls</p>
					<h2 id="controls-title">Rules the account enforces</h2>
				</div>
			</header>
			<div className={styles.featureGrid}>
				<article className={`${styles.feature} ${styles.featureSuppliers}`}>
					<div className={styles.featureCopy}>
						<Store size={20} aria-hidden="true" />
						<h3>Approved suppliers</h3>
						<p>Payments can only go to addresses the admin has approved.</p>
					</div>
					<div className={styles.featureVisual} aria-hidden="true">
						<div className={styles.sampleRows}>
							<div>
								<span>{PAYMENT.supplier}</span>
								<span>
									<Check size={14} /> Allowed
								</span>
							</div>
							<div>
								<span>Unknown address</span>
								<span className={styles.refused}>
									<X size={14} /> Refused
								</span>
							</div>
						</div>
					</div>
				</article>
				<article className={`${styles.feature} ${styles.featureLimits}`}>
					<div className={styles.featureCopy}>
						<Clock3 size={20} aria-hidden="true" />
						<h3>Spending limits</h3>
						<p>
							The ordinary rule checks each payment and cumulative spending.
							These are the demo defaults.
						</p>
					</div>
					<div className={styles.featureVisual}>
						<div className={styles.limitTicks} aria-hidden="true">
							<span />
							<span />
							<span />
							<span />
							<span />
							<span />
							<span />
							<span />
						</div>
						<dl className={styles.limitSample}>
							<div>
								<dt>Per payment</dt>
								<dd>
									{PAYMENT.limit} <span>USDC</span>
								</dd>
							</div>
							<div>
								<dt>30-day cap</dt>
								<dd>
									{PERIOD_CAP.toLocaleString("en-US")} <span>USDC</span>
								</dd>
							</div>
						</dl>
					</div>
				</article>
				<article className={`${styles.feature} ${styles.featureApproval}`}>
					<div className={styles.featureCopy}>
						<Users size={20} aria-hidden="true" />
						<h3>Two-person approval</h3>
						<p>
							When a payment exceeds the employee’s limit, the manager must
							co-sign.
						</p>
					</div>
					<div className={styles.featureVisual}>
						<div className={styles.approvalSample} aria-hidden="true">
							<span>Employee</span>
							<span>+</span>
							<span>Manager</span>
						</div>
					</div>
				</article>
				<article className={`${styles.feature} ${styles.featureAudit}`}>
					<div className={styles.featureCopy}>
						<FileCheck2 size={20} aria-hidden="true" />
						<h3>Audit trail</h3>
						<p>
							Export settled payments and refused attempts as CSV, with the
							evidence for each outcome.
						</p>
					</div>
					<div className={styles.featureVisual} aria-hidden="true">
						<div className={styles.sampleRows}>
							<div>
								<span>Settled</span>
								<span>Stellar transaction</span>
							</div>
							<div>
								<span>Refused</span>
								<span>Reason recorded</span>
							</div>
						</div>
					</div>
				</article>
			</div>
			<div id="roles" className={styles.roles}>
				<h3>Who can do what</h3>
				<dl>
					{ROLES.map(({ title, description, icon: Icon }) => (
						<div key={title}>
							<dt>
								<Icon size={16} aria-hidden="true" /> {title}
							</dt>
							<dd>{description}</dd>
						</div>
					))}
				</dl>
			</div>
		</section>
	)
}

function TreasuryActivity() {
	const chartRef = useRef<SVGSVGElement>(null)
	const [draw, setDraw] = useState(false)
	const [selectedDay, setSelectedDay] = useState(21)
	const spent = SPENDING_POINTS.reduce(
		(total, point) => total + point.amount,
		0,
	)
	const current = SPENDING_POINTS.find(({ day }) => day === selectedDay)

	useEffect(() => {
		const chart = chartRef.current
		if (!chart || !("IntersectionObserver" in window)) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					setDraw(true)
					observer.disconnect()
				}
			},
			{ threshold: 0.3 },
		)
		observer.observe(chart)
		return () => observer.disconnect()
	}, [])

	return (
		<section
			id="activity"
			className={`${styles.wrap} ${styles.section}`}
			aria-labelledby="activity-title"
		>
			<header className={styles.sectionHead}>
				<div>
					<p className={styles.eyebrow}>Treasury activity</p>
					<h2 id="activity-title">Ordinary spending</h2>
				</div>
				<span className={styles.meta}>Sample data</span>
			</header>
			<div className={styles.activityGrid} data-draw={draw}>
				<figure className={`${styles.surface} ${styles.chartSurface}`}>
					<figcaption className={styles.chartHead}>
						<div>
							<span className={styles.meta}>Spent this period</span>
							<strong>{formatUsdc(spent)}</strong>
						</div>
						<span className={styles.chartCap}>
							{formatUsdc(PERIOD_CAP)} cap
						</span>
					</figcaption>
					<svg
						ref={chartRef}
						className={styles.chart}
						viewBox="0 0 600 160"
						role="img"
						aria-label={`Three ordinary payments increased spending to ${formatUsdc(spent)} of a ${formatUsdc(PERIOD_CAP)} cap.`}
					>
						<defs>
							<linearGradient
								id="landing-spend-glow"
								x2="0"
								y2="1"
								gradientUnits="objectBoundingBox"
							>
								<stop stopColor="#e5aa52" stopOpacity=".27" />
								<stop offset="1" stopColor="#e5aa52" stopOpacity="0" />
							</linearGradient>
							<pattern
								id="landing-spend-hatch"
								width="7"
								height="7"
								patternUnits="userSpaceOnUse"
							>
								<path
									d="M-2 2L2 -2M0 7L7 0M5 9L9 5"
									stroke="#645441"
									strokeWidth=".8"
								/>
							</pattern>
						</defs>
						<path d="M2 16H598" stroke="#8a8170" strokeDasharray="4 6" />
						<path d="M2 48H598M2 80H598M2 112H598M2 144H598" stroke="#353535" />
						<g className={styles.chartFill}>
							<path
								d={`${SPENDING_LINE}V${CHART_BOTTOM}Z`}
								fill="url(#landing-spend-glow)"
							/>
							<path
								d={`${SPENDING_LINE}V${CHART_BOTTOM}Z`}
								fill="url(#landing-spend-hatch)"
							/>
						</g>
						<path
							className={styles.spendLine}
							pathLength="1"
							d={SPENDING_LINE}
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						/>
						{current && (
							<g key={current.day} className={styles.chartSelection}>
								<path
									d={`M${current.x} ${CHART_TOP}V${CHART_BOTTOM}`}
									stroke="#d6a15a"
									opacity=".45"
									strokeDasharray="3 4"
								/>
								<circle
									cx={current.x}
									cy={current.y}
									r="9"
									className={styles.pointHalo}
								/>
								<circle
									cx={current.x}
									cy={current.y}
									r="4"
									className={styles.chartPoint}
								/>
							</g>
						)}
					</svg>
					<div className={styles.chartLabels}>
						<span>Day 1</span>
						<span>{formatUsdc(PERIOD_CAP - spent)} remaining</span>
						<span>Day 30</span>
					</div>
				</figure>
				<article className={`${styles.surface} ${styles.ledgerSurface}`}>
					<h3>Ordinary payments</h3>
					<ul className={styles.ledger}>
						{SPENDING_POINTS.slice()
							.reverse()
							.map(({ supplier, concept, amount, day }) => (
								<li key={supplier}>
									<button
										type="button"
										aria-pressed={day === selectedDay}
										onClick={() => setSelectedDay(day)}
									>
										<span className={styles.ledgerDay}>
											<small>DAY</small>
											{day}
										</span>
										<span>
											{supplier}
											<small>{concept}</small>
										</span>
										<span>{formatUsdc(amount)}</span>
									</button>
								</li>
							))}
					</ul>
					{current && (
						<p className={styles.chartReadout} role="status">
							Day {current.day} · {formatUsdc(current.cumulative)} spent by this
							point
						</p>
					)}
				</article>
			</div>
		</section>
	)
}

export default function Landing() {
	const [approved, setApproved] = useState(false)

	return (
		<div className={styles.landing}>
			<a className={styles.skip} href="#main">
				Skip to content
			</a>
			<header className={`${styles.wrap} ${styles.header}`}>
				<Link to="/" className={styles.brand} aria-label="Arqueo home">
					<img src={orbitMark} alt="" width={36} height={36} />
					<span>Arqueo</span>
				</Link>
				<nav className={styles.nav} aria-label="Sections">
					<a href="#payment">Payment</a>
					<a href="#activity">Activity</a>
					<a href="#safeguards">Controls</a>
				</nav>
				<Link to="/app" className={styles.headerCta}>
					Open demo <ArrowUpRight size={15} aria-hidden="true" />
				</Link>
			</header>
			<main id="main" tabIndex={-1}>
				<div className={styles.stage}>
					<div className={styles.stageGrid} aria-hidden="true" />
					<LandingHero />
					<section
						id="payment"
						className={`${styles.wrap} ${styles.payment}`}
						aria-label="Interactive payment preview"
						data-approved={approved}
					>
						<div className={styles.panelBar}>
							<p>
								<span className={styles.wordmark}>Arqueo</span>{" "}
								<span className={styles.meta}>/ Treasury</span>
							</p>
							<span className={styles.previewLabel}>Simulated preview</span>
						</div>
						<div className={styles.paymentGrid}>
							<article className={`${styles.surface} ${styles.paymentReceipt}`}>
								<h2>Supplier payment</h2>
								<p className={styles.amount}>
									{PAYMENT.amount} <span>USDC</span>
								</p>
								<p>{PAYMENT.supplier}</p>
								<dl className={styles.details}>
									<div>
										<dt>Invoice</dt>
										<dd>{PAYMENT.invoice}</dd>
									</div>
									<div>
										<dt>Single-signer limit</dt>
										<dd>{formatUsdc(PAYMENT.limit)}</dd>
									</div>
								</dl>
							</article>
							<article
								className={`${styles.surface} ${styles.paymentApproval}`}
							>
								<div className={styles.approvalHead}>
									<h2>Payment approval</h2>
									<span className={styles.meta}>
										{approved ? "2 of 2" : "1 of 2"} signatures
									</span>
								</div>
								<ol className={styles.signers} aria-label="Required signers">
									<li data-signed="true">
										<span className={styles.signerNode} aria-hidden="true">
											<Check size={12} />
										</span>
										<span>
											Employee<small>Signed</small>
										</span>
									</li>
									<li data-signed={approved}>
										<span className={styles.signerNode} aria-hidden="true">
											{approved && <Check size={12} />}
										</span>
										<span>
											Manager<small>{approved ? "Signed" : "Pending"}</small>
										</span>
									</li>
								</ol>
								<p className={styles.feedback} role="status">
									{approved
										? "Both signatures collected. Payment authorized."
										: "Manager signature required."}
								</p>
								<button
									type="button"
									className={styles.button}
									onClick={() => setApproved((signed) => !signed)}
								>
									{approved ? "Reset preview" : "Preview second signature"}
								</button>
							</article>
						</div>
					</section>
				</div>
				<TreasuryActivity />
				<AccountControls />
				<section
					id="architecture"
					className={`${styles.wrap} ${styles.close}`}
					aria-labelledby="close-title"
				>
					<div className={styles.closeArt} aria-hidden="true" />
					<div className={styles.closeCopy}>
						<p className={styles.eyebrow}>Stellar testnet only</p>
						<h2 id="close-title">
							Put the rules
							<br />
							to the test.
						</h2>
						<p className={styles.lead}>
							Test the payment rules and review the audit log. Arqueo uses
							OpenZeppelin smart accounts on Stellar Soroban.
						</p>
						<div className={styles.closeActions}>
							<Link to="/app" className={styles.button}>
								Open testnet demo <ArrowRight size={18} aria-hidden="true" />
							</Link>
							<a
								href={`${REPO_URL}/blob/develop/docs/architecture.md`}
								className={styles.heroLink}
							>
								Read the architecture docs{" "}
								<ArrowUpRight size={15} aria-hidden="true" />
							</a>
						</div>
					</div>
				</section>
			</main>
			<footer className={`${styles.wrap} ${styles.footer}`}>
				<p>Built by Maker-Checker for HackMeridian 2026.</p>
				<a href={REPO_URL} target="_blank" rel="noreferrer">
					Source code <ArrowUpRight size={14} aria-hidden="true" />
				</a>
			</footer>
		</div>
	)
}
