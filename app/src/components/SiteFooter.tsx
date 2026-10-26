import styles from "./SiteFooter.module.css"

const REPO_URL = "https://github.com/Dabuca/arqueo"

// One footer for the landing and the app. The docs anchor is relative to the page it sits on.
export function SiteFooter({ docsHref = "/#architecture" }: { docsHref?: string }) {
	return (
		<footer className={styles.footer}>
			<div className={styles.inner}>
				<p>© 2026 Arqueo. Built by Maker-Checker for HackMeridian 2026.</p>
				<nav className={styles.nav} aria-label="Footer">
					<a href={docsHref}>Docs</a>
					<a href={REPO_URL} target="_blank" rel="noreferrer">
						Source code
					</a>
				</nav>
			</div>
		</footer>
	)
}
