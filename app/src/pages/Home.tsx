import React from "react"
import { CompanyBalance } from "../components/CompanyBalance"
import { SpendingChart } from "../components/SpendingChart"
import ui from "../styles/ui.module.css"
import styles from "./Home.module.css"
import PaymentScreen from "./PaymentScreen"

const Home: React.FC = () => (
	<div className={styles.Home}>
		<header className={ui.pageHead}>
			<h1>Treasury</h1>
			<p>Fund your company account and pay approved suppliers.</p>
		</header>

		<CompanyBalance />

		<PaymentScreen />

		<SpendingChart />
	</div>
)

export default Home
