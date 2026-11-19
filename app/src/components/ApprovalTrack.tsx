import { type ApprovalProgress } from "./approvalProgress"
import styles from "./ApprovalTrack.module.css"

type Props = {
	progress: ApprovalProgress
}

/**
 * Employee → manager signature track. The amber line runs to the pending
 * manager node when a second signature is needed and completes when the
 * manager signs. The text below carries the same state for assistive tech.
 */
export function ApprovalTrack({ progress }: Props) {
	const { signed, needed, state, message } = progress
	const managerState =
		signed === 2 ? "signed" : needed === 2 ? "pending" : "idle"

	return (
		<div className={styles.track} data-state={state} data-manager={managerState}>
			<div className={styles.head}>
				<span className={styles.title}>Payment approval</span>
				<span className={styles.count}>
					{signed} of {needed}
				</span>
			</div>
			<div className={styles.flow} aria-hidden="true">
				<span className={`${styles.node} ${styles.signed}`} />
				<span className={styles.line}>
					<span className={styles.fill} />
				</span>
				<span className={`${styles.node} ${styles.manager}`} />
			</div>
			<div className={styles.roles} aria-hidden="true">
				<span>Employee</span>
				<span>{managerState === "idle" ? "Manager · not needed" : "Manager"}</span>
			</div>
			<p className={styles.message}>{message}</p>
		</div>
	)
}
