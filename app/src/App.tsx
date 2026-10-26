import { Outlet, Route, Routes, useLocation } from "react-router-dom"
import styles from "./App.module.css"
import ConnectAccount from "./components/ConnectAccount"
import { OrbitSystem } from "./components/OrbitField"
import { SiteFooter } from "./components/SiteFooter"
import { SiteHeader } from "./components/SiteHeader"
import { TestnetBanner } from "./components/TestnetBanner"
import Auditor from "./pages/Auditor"
import Debug from "./pages/Debug"
import Home from "./pages/Home"
import Landing from "./pages/Landing"
import Settings from "./pages/Settings"

function App() {
	return (
		<Routes>
			<Route path="/" element={<Landing />} />
			<Route element={<AppLayout />}>
				<Route path="/app" element={<Home />} />
				<Route path="/auditor" element={<Auditor />} />
				<Route path="/settings" element={<Settings />} />
				<Route path="/debug" element={<Debug />} />
				<Route path="/debug/:contractName" element={<Debug />} />
			</Route>
		</Routes>
	)
}

const AppLayout = () => {
	const { pathname } = useLocation()

	return (
	<div className={styles.AppLayout}>
		{pathname === "/app" && (
			<OrbitSystem variant="roles" className={styles.orbitBg} x="84%" y="42vh" />
		)}
		<TestnetBanner />
		<SiteHeader wallet={<ConnectAccount />} />

		<main className={styles.main}>
			<div key={pathname} className={styles.route}>
				<Outlet />
			</div>
		</main>

		<SiteFooter />
	</div>
	)
}

export default App
