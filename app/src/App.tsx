import { useLayoutEffect } from "react"
import {
	Outlet,
	Route,
	Routes,
	useLocation,
	useNavigationType,
} from "react-router-dom"
import styles from "./App.module.css"
import ConnectAccount from "./components/ConnectAccount"
import { SiteFooter } from "./components/SiteFooter"
import { SiteHeader } from "./components/SiteHeader"
import Auditor from "./pages/Auditor"
import CashOutPage from "./pages/CashOutPage"
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
				<Route path="/cashout" element={<CashOutPage />} />
				<Route path="/debug" element={<Debug />} />
				<Route path="/debug/:contractName" element={<Debug />} />
			</Route>
		</Routes>
	)
}

const AppLayout = () => {
	const { pathname } = useLocation()
	const navigationType = useNavigationType()

	// The router keeps the window scroll position across navigation, so going
	// from the landing (scrolled down) to /app would open mid-page. Reset it
	// before paint on new navigations; Back/Forward (POP) keeps the browser's
	// restored position.
	useLayoutEffect(() => {
		if (navigationType === "POP") return
		window.scrollTo({ top: 0, behavior: "instant" })
	}, [pathname, navigationType])

	return (
		<div className={styles.AppLayout}>
			<a className={styles.skip} href="#app-content">
				Skip to content
			</a>
			<SiteHeader wallet={<ConnectAccount />} />

			<main id="app-content" tabIndex={-1} className={styles.main}>
				<div key={pathname} className={styles.page}>
					<Outlet />
				</div>
			</main>

			<SiteFooter />
		</div>
	)
}

export default App
