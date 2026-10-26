# Publishing the app (R15)

The app is a static Vite build. `vercel.json` sets the build command, the output folder (`app/dist`) and a rewrite of every route to `index.html`, so `/app`, `/auditor` and `/settings` open directly. `app/.env.production` holds the public testnet addresses (no secrets), so no variables need to be set in the Vercel dashboard.

## Steps (needs the team's Vercel account)

1. In Vercel: **Add New → Project**, import `Dabuca/arqueo` (the repo is private; allow the GitHub integration to read it).
2. Production branch: `develop` (or `main` once merged). Leave the build settings: they come from `vercel.json`.
3. Deploy. Open `<url>/auditor` directly and check the **Testnet only** strip is visible.
4. Put the URL in the README header and in the form answers, then tick R15 in `AGENTS.md`.

Or from a terminal, once logged in: `npx vercel --prod`.

## Things to know

- Passkeys and the company account live in the browser of each visitor: on the published URL, create a new company account (the one made on localhost does not carry over).
- Record the final video on the published URL so HTTPS and the testnet notice are visible.
- Do not put secret keys (`S…`) in `app/.env.production`.
