import styles from "./TestnetBanner.module.css"

export const TESTNET_NOTICE =
	"Test USDC with no real value. Do not use real funds."

export function TestnetBanner() {
	return (
		<div className={styles.banner} role="note">
			<strong>Testnet only</strong> · {TESTNET_NOTICE}
		</div>
	)
}
