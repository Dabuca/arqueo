---
name: Arqueo
description: Internal controls for stablecoin treasuries on Stellar. Warm paper, deep green ink, stone cards, with orbit motifs from the logo.
colors:
  paper: "#fbf9f6"
  surface-low: "#f5f3f0"
  surface: "#efeeeb"
  surface-high: "#eae8e5"
  stock: "#ffffff"
  stone: "#faf8f5"
  stone-line: "#e2ded4"
  ink: "#00110c"
  ink-container: "#0d2821"
  muted: "#635e50"
  body: "#424845"
  outline: "#c1c8c4"
  ok-soft: "#cbe9de"
  ok-ink: "#00694a"
  alert: "#ba1a1a"
  alert-ink: "#93000a"
  alert-soft: "#ffdad6"
  sand: "#eae2cf"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  control: "10px"
  card: "16px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.ink-container}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-secondary:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  card:
    backgroundColor: "{colors.stone}"
    rounded: "{rounded.card}"
    padding: "24px"
  pill-ok:
    backgroundColor: "{colors.ok-soft}"
    textColor: "#324c44"
    rounded: "{rounded.pill}"
  pill-refused:
    backgroundColor: "{colors.alert-soft}"
    textColor: "{colors.alert-ink}"
    rounded: "{rounded.pill}"
---

# Design System: Arqueo

> Scope. Recorded from the landing at `/` (`src/pages/Landing.tsx`) and the app screens at `/app` and `/auditor`. Shared tokens live in `src/styles/tokens.css`; shared components (card, button, field, pill) in `src/styles/ui.module.css`. The Landing still redefines the same tokens locally; they should converge on the shared file. `/debug` still runs on the Scaffold template styles and is not migrated.

## Overview

**Creative North Star: "The Account That Refuses"**

Arqueo looks like a calm, exact instrument: warm paper ground, deep green ink, and stone cards. The mark's discs and orbits are the only decoration: flat, in the brand greens, at low opacity. The landing is expressive (animated orbit backgrounds, scroll-linked entrances); the app screens are quiet and task-first, with no decorative motion.

**Key Characteristics:**
- Paper ground, deep green ink, stone cards with a 1px warm border and no shadow.
- Space Grotesk for headings, Plus Jakarta Sans for everything read, JetBrains Mono for data and labels.
- Status is a pill: green for settled, red only for a refusal or an error.
- One component vocabulary across landing, treasury and auditor.

## Colors

- **Ink Container** (`#0d2821`): primary buttons, dark pills, the closing band, active selections.
- **Ink** (`#00110c`): headings and strong text. **Muted** (`#635e50`): secondary text. **Body** (`#424845`): running text in cards and tables.
- **Paper / Surface scale**: page ground and its steps for bands (`surface-low`), the footer (`surface`) and neutral pills (`surface-high`).
- **Stone** with **Stone Line**: cards.
- **Alert** family: refusals and errors only, never decoration or warnings that are not a refusal.
- **Ok Soft**: settled payments.

**The Red Is a Verdict Rule.** Red marks a payment the account refused or an error that stops the user. It is never used for emphasis or branding.

## Typography

Headings in Space Grotesk 600 with tight tracking (-0.02 to -0.03em, never below -0.04em). Body in Plus Jakarta Sans 400/500/600. Mono for amounts, addresses, table headers and status labels, with tabular figures. App screens use a fixed rem scale (page title 2rem, section title 1.25rem); the landing uses fluid sizes.

## Components

- **Buttons:** 44px minimum height, 10px radius, 150ms transitions. Primary is ink-container on paper text; secondary is white with an outline that turns ink on hover. Disabled is 55% opacity. Focus is a 2px ink outline offset 3px.
- **Cards:** stone background, stone-line border, 16px radius, 24px padding. No nesting.
- **Fields:** 44px, 10px radius, outline border that turns ink on hover and focus.
- **Pills:** mono caps 11px, fully rounded, one tone per meaning.
- **Tables:** header row in mono caps on `surface-low`, hairline row rules, tabular figures; below 760px each row becomes a labelled card.
- **Header:** logo left, page links centred in a three-column grid, actions right; the link underline grows from the left on hover and stays on the current page.

## Motion

- **Landing:** one authored sequence (hero entrance, the ledger printing its rows), scroll-linked section entrances, smooth in-page scrolling, hover lift on cards. Orbit backgrounds loop only while on screen.
- **App screens:** 150-250ms transitions for state only; skeleton pulse while loading; the result panel fades in. No decorative or looping motion.
- Everything honours `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** use the shared tokens and `ui.module.css` for any new app screen.
- **Do** show refused attempts next to settled ones wherever payments are listed.
- **Do** label illustrative data as illustrative.

### Don't:
- **Don't** add eyebrows or kicker labels above headings.
- **Don't** carry Scaffold template styles into Arqueo screens.
- **Don't** use red for anything but refusals and errors.
- **Don't** add decorative motion to the working screens.
