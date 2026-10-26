import "@stellar-scaffold/app-lib"
import { Networks, StellarWalletsKit } from "@creit.tech/stellar-wallets-kit"
import { HotWalletModule } from "@creit.tech/stellar-wallets-kit/modules/hotwallet"
import { LedgerModule } from "@creit.tech/stellar-wallets-kit/modules/ledger"
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils"

// app-lib starts the kit from the network of its generated clients, which is the local one
// here, so it only offers three wallets. Restart it from the network the app really uses.
// Trezor and WalletConnect are left out: they need an app email and a WalletConnect
// project id that the team has not chosen.
const passphrase = import.meta.env.PUBLIC_NETWORK_PASSPHRASE

if (passphrase === Networks.TESTNET || passphrase === Networks.PUBLIC) {
	StellarWalletsKit.init({
		network: passphrase,
		modules: [...defaultModules(), new LedgerModule(), new HotWalletModule()],
	})
}
