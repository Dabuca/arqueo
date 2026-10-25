import { labPrefix } from "@stellar-scaffold/app-lib"
import React from "react"
import { Link } from "react-router-dom"
import { CompanyBalance } from "../components/CompanyBalance"
import { GuessTheNumber } from "../components/GuessTheNumber"
import styles from "./Home.module.css"
import PaymentScreen from "./PaymentScreen"

const Home: React.FC = () => (
	<div className={styles.Home}>
		<div className={styles.intro}>
			<h1>Your treasury, governed on Stellar.</h1>
			<p>
				Set up the company account and explore the smart contract tools behind
				Arqueo. This demo runs on Stellar testnet.{" "}
				<Link to="https://scaffoldstellar.org/docs/intro" target="_blank">
					View docs
				</Link>
			</p>
		</div>

		<div className={`card ${styles.treasury}`}>
			<h2>Treasury</h2>
			<CompanyBalance />
		</div>

		<PaymentScreen />

		<div className={`card ${styles.contracts}`}>
			<h2>Sample Contracts</h2>
			<p>
				<strong>Guess The Number:</strong> Interact with the sample contract
				from the{" "}
				<Link
					to="https://scaffoldstellar.org/docs/tutorial/overview"
					target="_blank"
				>
					Scaffold Tutorial
				</Link>{" "}
				using an automatically generated contract client.
			</p>
			<GuessTheNumber />
			<p>Or take a look at other sample contracts to get you started:</p>
			<nav className={styles.contractNav}>
				<a
					href="https://github.com/OpenZeppelin/stellar-contracts/tree/main/examples"
					target="_blank"
					rel="noreferrer"
				>
					OpenZeppelin sample contracts
				</a>
				<a
					href="https://github.com/stellar/soroban-examples"
					target="_blank"
					rel="noreferrer"
				>
					Soroban sample contracts
				</a>
			</nav>
		</div>

		<div className={`card ${styles.build}`}>
			<h2>Start Building</h2>
			<ol>
				<li>
					Add your contract under <code>/src/contracts</code>
				</li>
				<li>
					Contracts are built by Scaffold when you run <code>npm start</code>
				</li>
				<li>
					Changes are rebuilt automatically by <code>Vite</code>
				</li>
				<li>
					Interact with your contract immediately in the Contract Explorer
				</li>
			</ol>
			<p>
				Watch the full process in our{" "}
				<Link to="https://www.youtube.com/watch?v=86hWe8Ragtg&list=PLmr3tp_7-7Gjj6gn5-bBn-QTMyaWzwOU5&index=1">
					Youtube tutorial
				</Link>
				<br />
				Get inspired by our showcase of{" "}
				<Link to="https://scaffoldstellar.org/showcase">Example frontends</Link>
				<br />
				Ready to deploy?{" "}
				<Link to="https://developers.stellar.org/docs/tools/cli/install-cli">
					Read the mainnet deployment guide
				</Link>
			</p>
		</div>

		<section className={styles.tools} aria-label="Development tools">
			<div className={`card ${styles.tool}`}>
				<p>Review the read-only payment history in the <Link to="/auditor">Auditor journal</Link></p>
			</div>
			<div className={`card ${styles.tool}`}>
				<p>
					Invoke your smart contract using the{" "}
					<Link to="/debug">Contract Explorer</Link>
				</p>
			</div>
			<div className={`card ${styles.tool}`}>
				<p>
					Browse your local transactions with the{" "}
					<Link to={labPrefix()}>Transaction Explorer</Link>
				</p>
			</div>
		</section>
	</div>
)

export default Home
