import { networkStatus } from "@stellar-scaffold/app-lib"
import React from "react"
import { useWallet } from "../hooks/useWallet"

const NetworkPill: React.FC = () => {
	const { networkPassphrase, address } = useWallet()
	const { appNetwork, state, title } = networkStatus(address, networkPassphrase)

	// Only speak up when something is wrong: a matching network needs no badge.
	if (state !== "mismatch" && state !== "unverified") return null

	return (
		<div
			className={`network-pill network-pill--${state}`}
			title={title}
		>
			<span className={`network-dot network-dot--${state}`} />
			{appNetwork}
		</div>
	)
}

export default NetworkPill
