# Branch cleanup — 30 Oct 2026

Local branch clutter removed after the hackathon submission, then the merged remote
branches pruned. Nothing with unreachable commits was deleted.

- Kept: `main`, `develop` (locally and on `origin`)
- Deleted locally: 16 branches
- Deleted on `origin`: 50 branches, all already merged into `origin/develop`
- Left on `origin`: 11 unmerged teammate branches and 5 Dependabot branches (open-PR risk)

## Local branches deleted

`Merged` says whether the tip was an ancestor of `origin/develop` and `origin/main` at
deletion time.

| Branch | Tip | Merged | Recoverable from |
|---|---|---|---|
| `a-b/R6-install-policy` | `a36cd4e` | yes | `origin/*` |
| `a/R5-control-policy` | `5381168` | yes | `origin/*` |
| `b/R2-scaffold-testnet` | `bf6dd8a` | yes | `origin/*` |
| `b/R20-manager-phone` | `4c2a70c` | yes | `origin/*` |
| `b/R24-landing` | `ddd2da6` | yes | `origin/*` |
| `b/R25-wallets` | `2c2cfd5` | yes | `origin/*` |
| `b/R3-company-account` | `0d751fd` | yes | `origin/*` |
| `b/R4-first-payment` | `0d6f831` | yes | `origin/*` |
| `b/R7-large-payment` | `8755a95` | yes | `origin/*` |
| `b/fix-sdk-16` | `68b7534` | yes | `origin/*` |
| `b/landing` | `3334921` | yes | `origin/*` |
| `c/R8-payment-screen` | `5381168` | yes | `origin/*` |
| `d/R1-docs-base` | `5381168` | yes | `origin/*` |
| `d/R17-settings-layout` | `b8d8917` | yes | `origin/*` |
| `feat/auth` | `5cd88df` | yes | `origin/*` |
| `backup/origin-main-before-reset` | `8753bda` | **no** | local reflog only |

## Remote branches deleted from `origin`

All 50 were ancestors of `origin/develop`, so every commit they pointed at is still
reachable from `develop`. Any of them can be recreated with `git branch <name> <sha>`:

| `a-b/R6-install-policy` | `e1b3c719` |
| `a-c/R12-details-and-policy-button` | `18c30126` |
| `a-c/R12-readable-errors` | `a84f8860` |
| `a/R12-readable-errors` | `96200c2a` |
| `a/R16-architecture-diagram` | `5eaff738` |
| `a/R22-cashout-demo` | `c16a850d` |
| `a/R5-control-policy` | `1674be86` |
| `a/R5-policy-hardening` | `e0cad712` |
| `a/fix-csv-negative-numbers` | `0cd73f75` |
| `b-c/R17-settings-screen` | `a84f8860` |
| `b/R14-demo-script` | `a84f8860` |
| `b/R14-demo-script-current` | `6c78a91f` |
| `b/R18-usdc` | `42e2e4b7` |
| `b/R2-scaffold-testnet` | `bf6dd8a5` |
| `b/R2-testnet` | `a84f8860` |
| `b/R20-manager-phone` | `4c2a70c4` |
| `b/R21-recovery-2-of-3` | `f4f3acdd` |
| `b/R3-company-account` | `0d751fdc` |
| `b/R4-first-payment` | `e6c4f086` |
| `b/R7-large-rule-button` | `f41d0dc6` |
| `b/landing` | `7c7399a2` |
| `c/R11-auditor-csv-final` | `70138aa3` |
| `c/R13-auditor-signers-rule` | `a84f8860` |
| `c/R15-publish-app` | `a84f8860` |
| `c/R17-settings-link` | `8ccc9a3c` |
| `c/R8-payment-screen` | `a84f8860` |
| `c/R8-unknown-supplier-prefill` | `c9f25e8d` |
| `c/R9-auditor-view` | `a84f8860` |
| `c/cap-message-format` | `6ec41489` |
| `c/fix-broken-characters` | `c14312f7` |
| `c/format-xlm-display` | `ad046144` |
| `c/format-xlm-usd` | `365b3f78` |
| `c/share-landing-preview` | `928246d8` |
| `d/R1-change-log` | `32d73111` |
| `d/R1-control-matrix` | `a84f8860` |
| `d/R1-controls-core` | `93c7cc24` |
| `d/R1-suppliers` | `1853000e` |
| `d/R10-submission-codex` | `7cf7e6d4` |
| `d/R13-auditor-signers-rule` | `94f6d837` |
| `d/R15-publish` | `22ae7a94` |
| `d/R17-settings` | `2df7e891` |
| `d/R17-settings-layout` | `b8d89174` |
| `d/R18-usdc` | `7fb5dff1` |
| `d/R19-ci-tests` | `16449711` |
| `d/R23-cap-left` | `cdf4a41f` |
| `docs/R17-verified` | `925f0c8a` |
| `docs/R23-cap-verified` | `e82ea1e0` |
| `docs/uncheck-R6-R12` | `03e012f8` |
| `feat/auth` | `5cd88df0` |
| `feat/pani` | `573cc704` |

## Remote branches left on `origin`

| Branch | Why it stays |
|---|---|
| `a/claude-skills-copies` | unmerged |
| `b/landing-evidence` | unmerged |
| `b/stellar-build-skills` | unmerged |
| `c/R11-auditor-csv` | unmerged |
| `d/R10-pitch-deck` | unmerged |
| `d/R10-submission` | unmerged |
| `d/R10-team-allocation` | unmerged |
| `d/R16-architecture-diagram` | unmerged |
| `d/R8-pay-button-fix` | unmerged |
| `d/agents-sync` | unmerged |
| `d/team-status` | unmerged |
| `dependabot/npm_and_yarn/dotenv-18.0.8` | unmerged, likely an open Dependabot PR |
| `dependabot/npm_and_yarn/lint-staged-17.6.0` | unmerged, likely an open Dependabot PR |
| `dependabot/npm_and_yarn/npm-minor-276ab44e4e` | unmerged, likely an open Dependabot PR |
| `dependabot/npm_and_yarn/simplewebauthn/browser-14.0.0` | unmerged, likely an open Dependabot PR |
| `dependabot/npm_and_yarn/typescript-7.0.2` | unmerged, likely an open Dependabot PR |

Deleting a remote branch closes any open PR that used it and makes the PR
unreopenable, so these were left alone. Review them with the GitHub UI before removing.

## Notes

- `backup/origin-main-before-reset` was force-deleted (`-D`). Its single commit
  `8753bda` ("Create README.md") was never pushed and is not part of `develop` or
  `main`. It is reachable only through the local reflog until git garbage-collects it:

  ```bash
  git branch backup/recover 8753bda
  ```

  Do that before `git gc` if the commit is ever needed.
- Restoring a deleted branch:

  ```bash
  git branch b/R7-large-payment 8755a95   # recreate a merged branch at its old tip
  git branch backup/recover 8753bda       # the unpushed backup commit
  ```

- Working tree changes (`app/src/App.tsx`, `.impeccable/`, `cursorcam-output/`) were not
  part of this operation.
