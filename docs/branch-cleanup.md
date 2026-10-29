# Branch cleanup — 30 Oct 2026

Local branch clutter removed after the hackathon submission. **Only local branches were
deleted; every `origin/*` branch is untouched.**

- Kept locally: `main`, `develop`
- Deleted locally: 16 branches
- Remote branches deleted: none

## Deleted branches

`Merged` says whether the tip was already an ancestor of `origin/develop` and `origin/main`
at deletion time.

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

## Notes

- The 15 merged tips are reachable from `origin/main` and `origin/develop`, so they can be
  recreated at any time with `git branch <name> <sha>`.
- `backup/origin-main-before-reset` was force-deleted (`-D`). Its single commit
  `8753bda` ("Create README.md") was never pushed and is not part of `develop` or `main`.
  It is reachable only through the local reflog until git garbage-collects it:

  ```bash
  git branch backup/recover 8753bda
  ```

  Do that before `git gc` if the commit is ever needed.
- Restoring a merged branch from the remote:

  ```bash
  git branch b/R7-large-payment origin/develop
  ```

- Working tree changes (`app/src/App.tsx`, `.impeccable/`, `cursorcam-output/`) were not
  part of this operation.
