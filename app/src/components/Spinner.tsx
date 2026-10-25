import { LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import ui from "../styles/ui.module.css"

// Busy indicator for buttons waiting on the chain or a passkey prompt.
export function Spinner() {
	return <LoaderCircle className={ui.spinner} size={16} strokeWidth={2} aria-hidden="true" />
}

// True from the first change of `value` on, so a state can animate when it flips but not on first render.
export function useChanged(value: unknown): boolean {
	const previous = useRef(value)
	const [changed, setChanged] = useState(false)

	useEffect(() => {
		if (previous.current !== value) {
			previous.current = value
			setChanged(true)
		}
	}, [value])

	return changed
}
