import { stellarNetwork } from "@stellar-scaffold/app-lib"
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit"
import { HotWalletModule } from "@creit.tech/stellar-wallets-kit/modules/hotwallet"
import { LedgerModule } from "@creit.tech/stellar-wallets-kit/modules/ledger"
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils"

// app-lib starts the kit with the default wallets when it is imported. On testnet and
// mainnet this adds Ledger and HOT Wallet on top. Trezor and WalletConnect are left out:
// they need an app email and a WalletConnect project id that the team has not chosen.
if (stellarNetwork !== "LOCAL" && stellarNetwork !== "FUTURENET") {
	StellarWalletsKit.init({
		modules: [...defaultModules(), new LedgerModule(), new HotWalletModule()],
	})
}
