import { labPrefix } from "@stellar-scaffold/app-lib"
import { NavLink, Outlet, Route, Routes } from "react-router-dom"
import styles from "./App.module.css"
import { BrandOrbit } from "./components/BrandOrbit"
import ConnectAccount from "./components/ConnectAccount"
import { SiteHeader } from "./components/SiteHeader"
import Debug from "./pages/Debug"
import Home from "./pages/Home"
import Landing from "./pages/Landing"
import Auditor from "./pages/Auditor"

function App() {
	return (
		<Routes>
			<Route path="/" element={<Landing />} />
			<Route path="/auditor" element={<Auditor />} />
			<Route element={<AppLayout />}>
				<Route path="/app" element={<Home />} />
				<Route path="/debug" element={<Debug />} />
				<Route path="/debug/:contractName" element={<Debug />} />
			</Route>
		</Routes>
	)
}

const AppLayout = () => (
	<div className={styles.AppLayout}>
		<BrandOrbit />
		<SiteHeader wallet={<ConnectAccount />} />

		<main className={styles.main}>
			<Outlet />
		</main>

		<footer className={styles.footer}>
			<nav className={styles.footerNav}>
				<NavLink
					to="/debug"
					className={({ isActive }) => (isActive ? styles.active : "")}
				>
					Contract Explorer
				</NavLink>
				<a href={labPrefix()} target="_blank" rel="noreferrer">
					Transaction Explorer
				</a>
				<a
					href="https://github.com/stellar-scaffold/cli"
					target="_blank"
					rel="noreferrer"
				>
					GitHub
				</a>
				<a
					href="https://www.youtube.com/watch?v=0syGaIn3ULk&list=PLmr3tp_7-7Gjj6gn5-bBn-QTMyaWzwOU5"
					target="_blank"
					rel="noreferrer"
				>
					Tutorial
				</a>
				<a href="https://scaffoldstellar.org" target="_blank" rel="noreferrer">
					View docs
				</a>
			</nav>
		</footer>
	</div>
)

export default App
