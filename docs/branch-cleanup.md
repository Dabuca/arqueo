# Branch cleanup — 30 Oct 2026

Branch clutter removed after the hackathon submission, locally and on GitHub.

- Kept: `main`, `develop` (local and on `origin`)
- Deleted locally: 16 branches
- Deleted on `origin`: 66 branches — 2 heads remain (`main`, `develop`)
- Commit loss: none. Every tip, merged or not, is recorded below and pinned locally
  under `refs/backup/origin/`

## Local branches deleted

`Merged` says whether the tip was an ancestor of `origin/develop` and `origin/main` at
deletion time.

| Branch | Tip | Merged | Recoverable from |
|---|---|---|---|
| `a-b/R6-install-policy` | `a36cd4e` | yes | `origin/develop` |
| `a/R5-control-policy` | `5381168` | yes | `origin/develop` |
| `b/R2-scaffold-testnet` | `bf6dd8a` | yes | `origin/develop` |
| `b/R20-manager-phone` | `4c2a70c` | yes | `origin/develop` |
| `b/R24-landing` | `ddd2da6` | yes | `origin/develop` |
| `b/R25-wallets` | `2c2cfd5` | yes | `origin/develop` |
| `b/R3-company-account` | `0d751fd` | yes | `origin/develop` |
| `b/R4-first-payment` | `0d6f831` | yes | `origin/develop` |
| `b/R7-large-payment` | `8755a95` | yes | `origin/develop` |
| `b/fix-sdk-16` | `68b7534` | yes | `origin/develop` |
| `b/landing` | `3334921` | yes | `origin/develop` |
| `c/R8-payment-screen` | `5381168` | yes | `origin/develop` |
| `d/R1-docs-base` | `5381168` | yes | `origin/develop` |
| `d/R17-settings-layout` | `b8d8917` | yes | `origin/develop` |
| `feat/auth` | `5cd88df` | yes | `origin/develop` |
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

## Remote branches deleted from `origin` (unmerged)

These had commits that were **not** in `origin/develop`. Deleting them on GitHub closes
any PR they backed, so each tip is pinned in this clone first (see below).

| Branch | Tip | Local recovery ref |
|---|---|---|
| `a/claude-skills-copies` | `2a0292ebf5f313fab17f706e88b96e2aec883e97` | `refs/backup/origin/a/claude-skills-copies` |
| `b/landing-evidence` | `60e7959ce6e9f0b5335800060d6a38fb5a7d0b5c` | `refs/backup/origin/b/landing-evidence` |
| `b/stellar-build-skills` | `06d044102d08056cf515f566a8e7d6feb1e98bfd` | `refs/backup/origin/b/stellar-build-skills` |
| `c/R11-auditor-csv` | `ca6f631ae7a80380a9909182bd375c6ed6e51565` | `refs/backup/origin/c/R11-auditor-csv` |
| `d/R10-pitch-deck` | `04fa115e71509112e44144b2f854be0dd3ae0bf6` | `refs/backup/origin/d/R10-pitch-deck` |
| `d/R10-submission` | `07c021a921846292e5688bb8543979df6829a8fc` | `refs/backup/origin/d/R10-submission` |
| `d/R10-team-allocation` | `d94c54134da56b6989b5ea3c7ed7a0371b342d1d` | `refs/backup/origin/d/R10-team-allocation` |
| `d/R16-architecture-diagram` | `865d9e886bd67d3406a753ed60b1359f9a1c91db` | `refs/backup/origin/d/R16-architecture-diagram` |
| `d/R8-pay-button-fix` | `e59cdf5f62c434df1d4703dfc19bf889ae1a7757` | `refs/backup/origin/d/R8-pay-button-fix` |
| `d/agents-sync` | `e0e2e44022fd0c6b3b6a3c2853cb2d1ad4892166` | `refs/backup/origin/d/agents-sync` |
| `d/team-status` | `b2334b1569854b23e103d35adef5257fa937ec0a` | `refs/backup/origin/d/team-status` |
| `dependabot/npm_and_yarn/dotenv-18.0.8` | `21f34d0c4f997241843ee967b270d89ff0269f9e` | `refs/backup/origin/dependabot/npm_and_yarn/dotenv-18.0.8` |
| `dependabot/npm_and_yarn/lint-staged-17.6.0` | `5fb28084d2af44b989e901ec766353f39440f66a` | `refs/backup/origin/dependabot/npm_and_yarn/lint-staged-17.6.0` |
| `dependabot/npm_and_yarn/npm-minor-276ab44e4e` | `c1c8ed5beed4d9ccf04bdcbdba0941b400650fe1` | `refs/backup/origin/dependabot/npm_and_yarn/npm-minor-276ab44e4e` |
| `dependabot/npm_and_yarn/simplewebauthn/browser-14.0.0` | `92338801183ee67a0fff83da4bd521461f8b0f0c` | `refs/backup/origin/dependabot/npm_and_yarn/simplewebauthn/browser-14.0.0` |
| `dependabot/npm_and_yarn/typescript-7.0.2` | `7005bb83a68e39833775f33897bc307195c59aae` | `refs/backup/origin/dependabot/npm_and_yarn/typescript-7.0.2` |

Recover any of them into a normal branch:

```bash
git branch b/landing-evidence refs/backup/origin/b/landing-evidence
git push origin b/landing-evidence      # only if it should go back to GitHub
```

`refs/backup/*` is local only — it is not pushed, so it survives as long as this clone
exists (and is not affected by `git gc`).

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
