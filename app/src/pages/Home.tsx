import React from "react"
import { CompanyBalance } from "../components/CompanyBalance"
import ui from "../styles/ui.module.css"
import styles from "./Home.module.css"
import PaymentScreen from "./PaymentScreen"

const Home: React.FC = () => (
	<div className={styles.Home}>
		<header className={ui.pageHead}>
			<h1>Treasury</h1>
			<p>
				Create the company account, then send payments the account checks
				against its own rules. Everything here runs on Stellar testnet.
			</p>
		</header>

		<CompanyBalance />

		<PaymentScreen />
	</div>
)

export default Home
